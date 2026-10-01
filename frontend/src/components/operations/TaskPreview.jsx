import React, { useMemo } from "react";
import { formatLocalDate, ruleText } from "../../utils/opsFormat";
import styles from "../../pages/operations/masters/Masters.module.css";

const PRIORITY_CLASS = { HIGH: styles.chipHigh, MEDIUM: styles.chipMedium, LOW: styles.chipLow };

// Generated task list before activation (feature B9): grouped by stage and port call, with a tick box per task.
// `excluded` is a Set of task keys; optional ("if required") tasks start unticked.
function TaskPreview({ tasks, excluded, onToggle, onToggleGroup, readOnly = false }) {
  const groups = useMemo(() => {
    const out = [];
    let current = null;
    for (const t of tasks) {
      const key = `${t.stage.code}|${t.portCall ? t.portCall._id : ""}`;
      if (!current || current.key !== key) {
        current = {
          key,
          title: `${t.stage.order}. ${t.stage.name}${t.portCall ? ` — ${t.portCall.port}` : ""}`,
          items: [],
        };
        out.push(current);
      }
      current.items.push(t);
    }
    return out;
  }, [tasks]);

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>{!readOnly && <th style={{ width: 32 }} />}<th>Code</th><th>Task</th><th>Rule</th><th>Due date</th><th>Priority</th></tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const allIn = g.items.every((t) => !excluded.has(t.key));
            return (
              <React.Fragment key={g.key}>
                <tr className={styles.groupRow}>
                  {!readOnly && (
                    <td>
                      <input type="checkbox" checked={allIn} onChange={() => onToggleGroup(g.items.map((t) => t.key), !allIn)} aria-label={`Include all of ${g.title}`} />
                    </td>
                  )}
                  <td colSpan={5}>{g.title} <span className={styles.subtle} style={{ fontWeight: 400 }}>· {g.items.filter((t) => !excluded.has(t.key)).length} of {g.items.length}</span></td>
                </tr>
                {g.items.map((t) => {
                  const off = excluded.has(t.key);
                  return (
                    <tr key={t.key} className={off ? styles.inactive : ""}>
                      {!readOnly && (
                        <td><input type="checkbox" checked={!off} onChange={() => onToggle(t.key)} aria-label={`Include ${t.code}`} /></td>
                      )}
                      <td className={styles.mono}>{t.code}</td>
                      <td>
                        {t.name}
                        {t.isOptional && <span className={styles.defaulted}>optional</span>}
                        {off && <div className={styles.note}>Will be kept as Not applicable</div>}
                      </td>
                      <td className={styles.subtle}>{ruleText(t.anchor?.event, t.offsetDays, t.recurrence)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{t.dueDate ? formatLocalDate(t.dueDate) : <span className={styles.subtle}>awaiting date</span>}</td>
                      <td><span className={`${styles.chip} ${PRIORITY_CLASS[t.priority]}`}>{t.priority}</span></td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default TaskPreview;
