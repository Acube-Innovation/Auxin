import React from "react";
import TaskPreview from "../../../components/operations/TaskPreview";
import { stepOfTask } from "./wizardModel";
import styles from "../masters/Masters.module.css";

const WHAT = { 1: "cargo", 2: "fixture & vessel", 3: "port" };

// The tasks of one step (Cargo, Fixture & Vessel or Port Rotation), generated from the saved draft, with tick boxes.
// Unticked tasks are kept as Not applicable at activation (features B9, D7).
function StepTasks({ step, preview, excluded, setExcluded, stale, busy, onRefresh }) {
  const tasks = preview ? preview.tasks.filter((t) => stepOfTask(t) === step) : [];
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
  const ticked = tasks.filter((t) => !excluded.has(t.key)).length;

  return (
    <div id="wz-step-tasks">
      <div className={styles.toolbar}>
        <b style={{ color: "#0b3a6f" }}>Tasks for {WHAT[step]}</b>
        {preview && !stale && <span className={styles.subtle}>{tasks.length} tasks · <b>{ticked}</b> ticked · {tasks.length - ticked} unticked (kept as Not applicable)</span>}
        <button type="button" className={styles.btnSecondary} onClick={onRefresh} disabled={busy}>
          {busy ? "Saving…" : preview && !stale ? "Refresh tasks" : "Save & show tasks"}
        </button>
      </div>
      {(!preview || stale) && <div className={styles.hint}>The tasks are generated from the saved draft: save to see them{preview ? " again after your changes" : ""}.</div>}
      {preview && !stale && (tasks.length
        ? <TaskPreview tasks={tasks} excluded={excluded} onToggle={toggle} onToggleGroup={toggleGroup} />
        : <div className={styles.empty}>{step === 3 ? "No port tasks yet: add the ports above and save." : "No tasks for this step."}</div>)}
    </div>
  );
}

export default StepTasks;
