import React, { useCallback, useEffect, useMemo, useState } from "react";
import OpsVoyageService from "../../services/OpsVoyageService";
import { BUCKETS, BUCKET_BY_KEY, formatLocalDate, ruleText } from "../../utils/opsFormat";
import styles from "../../pages/operations/masters/Masters.module.css";

const STATUS_LABEL = { NOT_STARTED: "Not started", INITIATED: "Initiated", AWAITING: "Awaiting", DONE: "Done", NA: "N/A" };

function BucketChip({ bucket }) {
  const b = BUCKET_BY_KEY[bucket];
  if (!b) return null;
  return (
    <span className={styles.chip} style={{ background: b.bg, color: b.color, border: b.border ? `1px dashed ${b.border}` : "none" }}>
      {b.label}
    </span>
  );
}

// Read-only task list of an active voyage with due dates and colour buckets (editing arrives in step 7)
function VoyageTaskList({ voyageId, refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [bucket, setBucket] = useState("");

  const load = useCallback(() => {
    OpsVoyageService.getTasks(voyageId).then(setData).catch((e) => setError(e.message));
  }, [voyageId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const rows = useMemo(() => (data ? data.tasks.filter((t) => !bucket || t.bucket === bucket) : []), [data, bucket]);

  if (error) return <div className={styles.formError}>{error}</div>;
  if (!data) return <div className={styles.empty}>Loading tasks…</div>;

  let lastGroup = null;
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <button className={`${styles.btnLink}`} style={{ fontWeight: bucket ? 400 : 700 }} onClick={() => setBucket("")}>All ({data.total})</button>
        {BUCKETS.map((b) => (
          <button key={b.key} onClick={() => setBucket(bucket === b.key ? "" : b.key)} className={styles.chip}
            style={{ cursor: "pointer", background: b.bg, color: b.color, border: bucket === b.key ? `2px solid ${b.color}` : b.border ? `1px dashed ${b.border}` : "1px solid transparent" }}>
            {b.label} {data.byBucket[b.key] || 0}
          </button>
        ))}
        <span className={styles.subtle}>Today (office time): {formatLocalDate(data.today)}</span>
      </div>
      <div className={styles.tableWrap} style={{ maxHeight: 420, overflowY: "auto" }}>
        <table className={styles.table}>
          <thead><tr><th>Code</th><th>Task</th><th>Rule</th><th>Due</th><th>Status</th><th>When</th><th>Assigned</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className={styles.empty}>No tasks in this group</td></tr>}
            {rows.map((t) => {
              const group = t.stage ? `${t.stage.order}. ${t.stage.name}${t.portCall ? ` — ${t.portCall.port?.name}` : ""}` : "Ad-hoc tasks";
              const header = group !== lastGroup;
              lastGroup = group;
              return (
                <React.Fragment key={t._id}>
                  {header && <tr className={styles.groupRow}><td colSpan={7}>{group}</td></tr>}
                  <tr className={t.status === "NA" ? styles.inactive : ""}>
                    <td className={styles.mono}>{t.code || "—"}</td>
                    <td>
                      {t.baseName || t.name}
                      {t.dueOverridden && <span className={styles.defaulted}>date set by hand</span>}
                      {t.naReason && <div className={styles.note}>{t.naReason}</div>}
                    </td>
                    <td className={styles.subtle}>{t.anchor?.event ? ruleText(t.anchor.event, t.offsetDays, t.recurrence) : "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{t.dueDate ? formatLocalDate(t.dueDate) : <span className={styles.subtle}>—</span>}</td>
                    <td>{STATUS_LABEL[t.status]}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <BucketChip bucket={t.bucket} />
                      {t.overdueDays > 0 && t.status !== "DONE" && <div className={styles.note}>{t.overdueDays} day(s) overdue</div>}
                      {t.dueInDays != null && <div className={styles.note}>due in {t.dueInDays} day(s)</div>}
                    </td>
                    <td className={styles.subtle}>{(t.assignedTo || []).map((a) => a.employeeName).join(", ") || "—"}</td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default VoyageTaskList;
