import React from "react";
import OpsModal from "./OpsModal";
import { formatLocalDate } from "../../utils/opsFormat";
import styles from "../../pages/operations/masters/Masters.module.css";

// ETA-change alert (feature F3): which tasks' due dates moved, and which are now due within 48 hours.
function EtaChangeModal({ result, onClose }) {
  if (!result) return null;
  const soon = new Set((result.dueSoon || []).map((t) => String(t.id)));
  const moved = [...(result.movedTasks || [])].sort((a, b) => String(a.to || "9999").localeCompare(String(b.to || "9999")));
  return (
    <OpsModal isOpen title={result.title || "Due dates moved"} onClose={onClose} width={760}
      footer={<button className={styles.btnPrimary} onClick={onClose}>OK</button>}>
      <p style={{ marginTop: 0 }}>
        <b>{moved.length}</b> open task{moved.length === 1 ? "" : "s"} moved.
        {soon.size > 0 && <> <span className={`${styles.chip} ${styles.chipHigh}`}>{soon.size} now due within 48 hours or overdue</span></>}
      </p>
      <div className={styles.tableWrap} style={{ maxHeight: 420, overflowY: "auto" }}>
        <table className={styles.table}>
          <thead><tr><th>Code</th><th>Task</th><th>Was due</th><th>Now due</th><th /></tr></thead>
          <tbody>
            {moved.map((m) => (
              <tr key={m.id} style={soon.has(String(m.id)) ? { background: "#fff4ed" } : undefined}>
                <td className={styles.mono}>{m.code || "—"}</td>
                <td>{m.name}</td>
                <td className={styles.subtle} style={{ whiteSpace: "nowrap" }}>{m.from ? formatLocalDate(m.from) : "—"}</td>
                <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{m.to ? formatLocalDate(m.to) : "awaiting date"}</td>
                <td>{soon.has(String(m.id)) && <span className={`${styles.chip} ${styles.chipHigh}`}>due soon</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.hint} style={{ marginTop: 8 }}>Done tasks and tasks whose due date was set by hand do not move. Reminders follow the new dates.</div>
    </OpsModal>
  );
}

export default EtaChangeModal;
