import React, { useState } from "react";
import TaskPreview from "../../../components/operations/TaskPreview";
import OpsVoyageService from "../../../services/OpsVoyageService";
import { useToast } from "../../../context/ToastContext";
import styles from "../masters/Masters.module.css";

// Draft voyage: preview the generated tasks and activate (feature B9)
function ActivatePanel({ voyage, canEdit, onActivated }) {
  const { showToast } = useToast();
  const [preview, setPreview] = useState(null);
  const [excluded, setExcluded] = useState(new Set());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const p = await OpsVoyageService.previewTasks(voyage._id);
      setPreview(p);
      setExcluded(new Set(p.tasks.filter((t) => !t.included).map((t) => t.key)));
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const toggle = (key) => setExcluded((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const toggleGroup = (keys, include) => setExcluded((prev) => { const n = new Set(prev); keys.forEach((k) => (include ? n.delete(k) : n.add(k))); return n; });

  const activate = async () => {
    if (!window.confirm(`Activate ${voyage.voyageNo}? ${preview.tasks.length - excluded.size} tasks will be created. The current dates become the original plan.`)) return;
    setBusy(true);
    try {
      const ex = preview.tasks.filter((t) => excluded.has(t.key)).map((t) => ({ code: t.code, portCall: t.portCall ? t.portCall._id : null }));
      const res = await OpsVoyageService.activate(voyage._id, { excluded: ex });
      showToast(`${res.voyageNo} is active: ${res.activation.created} tasks created`, "success");
      onActivated && onActivated();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!canEdit) return <div className={styles.subtle}>This voyage is a draft. Tasks are generated when it is activated.</div>;
  if (!preview) {
    return (
      <div className={styles.toolbarLeft}>
        <span className={styles.subtle}>This voyage is a draft. Review its tasks and activate it, or continue editing in the form.</span>
        <button className={styles.btnPrimary} onClick={load} disabled={busy}>{busy ? "Loading…" : "Preview tasks"}</button>
      </div>
    );
  }
  return (
    <div>
      <div className={styles.toolbar}>
        <span className={styles.subtle}>{preview.totals.total} tasks generated · <b>{preview.totals.total - excluded.size}</b> ticked · {excluded.size} unticked (kept as Not applicable) · {preview.totals.awaitingDate} awaiting a date</span>
        <div className={styles.toolbarLeft}>
          <button className={styles.btnSecondary} onClick={() => setPreview(null)}>Cancel</button>
          <button className={styles.btnPrimary} onClick={activate} disabled={busy}>{busy ? "Activating…" : "Activate voyage"}</button>
        </div>
      </div>
      <TaskPreview tasks={preview.tasks} excluded={excluded} onToggle={toggle} onToggleGroup={toggleGroup} />
    </div>
  );
}

export default ActivatePanel;
