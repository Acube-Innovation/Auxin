import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import OpsLayout from "../../components/operations/OpsLayout";
import OpsReportService from "../../services/OpsReportService";
import OpsVoyageService from "../../services/OpsVoyageService";
import OpsMasterService from "../../services/OpsMasterService";
import EmployeeService from "../../services/EmployeeService";
import { TASK_STATUS_LABEL, TASK_STATUSES } from "../../services/OpsTaskService";
import { useToast } from "../../context/ToastContext";
import { BUCKET_BY_KEY, PORT_TYPE_LABEL, VESSEL_STATUS_LABEL, addDays, formatDelay, formatInstant, formatLocalDate, ruleText } from "../../utils/opsFormat";
import { dateText, exportReport, ltText, utcText } from "../../utils/opsExport";
import styles from "./masters/Masters.module.css";
import rs from "./OpsReports.module.css";

const TYPES = [
  { key: "tasks", code: "H1", title: "Voyage task status", text: "All tasks of a voyage with dates, status and remarks" },
  { key: "overdue", code: "H2", title: "Overdue & on-time", text: "Across voyages and operators for a date range: done on time, late, still overdue" },
  { key: "ports", code: "H3", title: "Planned vs actual port", text: "Original, revised and actual times of every port call, with delays" },
  { key: "summary", code: "H4", title: "Voyage summary sheet", text: "One page like the OPS sheet: fixture, cargo, rotation, timings LT and UTC" },
];
const OUTCOME = { ON_TIME: { label: "On time", color: "#067647", bg: "#dcfae6" }, LATE: { label: "Late", color: "#b54708", bg: "#fef0c7" }, OVERDUE: { label: "Overdue", color: "#b42318", bg: "#fee4e2" }, OPEN: { label: "Not yet due", color: "#475467", bg: "#f2f4f7" } };
const PREVIEW = 200;
const yesNo = (b) => (b ? "Yes" : "No");
const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- column sets (screen + export use the same)
const TASK_COLS = [
  { header: "Voyage", key: "voyageNo" }, { header: "Vessel", key: "vessel" }, { header: "Code", key: "code" }, { header: "Task", key: "task" },
  { header: "Stage", key: "stage" }, { header: "Port", key: "port" },
  { header: "Rule", value: (r) => (r.rule ? ruleText(r.rule.event, r.rule.offsetDays, r.rule.recurrence) : "Ad-hoc") },
  { header: "Due date", value: (r) => dateText(r.dueDate) }, { header: "Due set by hand", value: (r) => yesNo(r.dueSetByHand) },
  { header: "Start date", value: (r) => dateText(r.startDate) }, { header: "Completed", value: (r) => dateText(r.completedDate) },
  { header: "Status", value: (r) => TASK_STATUS_LABEL[r.status] }, { header: "Group", value: (r) => BUCKET_BY_KEY[r.bucket]?.label || "" },
  { header: "Overdue (days)", key: "overdueDays" }, { header: "Pending (days)", key: "pendingDays" },
  { header: "Priority", key: "priority" }, { header: "Assigned to", key: "assignedTo" }, { header: "Remarks", key: "remarks" }, { header: "N/A reason", key: "naReason" },
];
const OVERDUE_COLS = [
  { header: "Voyage", key: "voyageNo" }, { header: "Vessel", key: "vessel" }, { header: "Code", key: "code" }, { header: "Task", key: "task" },
  { header: "Stage", key: "stage" }, { header: "Port", key: "port" }, { header: "Due date", value: (r) => dateText(r.dueDate) },
  { header: "Completed", value: (r) => dateText(r.completedDate) }, { header: "Outcome", value: (r) => OUTCOME[r.outcome].label },
  { header: "Days late / overdue", key: "daysLate" }, { header: "Priority", key: "priority" }, { header: "Assigned to", key: "assignedTo" },
];
const SUMMARY_COLS = (first) => [
  { header: first, key: first === "Operator" ? "operator" : "voyageNo" }, ...(first === "Voyage" ? [{ header: "Vessel", key: "vessel" }] : []),
  { header: "Due in range", key: "total" }, { header: "On time", key: "ON_TIME" }, { header: "Late", key: "LATE" }, { header: "Overdue", key: "OVERDUE" },
  { header: "Not yet due", key: "OPEN" }, { header: "On-time %", value: (r) => (r.onTimePct == null ? "" : r.onTimePct) },
];
const EVENTS = [["arrival", "Arrival", "ETA", "ATA"], ["berthing", "Berthing", "ETB", "ATB"], ["completion", "Completion", "ETC", "Completed"], ["sailing", "Sailing", "ETS", "ATD"]];
const PORT_COLS = [
  { header: "Voyage", key: "voyageNo" }, { header: "Vessel", key: "vessel" }, { header: "#", key: "seq" }, { header: "Port", key: "port" },
  { header: "Type", value: (r) => PORT_TYPE_LABEL[r.type] }, { header: "Status", key: "status" }, { header: "Time zone", key: "timeZone" }, { header: "Agent", key: "agent" },
  ...EVENTS.flatMap(([k, , p, a]) => [
    { header: `${p} original (LT)`, value: (r) => ltText(r[`${k}Original`], r.timeZone) },
    { header: `${p} revised (LT)`, value: (r) => ltText(r[`${k}Planned`], r.timeZone) },
    { header: `${a} (LT)`, value: (r) => ltText(r[`${k}Actual`], r.timeZone) },
    { header: `${a} (UTC)`, value: (r) => utcText(r[`${k}Actual`]) },
    { header: `${a} vs original (h)`, value: (r) => r[`${k}DelayH`] },
  ]),
  { header: "NOR tendered (LT)", value: (r) => ltText(r.norTendered, r.timeZone) }, { header: "Ops commenced (LT)", value: (r) => ltText(r.commenced, r.timeZone) },
  { header: "ETA revisions", key: "etaRevisions" }, { header: "Port stay ATA→ATD (h)", key: "portStayH" },
];

function Table({ rows, cols, render }) {
  return (
    <div className={styles.tableWrap} style={{ maxHeight: 520, overflowY: "auto" }}>
      <table className={styles.table}>
        <thead><tr>{cols.map((c) => <th key={c.header} style={{ whiteSpace: "nowrap" }}>{c.header}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={cols.length} className={styles.empty}>No rows</td></tr>}
          {rows.slice(0, PREVIEW).map((r, i) => (
            <tr key={r.taskId || r.portCallId || r.operator || r.voyageNo || i}>
              {cols.map((c) => <td key={c.header}>{render ? render(c, r) : String((c.value ? c.value(r) : r[c.key]) ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// H4: one-page voyage summary (OPS-sheet equivalent)
function SummarySheet({ data }) {
  const v = data.voyage;
  const tz = data.officeTimeZone;
  const f = v.fixture || {};
  const T = ({ iso, zone }) => (iso ? <>{ltText(iso, zone)} LT <span className={rs.utc}>({utcText(iso)} UTC)</span></> : "—");
  const KV = ({ k, children }) => <div className={rs.kv}><span>{k}</span><span>{children || "—"}</span></div>;
  const t = data.totals;
  return (
    <div className={rs.sheet} data-testid="summary-sheet">
      <div className={rs.sheetHead}>
        <div>
          <div className={rs.sheetTitle}>{v.vessel?.name} — {v.voyageNo}</div>
          <div className={styles.subtle}>{v.voyageType === "TC_TRIP" ? "Time-charter trip" : "Voyage charter"} · {v.status} · {VESSEL_STATUS_LABEL[v.vesselStatusShown]}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>Summary of {formatLocalDate(data.today)}</div>
          {t && <div className={styles.subtle}>Tasks {t.pctComplete ?? 0}% complete · {t.overdue} overdue · on time {t.onTimePct ?? "—"}%</div>}
        </div>
      </div>
      <div className={rs.sheetGrid}>
        <div className={rs.block}>
          <h4>Fixture (office time)</h4>
          <KV k="Cargo fixed"><T iso={f.cargoFixedAt} zone={tz} /></KV>
          <KV k="Vessel fixed"><T iso={f.vesselFixedAt} zone={tz} /></KV>
          <KV k="Cargo laycan">{f.cargoLaycanFrom ? `${formatInstant(f.cargoLaycanFrom, tz).slice(0, 11)} – ${f.cargoLaycanTo ? formatInstant(f.cargoLaycanTo, tz).slice(0, 11) : "?"}` : ""}</KV>
          <KV k="Vessel laycan">{f.vesselLaycanFrom ? `${formatInstant(f.vesselLaycanFrom, tz).slice(0, 11)} – ${f.vesselLaycanTo ? formatInstant(f.vesselLaycanTo, tz).slice(0, 11) : "?"}` : ""}</KV>
          <KV k="CP date">{f.cpDate ? formatInstant(f.cpDate, tz).slice(0, 11) : ""}</KV>
        </div>
        <div className={rs.block}>
          <h4>Parties</h4>
          <KV k="Vessel">{[v.vessel?.name, v.vessel?.imo && `IMO ${v.vessel.imo}`, v.vessel?.type, v.vessel?.dwt && `${v.vessel.dwt.toLocaleString("en-IN")} DWT`].filter(Boolean).join(" · ")}</KV>
          <KV k="Charterer">{v.charterers?.companyName}</KV>
          <KV k="Owners">{v.owners?.companyName}</KV>
          <KV k="Brokers">{(v.brokers || []).map((b) => b.companyName).join(", ")}</KV>
          <KV k="Master">{[v.master?.name, v.master?.email, v.master?.phone].filter(Boolean).join(" · ")}</KV>
          <KV k="Operators">{(v.operators || []).map((o) => o.employeeName).join(", ")}</KV>
        </div>
        <div className={rs.block}>
          <h4>Cargo and bunkers</h4>
          {(v.cargo || []).map((c) => <KV key={c._id} k={c.description}>{c.quantity != null ? `${c.quantity.toLocaleString("en-IN")} ${c.unit}` : ""}</KV>)}
          <KV k="Bunker port">{v.portCalls.find((p) => p._id === v.bunker?.portCall)?.port?.name}</KV>
          <KV k="Supplier">{[v.bunker?.supplier?.companyName, v.bunker?.grade, v.bunker?.quantity != null && `${v.bunker.quantity} MT`].filter(Boolean).join(" · ")}</KV>
          <KV k="Booked on"><T iso={v.bunker?.bookedOn} zone={tz} /></KV>
        </div>
      </div>
      <table className={rs.sheetTable}>
        <thead><tr><th>Delivery / re-delivery</th><th>Place</th><th>Zone</th><th>Original</th><th>Estimated</th><th>Actual</th></tr></thead>
        <tbody>
          {[["Delivery", v.delivery], ["Re-delivery", v.redelivery]].map(([label, h]) => (
            <tr key={label}><td><b>{label}</b></td><td>{[h?.place, h?.port?.name].filter(Boolean).join(" · ") || "—"}</td><td>{h?.timeZone || "—"}</td>
              <td><T iso={h?.original} zone={h?.timeZone} /></td><td><T iso={h?.estimated} zone={h?.timeZone} /></td><td><T iso={h?.actual} zone={h?.timeZone} /></td></tr>
          ))}
        </tbody>
      </table>
      <table className={rs.sheetTable}>
        <thead><tr><th>#</th><th>Port</th><th>Agent · qty · rate</th>{EVENTS.map(([k, label]) => <th key={k}>{label}<div className={rs.utc}>planned / actual</div></th>)}</tr></thead>
        <tbody>
          {v.portCalls.map((pc) => (
            <tr key={pc._id} style={pc.status === "CANCELLED" ? { color: "#98a2b3", textDecoration: "line-through" } : undefined}>
              <td>{pc.seq}</td>
              <td><b>{pc.port?.name}</b><div className={rs.utc}>{PORT_TYPE_LABEL[pc.type]} · {pc.timeZone}</div></td>
              <td>{[pc.agent?.companyName, pc.cargoQty != null && `${pc.cargoQty.toLocaleString("en-IN")} MT`, pc.ratePerDay != null && `${pc.ratePerDay.toLocaleString("en-IN")}/day`].filter(Boolean).join(" · ") || "—"}</td>
              {EVENTS.map(([k, , p, a]) => {
                const pk = { arrival: "eta", berthing: "etb", completion: "etc", sailing: "ets" }[k];
                const ak = { arrival: "ata", berthing: "atb", completion: "completed", sailing: "atd" }[k];
                const d = formatDelay(pc.original?.[pk] || pc.planned?.[pk], pc.actual?.[ak]);
                return (
                  <td key={k}>
                    <div><T iso={pc.planned?.[pk]} zone={pc.timeZone} /></div>
                    {pc.actual?.[ak] && <div><b><T iso={pc.actual[ak]} zone={pc.timeZone} /></b>{d && <span style={{ color: d.minutes > 0 ? "#b42318" : "#067647" }}> {d.text}</span>}</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {data.byStage && (
        <div className={styles.subtle}>Tasks by stage: {data.byStage.map((g) => `${g.stage}${g.port ? ` (${g.port})` : ""} ${g.done}/${g.total}`).join(" · ")}</div>
      )}
      {v.remarks && <div style={{ marginTop: 6 }}><b>Remarks:</b> {v.remarks}</div>}
      <div className={rs.utc} style={{ marginTop: 6 }}>LT = local time of the place; UTC in brackets. {data.revisions} key-date revision(s) — see the voyage's Port Calls &amp; SOF tab.</div>
    </div>
  );
}

// Ops Reports — /operations/reports (H1–H4)
function OpsReports() {
  const { showToast } = useToast();
  const [type, setType] = useState("tasks");
  const [voyages, setVoyages] = useState([]);
  const [vessels, setVessels] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [f, setF] = useState({ voyage: "", vessel: "", operator: "", assignee: "", status: "", priority: "", from: addDays(today(), -30), to: today(), includeCancelled: false });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    OpsVoyageService.list({ status: "ALL", limit: 100 }).then((d) => setVoyages(d.items || [])).catch(() => {});
    OpsMasterService.getVessels().then(setVessels).catch(() => {});
    EmployeeService.getEmployees().then((l) => setEmployees(Array.isArray(l) ? l : [])).catch(() => {});
  }, []);
  useEffect(() => { setResult(null); }, [type]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const voyageNo = useMemo(() => (voyages.find((v) => v._id === f.voyage) || {}).voyageNo, [voyages, f.voyage]);
  const needsVoyage = type === "tasks" || type === "summary";

  const generate = async () => {
    if (needsVoyage && !f.voyage) { showToast("Choose a voyage", "error"); return; }
    setLoading(true);
    try {
      let data;
      if (type === "tasks") data = await OpsReportService.tasks({ voyage: f.voyage, status: f.status, assignee: f.assignee });
      if (type === "overdue") data = await OpsReportService.overdue({ from: f.from, to: f.to, voyage: f.voyage, vessel: f.vessel, assignee: f.assignee, priority: f.priority });
      if (type === "ports") data = await OpsReportService.portCalls({ voyage: f.voyage, vessel: f.vessel, from: f.from, to: f.to, includeCancelled: f.includeCancelled ? 1 : "" });
      if (type === "summary") data = await OpsReportService.summary(f.voyage);
      setResult({ type, data });
    } catch (e) { showToast(e.message, "error"); } finally { setLoading(false); }
  };

  const exportAs = (format) => {
    const { data } = result;
    const stamp = today();
    try {
      if (type === "tasks") exportReport(`${voyageNo}_task_status_${stamp}`, [{ name: "Tasks", rows: data.rows, columns: TASK_COLS }], format);
      if (type === "overdue") {
        exportReport(`overdue_on_time_${data.from}_to_${data.to}`, [
          { name: "Tasks", rows: data.rows, columns: OVERDUE_COLS },
          { name: "By operator", rows: data.byOperator, columns: SUMMARY_COLS("Operator") },
          { name: "By voyage", rows: data.byVoyage, columns: SUMMARY_COLS("Voyage") },
          { name: "Filters", aoa: [["Report", "Overdue & on-time"], ["Due from", dateText(data.from)], ["Due to", dateText(data.to)], ["Generated (office date)", dateText(data.today)], ["On-time %", data.totals.onTimePct ?? ""]], widths: [24, 20] },
        ], format);
      }
      if (type === "ports") exportReport(`port_calls_planned_vs_actual_${stamp}`, [{ name: "Port calls", rows: data.rows, columns: PORT_COLS }], format);
      if (type === "summary") {
        const v = data.voyage;
        const tz = data.officeTimeZone;
        const both = (iso, zone) => (iso ? `${ltText(iso, zone)} LT (${utcText(iso)} UTC)` : "");
        const aoa = [
          ["Voyage summary", v.voyageNo], ["Vessel", v.vessel?.name], ["IMO", v.vessel?.imo || ""], ["Voyage type", v.voyageType], ["Status", v.status],
          ["Vessel status", VESSEL_STATUS_LABEL[v.vesselStatusShown]], ["Report date", dateText(data.today)], [],
          ["Charterer", v.charterers?.companyName || ""], ["Owners", v.owners?.companyName || ""], ["Brokers", (v.brokers || []).map((b) => b.companyName).join(", ")],
          ["Operators", (v.operators || []).map((o) => o.employeeName).join(", ")], ["Master", [v.master?.name, v.master?.email, v.master?.phone].filter(Boolean).join(" · ")], [],
          ["Cargo fixed", both(v.fixture?.cargoFixedAt, tz)], ["Vessel fixed", both(v.fixture?.vesselFixedAt, tz)], [],
          ...(v.cargo || []).map((c) => [`Cargo: ${c.description}`, c.quantity != null ? `${c.quantity} ${c.unit}` : ""]), [],
          ["Delivery", [v.delivery?.place, v.delivery?.timeZone].filter(Boolean).join(" · ")], ["Delivery estimated", both(v.delivery?.estimated, v.delivery?.timeZone)], ["Delivery actual", both(v.delivery?.actual, v.delivery?.timeZone)],
          ["Re-delivery", [v.redelivery?.place, v.redelivery?.timeZone].filter(Boolean).join(" · ")], ["Re-delivery estimated", both(v.redelivery?.estimated, v.redelivery?.timeZone)], ["Re-delivery actual", both(v.redelivery?.actual, v.redelivery?.timeZone)], [],
          ["Bunker booked on", both(v.bunker?.bookedOn, tz)], ["Bunkering date", both(v.bunker?.bunkeringDate, tz)], [],
          ["Tasks % complete", data.totals?.pctComplete ?? ""], ["Tasks overdue", data.totals?.overdue ?? 0], ["On-time %", data.totals?.onTimePct ?? ""],
        ];
        const rows = v.portCalls.map((pc) => ({
          voyageNo: v.voyageNo, vessel: v.vessel?.name, seq: pc.seq, port: pc.port?.name, type: pc.type, status: pc.status, timeZone: pc.timeZone, agent: pc.agent?.companyName || "",
          ...Object.fromEntries(EVENTS.flatMap(([k]) => {
            const pk = { arrival: "eta", berthing: "etb", completion: "etc", sailing: "ets" }[k];
            const ak = { arrival: "ata", berthing: "atb", completion: "completed", sailing: "atd" }[k];
            const base = pc.original?.[pk] || pc.planned?.[pk];
            return [[`${k}Original`, pc.original?.[pk]], [`${k}Planned`, pc.planned?.[pk]], [`${k}Actual`, pc.actual?.[ak]],
              [`${k}DelayH`, base && pc.actual?.[ak] ? Math.round(((new Date(pc.actual[ak]) - new Date(base)) / 3600000) * 10) / 10 : null]];
          })),
          norTendered: pc.actual?.norTendered, commenced: pc.actual?.commenced,
        }));
        exportReport(`${v.voyageNo}_summary_${stamp}`, [{ name: "Summary", aoa, widths: [24, 48] }, { name: "Rotation", rows, columns: PORT_COLS.filter((c) => !["ETA revisions", "Port stay ATA→ATD (h)"].includes(c.header)) }], format);
      }
      showToast(`Exported as ${format === "csv" ? "CSV" : "Excel"}`, "success");
    } catch (e) { showToast(`Export failed: ${e.message}`, "error"); }
  };

  const r = result?.data;
  const voyageSelect = (required) => (
    <div className={styles.field} style={{ gridColumn: "span 2", minWidth: 0 }}>
      <label>Voyage{required && <span className={styles.req}> *</span>}</label>
      <select className={styles.select} value={f.voyage} onChange={set("voyage")} aria-label="Voyage">
        <option value="">{required ? "Choose a voyage" : "All voyages"}</option>
        {voyages.filter((v) => type === "tasks" || type === "summary" || v.status !== "DRAFT").map((v) => <option key={v._id} value={v._id}>{v.voyageNo} — {v.vessel?.name} ({v.status.toLowerCase()})</option>)}
      </select>
    </div>
  );
  const vesselSelect = (
    <div className={styles.field}><label>Vessel</label>
      <select className={styles.select} value={f.vessel} onChange={set("vessel")} aria-label="Vessel"><option value="">All vessels</option>{vessels.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}</select></div>
  );
  const personSelect = (label) => (
    <div className={styles.field}><label>{label}</label>
      <select className={styles.select} value={f.assignee} onChange={set("assignee")} aria-label={label}><option value="">Everyone</option>{employees.map((e) => <option key={e._id} value={e._id}>{e.employeeName}</option>)}</select></div>
  );
  const dates = (label) => (
    <>
      <div className={styles.field}><label>{label} from</label><input type="date" className={styles.input} value={f.from} onChange={set("from")} aria-label="From" /></div>
      <div className={styles.field}><label>to</label><input type="date" className={styles.input} value={f.to} onChange={set("to")} aria-label="To" /></div>
    </>
  );

  return (
    <OpsLayout title="Ops Reports" breadcrumbs={[{ label: "Vessel Operations" }, { label: "Reports" }]}>
      <div className={styles.page}>
        <div className={rs.types} role="tablist" aria-label="Report type">
          {TYPES.map((t) => (
            <button key={t.key} role="tab" aria-selected={type === t.key} className={`${rs.type} ${type === t.key ? rs.typeActive : ""}`} onClick={() => setType(t.key)} data-report={t.code}>
              <div className={rs.typeTitle}>{t.code} · {t.title}</div>
              <div className={rs.typeText}>{t.text}</div>
            </button>
          ))}
        </div>

        <div className={styles.card} style={{ marginBottom: 14 }}>
          <div className={rs.filters}>
            {type === "tasks" && <>{voyageSelect(true)}
              <div className={styles.field}><label>Status</label><select className={styles.select} value={f.status} onChange={set("status")} aria-label="Status"><option value="">All</option>{TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}</select></div>
              {personSelect("Assigned to")}</>}
            {type === "overdue" && <>{dates("Due")}{voyageSelect(false)}{vesselSelect}{personSelect("Operator / assignee")}
              <div className={styles.field}><label>Priority</label><select className={styles.select} value={f.priority} onChange={set("priority")} aria-label="Priority"><option value="">All</option>{["HIGH", "MEDIUM", "LOW"].map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}</select></div></>}
            {type === "ports" && <>{voyageSelect(false)}{vesselSelect}{dates("Arrival")}
              <label style={{ fontWeight: 400 }}><input type="checkbox" checked={f.includeCancelled} onChange={set("includeCancelled")} /> Include cancelled calls</label></>}
            {type === "summary" && voyageSelect(true)}
            <div><button className={styles.btnPrimary} onClick={generate} disabled={loading}>{loading ? "Generating…" : "Generate"}</button></div>
          </div>
          {type === "ports" && <div className={styles.hint} style={{ marginTop: 6 }}>Leave the dates empty for every port call; with dates, a call is included by its arrival (actual if known, else planned) in the port's local date.</div>}
        </div>

        {r && (
          <div className={styles.card}>
            <div className={styles.toolbar}>
              <div className={styles.cardTitle}>{TYPES.find((t) => t.key === result.type).code} · {TYPES.find((t) => t.key === result.type).title}
                {r.rows && <span className={styles.subtle} style={{ fontWeight: 400 }}> · {r.rows.length} row{r.rows.length === 1 ? "" : "s"}{r.rows.length > PREVIEW ? ` (first ${PREVIEW} shown; the export has all)` : ""}</span>}</div>
              <div className={styles.toolbarLeft}>
                <button className={styles.btnSecondary} onClick={() => exportAs("xlsx")}>Export Excel</button>
                <button className={styles.btnSecondary} onClick={() => exportAs("csv")}>Export CSV</button>
                {result.type === "summary" && <button className={styles.btnSecondary} onClick={() => window.print()}>Print</button>}
              </div>
            </div>

            {result.type === "tasks" && <Table rows={r.rows} cols={TASK_COLS} />}

            {result.type === "overdue" && (
              <>
                <div className={rs.stats} data-testid="h2-totals">
                  {Object.entries(OUTCOME).map(([k, o]) => <span key={k} className={rs.stat} style={{ background: o.bg, color: o.color }}>{o.label} <b>{r.totals[k]}</b></span>)}
                  <span className={rs.stat}>On-time % <b>{r.totals.onTimePct ?? "—"}</b></span>
                  <span className={styles.subtle} style={{ alignSelf: "center" }}>Tasks due {dateText(r.from)} – {dateText(r.to)} · N/A tasks left out</span>
                </div>
                <div className={styles.cardTitle} style={{ fontSize: "0.95rem", margin: "6px 0" }}>By operator</div>
                <Table rows={r.byOperator} cols={SUMMARY_COLS("Operator")} />
                <div className={styles.cardTitle} style={{ fontSize: "0.95rem", margin: "12px 0 6px" }}>By voyage</div>
                <Table rows={r.byVoyage} cols={SUMMARY_COLS("Voyage")} />
                <div className={styles.cardTitle} style={{ fontSize: "0.95rem", margin: "12px 0 6px" }}>Tasks</div>
                <Table rows={r.rows} cols={OVERDUE_COLS} render={(c, row) => (c.header === "Outcome"
                  ? <span className={styles.chip} style={{ background: OUTCOME[row.outcome].bg, color: OUTCOME[row.outcome].color }}>{OUTCOME[row.outcome].label}</span>
                  : String((c.value ? c.value(row) : row[c.key]) ?? ""))} />
              </>
            )}

            {result.type === "ports" && (
              <Table rows={r.rows} cols={[PORT_COLS[0], PORT_COLS[3], PORT_COLS[4], { header: "Arrival", key: "a" }, { header: "Berthing", key: "b" }, { header: "Completion", key: "c" }, { header: "Sailing", key: "d" }, { header: "ETA revisions", key: "etaRevisions" }]}
                render={(c, row) => {
                  const ev = { Arrival: "arrival", Berthing: "berthing", Completion: "completion", Sailing: "sailing" }[c.header];
                  if (!ev) return c.header === "Type" ? PORT_TYPE_LABEL[row.type] : String(row[c.key] ?? "");
                  const d = formatDelay(row[`${ev}Original`] || row[`${ev}Planned`], row[`${ev}Actual`]);
                  return (
                    <div style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}>
                      <div className={styles.subtle}>orig {ltText(row[`${ev}Original`], row.timeZone) || "—"}</div>
                      <div>plan {ltText(row[`${ev}Planned`], row.timeZone) || "—"}</div>
                      <div><b>act {ltText(row[`${ev}Actual`], row.timeZone) || "—"}</b>{d && <span style={{ color: d.minutes > 0 ? "#b42318" : "#067647" }}> {d.text}</span>}</div>
                    </div>
                  );
                }} />
            )}

            {result.type === "summary" && (
              <div className={rs.printArea}>
                <SummarySheet data={r} />
                <div className={styles.hint} style={{ marginTop: 8 }}><Link to={`/operations/voyages/${r.voyage._id}`}>Open the voyage</Link></div>
              </div>
            )}
          </div>
        )}
      </div>
    </OpsLayout>
  );
}

export default OpsReports;
