import React from "react";
import { TASK_STATUS_LABEL } from "../../services/OpsTaskService";
import { formatInstant, formatInstantDate } from "../../utils/opsFormat";
import styles from "../../pages/operations/masters/Masters.module.css";

// Remarks of a task, newest day first, grouped by day (office time). Remarks are never edited: each one is kept
// with who wrote it, when, and the status it was written for. `legacy` is the single remark from before the log.
function RemarkLog({ remarks = [], legacy = "", officeTz = "Asia/Kolkata", emptyText = "No remarks yet" }) {
  const days = [];
  const byDay = new Map();
  [...remarks].sort((a, b) => new Date(b.at) - new Date(a.at)).forEach((r) => {
    const day = formatInstantDate(r.at, officeTz);
    if (!byDay.has(day)) { byDay.set(day, []); days.push(day); }
    byDay.get(day).push(r);
  });
  if (!days.length && !legacy) return <div className={styles.subtle}>{emptyText}</div>;
  return (
    <div style={{ display: "grid", gap: 8 }} data-testid="remark-log">
      {days.map((day) => (
        <div key={day}>
          <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#0b3a6f", borderBottom: "1px solid #eaecf0", paddingBottom: 2, marginBottom: 4 }}>{day}</div>
          {byDay.get(day).map((r) => (
            <div key={r._id || `${r.at}-${r.text}`} style={{ padding: "2px 0 4px", fontSize: "0.88rem" }}>
              <div style={{ whiteSpace: "pre-wrap" }}>{r.text}</div>
              <div className={styles.subtle} style={{ fontSize: "0.78rem" }}>
                {formatInstant(r.at, officeTz, { withUtc: false }).split(" ").slice(1).join(" ")}{r.by?.username ? ` · ${r.by.username}` : ""}{r.status ? ` · ${TASK_STATUS_LABEL[r.status] || r.status}` : ""}
              </div>
            </div>
          ))}
        </div>
      ))}
      {legacy && (
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#0b3a6f", borderBottom: "1px solid #eaecf0", paddingBottom: 2, marginBottom: 4 }}>Earlier remark</div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: "0.88rem" }}>{legacy}</div>
        </div>
      )}
    </div>
  );
}

// The newest remark (for one-line display in task lists)
export const latestRemark = (t) => {
  const log = t.remarkLog || [];
  if (!log.length) return t.remarks || "";
  return log.reduce((a, b) => (new Date(b.at) > new Date(a.at) ? b : a)).text;
};

export default RemarkLog;
