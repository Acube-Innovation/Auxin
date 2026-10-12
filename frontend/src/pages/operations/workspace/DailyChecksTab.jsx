import React, { useCallback, useEffect, useState } from "react";
import DailyCheckList, { CheckProgress } from "../../../components/operations/DailyCheckList";
import { BucketChip } from "../../../components/operations/OperationsView";
import useTaskActions from "../../../components/operations/useTaskActions";
import OpsVoyageService from "../../../services/OpsVoyageService";
import { TASK_STATUS_LABEL } from "../../../services/OpsTaskService";
import { useToast } from "../../../context/ToastContext";
import { VESSEL_STATUS_LABEL, addDays, formatLocalDate } from "../../../utils/opsFormat";
import styles from "../masters/Masters.module.css";
import dc from "../../../components/operations/DailyCheckList.module.css";
import ov from "../../../components/operations/OperationsView.module.css";
import ws from "./Workspace.module.css";

// Daily Checks tab (E1, E2): the checklist of the chosen day, history by date, recurring tasks
function DailyChecksTab({ voyage, officeTz, refreshKey, onChanged }) {
  const { showToast } = useToast();
  const [date, setDate] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async (d) => {
    try {
      const res = await OpsVoyageService.getDailyChecks(voyage._id, d || undefined);
      setData(res);
      setError("");
      if (!d) setDate(res.date);
    } catch (e) { setError(e.message); }
  }, [voyage._id]);
  useEffect(() => { load(date); }, [load, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (d) => { setDate(d); load(d); };
  const { setStatus, dialogs } = useTaskActions(async (res) => { await load(date); if (onChanged) onChanged(res); });

  const update = async (item, body, message) => {
    try {
      setData(await OpsVoyageService.updateDailyCheck(voyage._id, item._id, body));
      if (message) showToast(message, "success");
    } catch (e) { showToast(e.message, "error"); load(date); }
  };

  if (voyage.status === "DRAFT") return <div className={styles.card}><div className={styles.empty}>Daily checks start when the voyage is activated.</div></div>;
  if (error) return <div className={styles.card}><div className={styles.formError}>{error}</div></div>;
  if (!data) return <div className={styles.card}><div className={styles.empty}>Loading…</div></div>;

  const isToday = data.date === data.today;
  const items = data.log ? data.log.items : (data.preview || []);
  return (
    <div className={dc.layout}>
      <div className={styles.card}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <button className={styles.btnSecondary} onClick={() => go(addDays(data.date, -1))} aria-label="Previous day">‹</button>
          <input type="date" className={styles.input} style={{ width: 170 }} value={data.date} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Checklist date" />
          <button className={styles.btnSecondary} onClick={() => go(addDays(data.date, 1))} aria-label="Next day">›</button>
          {!isToday && <button className={styles.btnLink} onClick={() => go(data.today)}>Today</button>}
          <span style={{ flex: 1 }} />
          <span className={`${styles.chip} ${styles.chipExcel}`}>{VESSEL_STATUS_LABEL[data.log ? data.log.vesselStatus : data.vesselStatus]}</span>
        </div>
        <div className={ws.sectionTitle}>
          {isToday ? "Today's checks" : `Checks of ${formatLocalDate(data.date)}`}
          <span className={styles.subtle} style={{ fontWeight: 400 }}> · office date</span>
        </div>
        {data.log && <CheckProgress items={items} />}
        {data.preview && <div className={styles.hint} style={{ marginBottom: 8 }}>A future day: these are the checks of the current vessel status. The list is fixed on the day itself, from the status the vessel has then.</div>}
        {!data.log && !data.preview && <div className={styles.empty}>{data.date < data.today ? "No checklist was kept on this day." : "No checks."}</div>}
        {data.log && data.log.statuses.length > 1 && <div className={styles.hint} style={{ marginBottom: 6 }}>The vessel status changed during the day; the checks of each status are listed.</div>}
        {items.length > 0 && (
          <DailyCheckList items={items} officeTz={officeTz}
            onToggle={data.editable ? (item, done) => update(item, { done }) : undefined}
            onRemark={data.editable ? (item, remark) => update(item, { remark }, "Remark saved") : undefined} />
        )}
        {data.log && !data.editable && <div className={styles.hint} style={{ marginTop: 8 }}>{isToday ? "Read only." : "Earlier days are kept as they were ticked; only today's checks can be changed."}</div>}
        {data.log && data.log.items.length === 0 && <div className={styles.empty}>No checks are set up for this vessel status (Ops Masters → Daily Check Sets).</div>}

        <div className={ws.sectionTitle} style={{ marginTop: 22 }}>Recurring tasks</div>
        {data.recurring.length === 0 ? <div className={styles.subtle}>This voyage has no recurring tasks.</div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Task</th><th>Due</th><th>Status</th><th>When</th><th /></tr></thead>
              <tbody>
                {data.recurring.map((t) => (
                  <tr key={t._id} className={t.status === "NA" ? styles.inactive : ""} data-task={t.baseName}>
                    <td>{t.baseName || t.name}{t.naReason && <div className={styles.note}>{t.naReason}</div>}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{t.dueDate ? formatLocalDate(t.dueDate) : "—"}</td>
                    <td>{TASK_STATUS_LABEL[t.status]}{t.completedDate && <div className={styles.note}>done {formatLocalDate(t.completedDate)}</div>}</td>
                    <td><BucketChip bucket={t.bucket} /></td>
                    <td>{voyage.permissions?.canEdit && voyage.status === "ACTIVE" && !["DONE", "NA"].includes(t.status) && (
                      <button className={ov.doneBtn} onClick={() => setStatus(t, "DONE")} aria-label={`Mark ${t.baseName} done`}>✓ Done</button>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className={styles.hint} style={{ marginTop: 6 }}>The next payment appears a week before it is due, until re-delivery. If re-delivery moves earlier, payments after it are closed as not applicable.</div>
      </div>

      <div className={styles.card}>
        <div className={ws.sectionTitle}>History</div>
        {data.history.length === 0 ? <div className={styles.subtle}>Nothing yet</div> : (
          <div className={dc.history}>
            {data.history.map((h) => (
              <button key={h.date} className={`${dc.historyRow} ${h.date === data.date ? dc.historyActive : ""}`} onClick={() => go(h.date)} title={VESSEL_STATUS_LABEL[h.vesselStatus]}>
                <span>{formatLocalDate(h.date)}{h.date === data.today ? " (today)" : ""}</span>
                <span style={{ color: h.done === h.total ? "#067647" : "#b54708" }}>{h.done}/{h.total}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {dialogs}
    </div>
  );
}

export default DailyChecksTab;
