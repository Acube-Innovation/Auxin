import React, { useCallback, useEffect, useMemo, useState } from "react";
import OpsVoyageService from "../../../services/OpsVoyageService";
import { TASK_STATUS_LABEL } from "../../../services/OpsTaskService";
import { useToast } from "../../../context/ToastContext";
import { formatInstant, formatLocalDate, DATE_FIELD_LABEL } from "../../../utils/opsFormat";
import { exportReport, ltText, utcText } from "../../../utils/opsExport";
import styles from "../masters/Masters.module.css";
import ws from "./Workspace.module.css";

const KIND = {
  voyage: { label: "Voyage", color: "#0b3a6f" },
  date: { label: "Date change", color: "#b54708" },
  task: { label: "Task", color: "#067647" },
  document: { label: "Document", color: "#6941c6" },
};
const TASK_FIELD = {
  status: "status", dueDate: "due date", dueOverridden: "due date lock", startDate: "start date", completedDate: "completed on",
  assignedTo: "assignee", priority: "priority", remarks: "remarks", naReason: "N/A reason", attachment: "file", linkedValue: "recorded time",
};
const showValue = (field, v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (field === "status") return TASK_STATUS_LABEL[v] || v;
  if (field === "dueOverridden") return v ? "set by hand" : "follows the rule";
  if (Array.isArray(v)) return `${v.length} person(s)`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return formatLocalDate(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(v))) return formatInstant(v, "UTC");
  return String(v);
};
const officeDate = (iso, tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

// Text of one entry (screen and export)
function describe(i) {
  if (i.kind === "voyage" || i.kind === "document") return i.text;
  if (i.kind === "date") return `${i.port ? `${i.port} · ` : ""}${DATE_FIELD_LABEL[i.field] || i.field}`;
  if (i.field === "attachment") return `${i.code ? `${i.code} ` : ""}${i.task}: ${i.note || "File"}: ${i.to || i.from}`;
  return `${i.code ? `${i.code} ` : ""}${i.task}: ${TASK_FIELD[i.field] || i.field} ${showValue(i.field, i.from)} → ${showValue(i.field, i.to)}`;
}

// Activity tab (features D10, C3): everything that happened to the voyage, newest first, with filters and export
function ActivityTab({ voyageId, voyageNo, officeTz, refreshKey }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [auto, setAuto] = useState(false);
  const [f, setF] = useState({ kind: "", by: "", q: "", from: "", to: "" });

  const load = useCallback(() => {
    OpsVoyageService.getActivity(voyageId, { auto: auto ? 1 : undefined }).then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message));
  }, [voyageId, auto]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const people = useMemo(() => [...new Set((data?.items || []).map((i) => i.by))].sort(), [data]);
  const shown = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return (data?.items || []).filter((i) => (!f.kind || i.kind === f.kind) && (!f.by || i.by === f.by)
      && (!f.from || officeDate(i.at, officeTz) >= f.from) && (!f.to || officeDate(i.at, officeTz) <= f.to)
      && (!q || `${describe(i)} ${i.reason || ""} ${i.note || ""}`.toLowerCase().includes(q)));
  }, [data, f, officeTz]);
  const counts = useMemo(() => {
    const c = {};
    for (const i of data?.items || []) c[i.kind] = (c[i.kind] || 0) + 1;
    return c;
  }, [data]);

  if (error) return <div className={styles.formError}>{error}</div>;
  if (!data) return <div className={styles.empty}>Loading…</div>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const exportCsv = (format) => {
    try {
      exportReport(`${voyageNo || "voyage"}_activity`, [{
        name: "Activity",
        rows: shown,
        columns: [
          { header: "When (office time)", value: (i) => ltText(i.at, officeTz) }, { header: "When (UTC)", value: (i) => utcText(i.at) },
          { header: "Type", value: (i) => KIND[i.kind].label + (i.auto ? " (automatic)" : "") }, { header: "By", key: "by" },
          { header: "What", value: describe },
          { header: "From", value: (i) => (i.kind === "date" ? (i.from ? `${ltText(i.from, i.zone)} LT` : "") : "") },
          { header: "To", value: (i) => (i.kind === "date" ? (i.to ? `${ltText(i.to, i.zone)} LT` : "cleared") : "") },
          { header: "Reason / note", value: (i) => i.reason || i.note || "" },
          { header: "Tasks moved", value: (i) => (i.kind === "date" ? i.tasksMoved ?? 0 : "") },
        ],
      }], format);
      showToast("Activity exported", "success");
    } catch (e) { showToast(e.message, "error"); }
  };

  return (
    <div className={styles.card}>
      <div className={styles.toolbar}>
        <div className={styles.cardTitle}>Activity</div>
        <div className={styles.toolbarLeft}>
          <button className={styles.btnSecondary} onClick={() => exportCsv("xlsx")}>Export Excel</button>
          <button className={styles.btnSecondary} onClick={() => exportCsv("csv")}>Export CSV</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <button className={styles.btnLink} style={{ fontWeight: f.kind ? 400 : 700 }} onClick={() => setF({ ...f, kind: "" })}>Everything ({data.items.length})</button>
        {Object.entries(KIND).map(([k, v]) => (
          <button key={k} className={styles.chip} onClick={() => setF({ ...f, kind: f.kind === k ? "" : k })} data-kind={k}
            style={{ cursor: "pointer", color: v.color, background: "#f9fafb", border: f.kind === k ? `2px solid ${v.color}` : "1px solid #eaecf0" }}>
            {v.label} {counts[k] || 0}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <input className={styles.search} placeholder="Search text, reason, task" value={f.q} onChange={set("q")} aria-label="Search activity" />
        <select className={styles.select} value={f.by} onChange={set("by")} aria-label="By">
          <option value="">Anyone</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="date" className={styles.input} style={{ width: 160 }} value={f.from} onChange={set("from")} aria-label="From date" />
        <span className={styles.subtle}>to</span>
        <input type="date" className={styles.input} style={{ width: 160 }} value={f.to} onChange={set("to")} aria-label="To date" />
        <label style={{ fontWeight: 400 }}><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Include automatic task changes</label>
        {(f.kind || f.by || f.q || f.from || f.to) && <button className={styles.btnLink} onClick={() => setF({ kind: "", by: "", q: "", from: "", to: "" })}>Clear filters</button>}
        <span className={styles.subtle} style={{ marginLeft: "auto" }} data-testid="activity-count">{shown.length} entr{shown.length === 1 ? "y" : "ies"} · office time</span>
      </div>
      {shown.length === 0 && <div className={styles.empty}>Nothing matches</div>}
      <ul className={ws.activity}>
        {shown.map((i, n) => (
          <li key={n} data-kind={i.kind}>
            <span className={ws.activityKind} style={{ color: KIND[i.kind].color, borderColor: KIND[i.kind].color }}>{KIND[i.kind].label}</span>
            <div style={{ flex: 1 }}>
              {(i.kind === "voyage" || i.kind === "document") && <div>{i.text}</div>}
              {i.kind === "date" && (
                <div>
                  {i.port && <b>{i.port} · </b>}{DATE_FIELD_LABEL[i.field] || i.field}: {i.from ? formatInstant(i.from, i.zone) : "—"} → <b>{i.to ? formatInstant(i.to, i.zone) : "cleared"}</b>
                  {i.tasksMoved > 0 && <span className={styles.defaulted}>{i.tasksMoved} task due date(s) moved</span>}
                  {i.reason && <div className={styles.note}>Reason: {i.reason}</div>}
                </div>
              )}
              {i.kind === "task" && (
                <div style={i.auto ? { color: "#667085" } : undefined}>
                  <b>{i.code ? `${i.code} ` : ""}{i.task}</b>: {i.field === "attachment"
                    ? <>{i.note || "File"}: {i.to || i.from}</>
                    : <>{TASK_FIELD[i.field] || i.field} {showValue(i.field, i.from)} → {showValue(i.field, i.to)}</>}
                  {i.auto && <span className={styles.defaulted}>automatic</span>}
                  {i.note && i.field !== "attachment" && <div className={styles.note}>{i.note}</div>}
                </div>
              )}
              <div className={styles.note}>{formatInstant(i.at, officeTz, { withUtc: false })} · {i.by}</div>
            </div>
          </li>
        ))}
      </ul>
      {data.total > data.items.length && <div className={styles.hint}>Showing the latest {data.items.length} of {data.total} entries.</div>}
    </div>
  );
}

export default ActivityTab;
