import React, { useState } from "react";
import Select from "react-select";
import OpsModal from "./OpsModal";
import { ANCHOR_SHORT, PORT_TYPE_LABEL } from "../../utils/opsFormat";
import styles from "../../pages/operations/masters/Masters.module.css";

const PORT_EVENTS = ["ARRIVAL", "BERTHING", "OPS_COMPLETED", "SAILING"];

// Add a one-off task to an active voyage (D7): fixed due date, or a rule from a key date.
function AdhocTaskDialog({ voyage, stages = [], employees = [], myEmployeeId, onClose, onSubmit }) {
  const calls = (voyage.portCalls || []).filter((p) => p.status !== "CANCELLED");
  const [form, setForm] = useState({
    name: "", stage: "", portCall: "", mode: "date", dueDate: "", anchor: "ARRIVAL", offsetDays: 0, priority: "MEDIUM",
    assignedTo: myEmployeeId ? [myEmployeeId] : (voyage.operators || []).map((o) => o._id), remarks: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e && e.target ? e.target.value : e });
  const empOptions = employees.map((e) => ({ value: e._id, label: e.employeeName }));
  const events = form.portCall ? Object.keys(ANCHOR_SHORT) : Object.keys(ANCHOR_SHORT).filter((e) => !PORT_EVENTS.includes(e));

  const submit = async () => {
    if (!form.name.trim()) return setError("Enter the task name");
    if (form.mode === "date" && !form.dueDate) return setError("Choose the due date, or switch to a rule");
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        name: form.name.trim(), stage: form.stage || null, portCall: form.portCall || null, priority: form.priority,
        assignedTo: form.assignedTo, remarks: form.remarks,
        ...(form.mode === "date" ? { dueDate: form.dueDate } : { anchor: { event: form.anchor }, offsetDays: Number(form.offsetDays) || 0 }),
      });
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <OpsModal isOpen title="Add a task to this voyage" onClose={onClose} width={720}
      footer={<>
        <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
        <button className={styles.btnPrimary} onClick={submit} disabled={saving}>{saving ? "Adding…" : "Add task"}</button>
      </>}>
      {error && <div className={styles.formError} role="alert">{error}</div>}
      <div className={styles.formGrid}>
        <div className={`${styles.field} ${styles.full}`}>
          <label>Task <span className={styles.req}>*</span></label>
          <input className={styles.input} value={form.name} onChange={set("name")} aria-label="Task name" autoFocus />
        </div>
        <div className={styles.field}>
          <label>Stage</label>
          <select className={styles.select} value={form.stage} onChange={set("stage")} aria-label="Stage">
            <option value="">— none (ad-hoc group) —</option>
            {stages.map((s) => <option key={s._id} value={s._id}>{s.order}. {s.name}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label>Port call</label>
          <select className={styles.select} value={form.portCall} onChange={set("portCall")} aria-label="Port call">
            <option value="">— whole voyage —</option>
            {calls.map((p) => <option key={p._id} value={p._id}>{p.port?.name} ({PORT_TYPE_LABEL[p.type]})</option>)}
          </select>
        </div>
        <div className={`${styles.field} ${styles.full}`}>
          <label>Due</label>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontWeight: 400 }}><input type="radio" checked={form.mode === "date"} onChange={() => setForm({ ...form, mode: "date" })} /> On a date</label>
            <label style={{ fontWeight: 400 }}><input type="radio" checked={form.mode === "rule"} onChange={() => setForm({ ...form, mode: "rule" })} /> From a key date (moves when it changes)</label>
          </div>
          {form.mode === "date" ? (
            <input type="date" className={styles.input} value={form.dueDate} onChange={set("dueDate")} aria-label="Due date" style={{ maxWidth: 220, marginTop: 6 }} />
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
              <select className={styles.select} value={events.includes(form.anchor) ? form.anchor : events[0]} onChange={set("anchor")} aria-label="Key date">
                {events.map((e) => <option key={e} value={e}>{ANCHOR_SHORT[e]}</option>)}
              </select>
              <input type="number" className={styles.input} style={{ width: 90 }} value={form.offsetDays} onChange={set("offsetDays")} aria-label="Days from the key date" />
              <span className={styles.subtle}>days (negative = before)</span>
            </div>
          )}
        </div>
        <div className={styles.field}>
          <label>Priority</label>
          <select className={styles.select} value={form.priority} onChange={set("priority")} aria-label="Priority">
            {["HIGH", "MEDIUM", "LOW"].map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label>Assigned to</label>
          <Select isMulti options={empOptions} value={empOptions.filter((o) => form.assignedTo.includes(o.value))}
            onChange={(v) => setForm({ ...form, assignedTo: (v || []).map((o) => o.value) })} aria-label="Assigned to" classNamePrefix="assignees" />
        </div>
        <div className={`${styles.field} ${styles.full}`}>
          <label>Remarks</label>
          <textarea className={styles.textarea} rows={2} value={form.remarks} onChange={set("remarks")} aria-label="Remarks" />
        </div>
      </div>
    </OpsModal>
  );
}

export default AdhocTaskDialog;
