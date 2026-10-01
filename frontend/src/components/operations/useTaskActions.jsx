import React, { useState } from "react";
import OpsModal from "./OpsModal";
import { PortDateTimeInput } from "./PortDateTimeInput";
import OpsTaskService from "../../services/OpsTaskService";
import { useToast } from "../../context/ToastContext";
import { DATE_FIELD_LABEL } from "../../utils/opsFormat";
import styles from "../../pages/operations/masters/Masters.module.css";

const fieldLabel = (path) => {
  const parts = path.split(".");
  return DATE_FIELD_LABEL[parts.slice(-2).join(".")] || path;
};

// Status changes that need a question first (shared by the Operations View, the task panel and My Tasks):
//   N/A asks for the reason (D2); Done on a task with a linked field asks for the time to record (C5).
// onChanged(result) runs after every successful change with the API response ({ task, movedTasks, dueSoon }).
export default function useTaskActions(onChanged) {
  const { showToast } = useToast();
  const [na, setNa] = useState(null);         // { task, reason }
  const [linked, setLinked] = useState(null); // { task, info, value, completedDate }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (task, patch, message) => {
    setBusy(true);
    setError("");
    try {
      const res = await OpsTaskService.update(task._id, patch);
      if (message) showToast(message, "success");
      await onChanged(res, task);
      return true;
    } catch (e) {
      setError(e.message);
      showToast(e.message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (task, status) => {
    if (status === task.status) return;
    if (status === "NA") { setError(""); setNa({ task, reason: "" }); return; }
    if (status === "DONE" && task.linkedField) {
      try {
        const full = await OpsTaskService.get(task._id);
        if (full.linked && !full.linked.error) {
          setError("");
          setLinked({ task, info: full.linked, value: full.linked.current || new Date().toISOString() });
          return;
        }
      } catch (e) { /* fall through: complete without asking */ }
    }
    await run(task, { status }, status === "DONE" ? `Done: ${task.baseName || task.name}` : undefined);
  };

  const dialogs = (
    <>
      <OpsModal isOpen={Boolean(na)} title="Mark as Not applicable" onClose={() => setNa(null)} width={520}
        footer={<>
          <button className={styles.btnSecondary} onClick={() => setNa(null)}>Cancel</button>
          <button className={styles.btnPrimary} disabled={busy || !na?.reason.trim()}
            onClick={async () => { if (await run(na.task, { status: "NA", naReason: na.reason.trim() }, "Marked Not applicable")) setNa(null); }}>Mark N/A</button>
        </>}>
        {na && <>
          <p style={{ marginTop: 0 }}><b>{na.task.baseName || na.task.name}</b></p>
          {error && <div className={styles.formError} role="alert">{error}</div>}
          <div className={styles.field}>
            <label>Reason <span className={styles.req}>*</span></label>
            <textarea className={styles.textarea} rows={3} autoFocus value={na.reason} aria-label="Reason"
              onChange={(e) => setNa({ ...na, reason: e.target.value })} placeholder="Why this task does not apply to this voyage" />
          </div>
        </>}
      </OpsModal>

      <OpsModal isOpen={Boolean(linked)} title="Complete task and record the time" onClose={() => setLinked(null)} width={560}
        footer={<>
          <button className={styles.btnSecondary} onClick={() => setLinked(null)}>Cancel</button>
          <button className={styles.btnSecondary} disabled={busy}
            onClick={async () => { if (await run(linked.task, { status: "DONE" }, "Done (no time recorded)")) setLinked(null); }}>Complete without recording</button>
          <button className={styles.btnPrimary} disabled={busy || !linked?.value}
            onClick={async () => { if (await run(linked.task, { status: "DONE", linkedValue: linked.value }, `Done; ${fieldLabel(linked.info.field)} recorded`)) setLinked(null); }}>Complete &amp; record</button>
        </>}>
        {linked && <>
          <p style={{ marginTop: 0 }}><b>{linked.task.baseName || linked.task.name}</b></p>
          {error && <div className={styles.formError} role="alert">{error}</div>}
          <div className={styles.field}>
            <label>{fieldLabel(linked.info.field)}{linked.task.portCall?.port?.name ? ` — ${linked.task.portCall.port.name}` : ""}</label>
            <PortDateTimeInput value={linked.value} zone={linked.info.zone} onChange={(v) => setLinked({ ...linked, value: v })} ariaLabel="Time to record" />
          </div>
          <div className={styles.hint}>
            The time is saved on the voyage{linked.info.current ? " (replacing the value already there)" : ""}. Tasks that depend on it get new due dates, as when the date is edited on the voyage.
          </div>
        </>}
      </OpsModal>
    </>
  );

  return { setStatus, run, dialogs, busy };
}
