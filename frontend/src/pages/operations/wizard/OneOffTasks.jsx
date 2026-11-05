import React, { useState } from "react";
import { formatLocalDate } from "../../../utils/opsFormat";
import { newKey } from "./wizardModel";
import styles from "../masters/Masters.module.css";

// One-off (ad-hoc) tasks for this voyage only, added at activation (feature D7)
function OneOffTasks({ adhoc, setAdhoc }) {
  const [draft, setDraft] = useState({ name: "", dueDate: "", priority: "MEDIUM" });
  const addAdhoc = () => {
    if (!draft.name.trim()) return;
    setAdhoc((list) => [...list, { key: newKey(), name: draft.name.trim(), dueDate: draft.dueDate || null, priority: draft.priority }]);
    setDraft({ name: "", dueDate: "", priority: "MEDIUM" });
  };
  return (
    <div className={styles.card} style={{ padding: "0.8rem 1rem", marginBottom: 12 }}>
      <b>One-off tasks for this voyage</b> <span className={styles.subtle}>(not in the template library)</span>
      <div className={styles.ruleRow} style={{ marginTop: 8 }}>
        <input className={styles.input} style={{ flex: 2, minWidth: 200 }} placeholder="Task, e.g. Check port congestion report" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="One-off task name" />
        <input className={styles.input} style={{ width: 160 }} type="date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} aria-label="One-off task due date" />
        <select className={styles.select} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} aria-label="One-off task priority">
          <option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
        </select>
        <button type="button" className={styles.btnSecondary} onClick={addAdhoc} disabled={!draft.name.trim()}>Add</button>
      </div>
      {adhoc.map((a) => (
        <div key={a.key} className={styles.ruleRow} style={{ marginTop: 6, fontSize: "0.88rem" }}>
          <span>• {a.name}</span>
          <span className={styles.subtle}>{a.dueDate ? `due ${formatLocalDate(a.dueDate)}` : "no due date"} · {a.priority.toLowerCase()}</span>
          <button type="button" className={styles.btnLink} style={{ color: "#d92d20" }} onClick={() => setAdhoc((l) => l.filter((x) => x.key !== a.key))} aria-label={`Remove ${a.name}`}>✕</button>
        </div>
      ))}
    </div>
  );
}

export default OneOffTasks;
