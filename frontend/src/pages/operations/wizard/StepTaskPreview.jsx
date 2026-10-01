import React, { useState } from "react";
import TaskPreview from "../../../components/operations/TaskPreview";
import { formatLocalDate } from "../../../utils/opsFormat";
import { newKey } from "./wizardModel";
import styles from "../masters/Masters.module.css";

// Step 5 — Generated tasks with tick boxes, plus one-off (ad-hoc) tasks (features B9, D7)
function StepTaskPreview({ preview, excluded, setExcluded, adhoc, setAdhoc, loading }) {
  const [draft, setDraft] = useState({ name: "", dueDate: "", priority: "MEDIUM" });

  if (loading || !preview) return <div className={styles.empty}>Saving the draft and generating tasks…</div>;

  const toggle = (key) => setExcluded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const toggleGroup = (keys, include) => setExcluded((prev) => {
    const next = new Set(prev);
    keys.forEach((k) => (include ? next.delete(k) : next.add(k)));
    return next;
  });
  const addAdhoc = () => {
    if (!draft.name.trim()) return;
    setAdhoc((list) => [...list, { key: newKey(), name: draft.name.trim(), dueDate: draft.dueDate || null, priority: draft.priority }]);
    setDraft({ name: "", dueDate: "", priority: "MEDIUM" });
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <span className={styles.subtle}>
          {preview.totals.total} tasks generated from the task templates · <b>{preview.totals.total - excluded.size}</b> ticked ·{" "}
          {excluded.size} unticked (kept as Not applicable) · {preview.totals.awaitingDate} awaiting a date
          {adhoc.length > 0 && <> · <b>{adhoc.length}</b> one-off</>}
        </span>
      </div>

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

      <TaskPreview tasks={preview.tasks} excluded={excluded} onToggle={toggle} onToggleGroup={toggleGroup} />
    </div>
  );
}

export default StepTaskPreview;
