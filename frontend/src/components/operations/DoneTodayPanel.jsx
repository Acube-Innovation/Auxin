import React, { useCallback, useEffect, useMemo, useState } from "react";
import OpsTaskService from "../../services/OpsTaskService";
import { useToast } from "../../context/ToastContext";
import RemarkLog from "./RemarkLog";
import { formatInstant, formatLocalDate } from "../../utils/opsFormat";
import OpsMasterService from "../../services/OpsMasterService";
import styles from "../../pages/operations/masters/Masters.module.css";
import ov from "./OperationsView.module.css";

// 'YYYY-MM-DD' of an instant in a zone
const dayKey = (iso, zone) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const timeOf = (iso, zone) => formatInstant(iso, zone, { withUtc: false }).split(" ")[1] || "";

// Tasks done today (or on a chosen day), across the voyages the user can see, for managers to check.
// A task counts when it was marked Done that day or its completion date is that day. Managers / admin can
// mark tasks as checked; re-opening a task removes the check.
function DoneTodayPanel({ refreshKey, onOpenTask }) {
  const { showToast } = useToast();
  const [officeTz, setOfficeTz] = useState("Asia/Kolkata");
  useEffect(() => { OpsMasterService.getMeta().then((m) => m?.officeTimeZone && setOfficeTz(m.officeTimeZone)).catch(() => {}); }, []);
  const [date, setDate] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [show, setShow] = useState("UNCHECKED"); // UNCHECKED | CHECKED | ALL
  const [voyage, setVoyage] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await OpsTaskService.doneToday(date ? { date } : {}));
      setError("");
    } catch (e) { setError(e.message); }
  }, [date]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const voyages = useMemo(() => {
    const m = new Map();
    for (const t of data?.tasks || []) m.set(t.voyage._id, t.voyage);
    return [...m.values()].sort((a, b) => a.voyageNo.localeCompare(b.voyageNo));
  }, [data]);
  const rows = useMemo(() => (data?.tasks || []).filter((t) => (!voyage || t.voyage._id === voyage)
    && (show === "ALL" || (show === "CHECKED") === Boolean(t.verified?.at))), [data, voyage, show]);
  const day = data?.date;
  const sel = rows.filter((t) => selected.has(t._id) && !t.verified?.at).map((t) => t._id);
  const unchecked = rows.filter((t) => !t.verified?.at);
  const allSel = unchecked.length > 0 && unchecked.every((t) => selected.has(t._id));

  const verify = async (ids, undo = false) => {
    setBusy(true);
    try {
      const res = await OpsTaskService.verify(ids, undo);
      showToast(`${undo ? "Check removed" : "Checked"}: ${res.updated} task${res.updated === 1 ? "" : "s"}`, "success");
      setSelected(new Set());
      await load();
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(false); }
  };

  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const remarksOfDay = (t) => (t.remarkLog || []).filter((r) => dayKey(r.at, officeTz) === day);

  return (
    <div className={styles.card} data-testid="done-today">
      <div className={styles.toolbar}>
        <div className={styles.cardTitle}>
          Tasks done {data && data.date === data.today ? "today" : `on ${formatLocalDate(day)}`}
          {data && <span className={styles.subtle} style={{ fontWeight: 400 }}> ({data.total} · {data.verified} checked)</span>}
        </div>
        <div className={styles.toolbarLeft}>
          <input type="date" className={styles.input} style={{ width: 160 }} value={date || data?.today || ""} max={data?.today} onChange={(e) => setDate(e.target.value)} aria-label="Day" />
          <select className={styles.select} value={voyage} onChange={(e) => setVoyage(e.target.value)} aria-label="Voyage">
            <option value="">All voyages ({voyages.length})</option>
            {voyages.map((v) => <option key={v._id} value={v._id}>{v.voyageNo}{v.vessel?.name ? ` — ${v.vessel.name}` : ""}</option>)}
          </select>
          <select className={styles.select} value={show} onChange={(e) => setShow(e.target.value)} aria-label="Checked filter">
            <option value="UNCHECKED">Not checked yet</option>
            <option value="CHECKED">Checked</option>
            <option value="ALL">All</option>
          </select>
          {data?.canVerify && sel.length > 0 && <button className={ov.doneBtn} disabled={busy} onClick={() => verify(sel)}>✔ Mark {sel.length} checked</button>}
        </div>
      </div>
      {error && <div className={styles.formError}>{error}</div>}
      {!data && !error && <div className={styles.empty}>Loading…</div>}
      {data && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {data.canVerify && <th style={{ width: 28 }}><input type="checkbox" aria-label="Select all not checked" checked={allSel}
                  onChange={() => setSelected(allSel ? new Set() : new Set(unchecked.map((t) => t._id)))} /></th>}
                <th>Vessel / voyage</th><th>Task</th><th>Done</th><th className={ov.hideSm}>Assigned</th><th>Remarks that day</th><th>Check</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={data.canVerify ? 7 : 6} className={styles.empty}>{show === "UNCHECKED" && data.total ? "Everything done this day has been checked." : "No tasks done this day."}</td></tr>}
              {rows.map((t) => (
                <tr key={t._id} data-task={t.code || t.baseName}>
                  {data.canVerify && <td>{!t.verified?.at && <input type="checkbox" checked={selected.has(t._id)} onChange={() => toggle(t._id)} aria-label={`Select ${t.baseName || t.name}`} />}</td>}
                  <td style={{ whiteSpace: "nowrap" }}><b>{t.voyage.vessel?.name || "—"}</b><div className={styles.note}>{t.voyage.voyageNo}</div></td>
                  <td>
                    <button className={ov.taskName} onClick={() => onOpenTask && onOpenTask(t._id)}>{t.baseName || t.name}</button>
                    <div className={styles.note}>{[t.code, t.stage?.name, t.portCall?.port?.name].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {t.doneAt ? timeOf(t.doneAt, officeTz) : ""}{t.doneBy ? ` · ${t.doneBy}` : ""}
                    {t.completedDate && t.completedDate !== day && <div className={styles.note}>completion date {formatLocalDate(t.completedDate)}</div>}
                    {t.overdueDays > 0 && <div className={styles.note} style={{ color: "#b42318" }}>{t.overdueDays} day(s) late</div>}
                  </td>
                  <td className={`${styles.subtle} ${ov.hideSm}`}>{(t.assignedTo || []).map((a) => a.employeeName).join(", ") || "—"}</td>
                  <td style={{ minWidth: 200 }}><RemarkLog remarks={remarksOfDay(t)} officeTz={officeTz} emptyText="—" /></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {t.verified?.at
                      ? <span style={{ color: "#067647" }} title={formatInstant(t.verified.at, officeTz, { withUtc: false })}>✔ {t.verified.by?.username || "checked"}
                        {data.canVerify && <> · <button className={styles.btnLink} disabled={busy} onClick={() => verify([t._id], true)}>undo</button></>}</span>
                      : data.canVerify ? <button className={styles.btnSecondary} disabled={busy} onClick={() => verify([t._id])}>✔ Check</button>
                        : <span className={styles.subtle}>not checked</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className={styles.hint} style={{ marginTop: 8 }}>
        Tasks marked Done on this day (or with this completion date). {data?.canVerify ? "Check each one before the voyage is closed; re-opening a task removes its check." : "Managers check these tasks."}
      </div>
    </div>
  );
}

export default DoneTodayPanel;
