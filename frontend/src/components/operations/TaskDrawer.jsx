import React, { useCallback, useEffect, useRef, useState } from "react";
import Select from "react-select";
import OpsModal from "./OpsModal";
import useTaskActions from "./useTaskActions";
import OpsTaskService, { TASK_STATUS_LABEL, TASK_STATUSES } from "../../services/OpsTaskService";
import { useToast } from "../../context/ToastContext";
import { BUCKET_BY_KEY, DATE_FIELD_LABEL, formatInstant, formatLocalDate, ruleText } from "../../utils/opsFormat";
import styles from "../../pages/operations/masters/Masters.module.css";

const FIELD_NAME = {
  status: "Status", priority: "Priority", dueDate: "Due date", dueOverridden: "Due date lock", startDate: "Start date",
  completedDate: "Completed on", assignedTo: "Assigned to", remarks: "Remarks", naReason: "N/A reason", attachment: "File", linkedValue: "Recorded time",
};

function historyText(h, empName, officeTz) {
  const v = (x) => {
    if (x == null || x === "") return "—";
    if (h.field === "status") return TASK_STATUS_LABEL[x] || x;
    if (["dueDate", "startDate", "completedDate"].includes(h.field)) return formatLocalDate(x) || x;
    if (h.field === "assignedTo") return (Array.isArray(x) ? x : [x]).map(empName).join(", ") || "nobody";
    if (h.field === "dueOverridden") return x ? "set by hand" : "follows the rule";
    if (h.field === "linkedValue") return formatInstant(x, officeTz, { withUtc: false });
    return String(x);
  };
  if (h.field === "created") return h.note || "Created";
  if (h.field === "attachment") return `${h.note || "File"}: ${h.to || h.from}`;
  return `${FIELD_NAME[h.field] || h.field}: ${v(h.from)} → ${v(h.to)}`;
}

const fileSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Task panel (D1–D10): details, status, dates, assignees, remarks, files and the full change history.
function TaskDrawer({ taskId, employees = [], officeTz = "Asia/Kolkata", onClose, onChanged }) {
  const { showToast } = useToast();
  const [task, setTask] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    if (!taskId) return;
    try {
      const t = await OpsTaskService.get(taskId);
      setTask(t);
      setForm({
        priority: t.priority, startDate: t.startDate || "", dueDate: t.dueDate || "", completedDate: t.completedDate || "",
        assignedTo: (t.assignedTo || []).map((a) => a._id), remarks: t.remarks || "",
      });
      setError("");
    } catch (e) { setError(e.message); }
  }, [taskId]);
  useEffect(() => { setTask(null); load(); }, [load]);

  const changed = async (res) => { await load(); if (onChanged) await onChanged(res); };
  const { setStatus, dialogs } = useTaskActions(changed);

  if (!taskId) return null;
  const empOptions = employees.map((e) => ({ value: e._id, label: e.employeeName }));
  const empName = (id) => (employees.find((e) => e._id === String(id)) || {}).employeeName || "someone";
  const canEdit = Boolean(task && task.canEdit);

  const save = async () => {
    const patch = {};
    if (form.priority !== task.priority) patch.priority = form.priority;
    if ((form.startDate || null) !== (task.startDate || null)) patch.startDate = form.startDate || null;
    if ((form.dueDate || null) !== (task.dueDate || null)) patch.dueDate = form.dueDate || null;
    if (task.status === "DONE" && form.completedDate && form.completedDate !== task.completedDate) patch.completedDate = form.completedDate;
    if (JSON.stringify(form.assignedTo) !== JSON.stringify((task.assignedTo || []).map((a) => a._id))) patch.assignedTo = form.assignedTo;
    if (form.remarks !== (task.remarks || "")) patch.remarks = form.remarks;
    if (!Object.keys(patch).length) { onClose(); return; }
    setSaving(true);
    try {
      const res = await OpsTaskService.update(task._id, patch);
      showToast("Task saved", "success");
      await changed(res);
      onClose();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const unlock = async () => {
    try {
      const res = await OpsTaskService.update(task._id, { unlockDueDate: true });
      showToast(res.task.dueDate ? `Due date follows the rule again: ${formatLocalDate(res.task.dueDate)}` : "Due date follows the rule again", "success");
      await changed(res);
    } catch (e) { setError(e.message); }
  };

  const upload = async (file) => {
    if (!file) return;
    try {
      await OpsTaskService.uploadAttachment(task._id, file);
      showToast(`${file.name} attached`, "success");
      await changed(null);
    } catch (e) { setError(e.message); }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = async (att) => {
    if (!window.confirm(`Remove ${att.fileName}?`)) return;
    try {
      await OpsTaskService.removeAttachment(task._id, att._id);
      showToast("File removed", "success");
      await changed(null);
    } catch (e) { setError(e.message); }
  };

  const b = task && BUCKET_BY_KEY[task.bucket];
  const history = task ? [...task.history].reverse() : [];

  return (
    <OpsModal isOpen title={task ? (task.baseName || task.name) : "Task"} onClose={onClose} width={860}
      footer={canEdit ? <>
        <button className={styles.btnSecondary} onClick={onClose}>Close</button>
        <button className={styles.btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </> : <button className={styles.btnSecondary} onClick={onClose}>Close</button>}>
      {!task && !error && <div className={styles.empty}>Loading…</div>}
      {error && <div className={styles.formError} role="alert">{error}</div>}
      {task && form && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {task.code && <span className={styles.mono}>{task.code}</span>}
            {b && <span className={styles.chip} style={{ background: b.bg, color: b.color, border: b.border ? `1px dashed ${b.border}` : "none" }}>{b.label}</span>}
            <span className={styles.subtle}>
              {[task.stage?.name, task.portCall?.port?.name, task.anchor?.event ? `Rule: ${ruleText(task.anchor.event, task.offsetDays, task.recurrence)}` : "Ad-hoc task"].filter(Boolean).join(" · ")}
            </span>
            {task.overdueDays > 0 && <span className={`${styles.chip} ${styles.chipHigh}`}>{task.overdueDays} day(s) {task.status === "DONE" ? "late" : "overdue"}</span>}
          </div>
          {!canEdit && <div className={styles.readOnlyBanner}>Read only{task.canEdit === false ? " — you cannot change tasks of this voyage, or the voyage is not active" : ""}.</div>}

          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Status</label>
              <select className={styles.select} value={task.status} disabled={!canEdit} aria-label="Status" onChange={(e) => setStatus(task, e.target.value)}>
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
              </select>
              {task.status === "NA" && <div className={styles.note}>Reason: {task.naReason}</div>}
              {task.linkedField && <div className={styles.hint}>Completing asks for {DATE_FIELD_LABEL[task.linkedField.split(".").slice(-2).join(".")] || task.linkedField}{task.linked?.current ? ` (now ${formatInstant(task.linked.current, task.linked.zone)})` : ""}</div>}
            </div>
            <div className={styles.field}>
              <label>Priority</label>
              <select className={styles.select} value={form.priority} disabled={!canEdit} aria-label="Priority" onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {["HIGH", "MEDIUM", "LOW"].map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Due date {task.dueOverridden && <span className={styles.defaulted}>set by hand</span>}</label>
              <input type="date" className={styles.input} value={form.dueDate} disabled={!canEdit} aria-label="Due date" onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              {task.dueOverridden && task.anchor?.event && canEdit && <button type="button" className={styles.btnLink} onClick={unlock}>Use the rule again ({ruleText(task.anchor.event, task.offsetDays)})</button>}
              {!task.dueOverridden && task.anchor?.event && <div className={styles.hint}>Changing it locks the date: later key-date changes will not move it.</div>}
            </div>
            <div className={styles.field}>
              <label>Start date</label>
              <input type="date" className={styles.input} value={form.startDate} disabled={!canEdit} aria-label="Start date" onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            {task.status === "DONE" && (
              <div className={styles.field}>
                <label>Completed on</label>
                <input type="date" className={styles.input} value={form.completedDate} disabled={!canEdit} aria-label="Completed on" onChange={(e) => setForm({ ...form, completedDate: e.target.value })} />
              </div>
            )}
            <div className={`${styles.field} ${styles.full}`}>
              <label>Assigned to</label>
              <Select isMulti isDisabled={!canEdit} options={empOptions} aria-label="Assigned to" classNamePrefix="assignees"
                value={empOptions.filter((o) => form.assignedTo.includes(o.value))}
                onChange={(v) => setForm({ ...form, assignedTo: (v || []).map((o) => o.value) })} />
            </div>
            <div className={`${styles.field} ${styles.full}`}>
              <label>Remarks</label>
              <textarea className={styles.textarea} rows={3} value={form.remarks} disabled={!canEdit} aria-label="Remarks" onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Files ({task.attachments.length})</div>
            {task.attachments.length === 0 && <div className={styles.subtle}>No files attached</div>}
            {task.attachments.map((a) => (
              <div key={a._id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "3px 0" }}>
                <button className={styles.btnLink} onClick={() => OpsTaskService.downloadAttachment(task._id, a).catch((e) => setError(e.message))}>{a.fileName}</button>
                <span className={styles.subtle}>{fileSize(a.fileSize || 0)} · {a.uploadedBy?.username || ""} · {formatInstant(a.at, officeTz, { withUtc: false })}</span>
                {canEdit && <button className={styles.btnLink} style={{ color: "#d92d20" }} onClick={() => removeFile(a)} aria-label={`Remove ${a.fileName}`}>Remove</button>}
              </div>
            ))}
            {canEdit && <input ref={fileRef} type="file" style={{ marginTop: 6 }} aria-label="Attach a file" onChange={(e) => upload(e.target.files[0])} />}
            {canEdit && <div className={styles.hint}>Up to 20 MB. Files are only visible to people who can see this voyage.</div>}
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>History</div>
            <div style={{ maxHeight: 220, overflowY: "auto", fontSize: "0.85rem" }} data-testid="task-history">
              {history.map((h) => (
                <div key={h._id} style={{ padding: "4px 0", borderBottom: "1px solid #eaecf0", color: h.auto ? "#667085" : undefined }}>
                  <span className={styles.subtle}>{formatInstant(h.at, officeTz, { withUtc: false })} · {h.by?.username || "system"}</span>
                  <div>{historyText(h, empName, officeTz)}{h.note && !["created", "attachment"].includes(h.field) ? <span className={styles.subtle}> — {h.note}</span> : null}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {dialogs}
    </OpsModal>
  );
}

export default TaskDrawer;
