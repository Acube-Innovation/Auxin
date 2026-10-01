import React, { useCallback, useEffect, useMemo, useState } from "react";
import OpsModal from "./OpsModal";
import TaskDrawer from "./TaskDrawer";
import AdhocTaskDialog from "./AdhocTaskDialog";
import useTaskActions from "./useTaskActions";
import OpsVoyageService from "../../services/OpsVoyageService";
import OpsTaskService, { TASK_STATUS_LABEL, TASK_STATUSES } from "../../services/OpsTaskService";
import OpsMasterService from "../../services/OpsMasterService";
import EmployeeService from "../../services/EmployeeService";
import { useToast } from "../../context/ToastContext";
import { BUCKETS, BUCKET_BY_KEY, formatLocalDate, ruleText } from "../../utils/opsFormat";
import styles from "../../pages/operations/masters/Masters.module.css";
import ov from "./OperationsView.module.css";

export function BucketChip({ bucket }) {
  const b = BUCKET_BY_KEY[bucket];
  if (!b) return null;
  return <span className={styles.chip} style={{ background: b.bg, color: b.color, border: b.border ? `1px dashed ${b.border}` : "none" }}>{b.label}</span>;
}

export function PriorityTag({ value }) {
  return <span className={`${ov.pri} ${ov[`pri${value}`]}`}>{value === "MEDIUM" ? "MED" : value}</span>;
}

const OPEN = ["NOT_STARTED", "INITIATED", "AWAITING"];

// Operations View (G1, D1–D8): the voyage's tasks by stage and port, colour buckets, filters,
// inline status, one-click Done, bulk changes, ad-hoc tasks and the task panel.
function OperationsView({ voyage, editable, refreshKey, initialBucket = "", officeTz, onChanged, openTaskId = "", onTaskClosed }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [bucket, setBucket] = useState(initialBucket);
  const [filters, setFilters] = useState({ search: "", stage: "", portCall: "", status: "", assignee: "" });
  const [selected, setSelected] = useState(new Set());
  const [openTask, setOpenTask] = useState(null);
  const [adding, setAdding] = useState(false);
  const [bulkDialog, setBulkDialog] = useState(null); // { kind: 'NA' | 'due', value }
  const [employees, setEmployees] = useState([]);
  const [stages, setStages] = useState([]);
  const [me, setMe] = useState(null);
  useEffect(() => { setBucket(initialBucket); }, [initialBucket]);
  // Links from notifications: /operations/voyages/:id?tab=tasks&task=<taskId>
  useEffect(() => { if (openTaskId) setOpenTask(openTaskId); }, [openTaskId]);

  useEffect(() => {
    EmployeeService.getEmployees().then((l) => setEmployees(Array.isArray(l) ? l : [])).catch(() => {});
    OpsMasterService.getStages().then(setStages).catch(() => {});
    OpsMasterService.getMeta().then((m) => setMe(m.myEmployeeId || null)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    OpsVoyageService.getTasks(voyage._id).then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message));
  }, [voyage._id]);
  useEffect(() => { load(); }, [load, refreshKey]);

  // The workspace reloads the voyage (and with it this list) and shows which due dates moved
  const changed = async (res) => {
    if (onChanged) await onChanged(res);
    else load();
  };
  const { setStatus, dialogs } = useTaskActions(changed);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = filters.search.trim().toLowerCase();
    return data.tasks.filter((t) => (!filters.stage || (filters.stage === "none" ? !t.stage : t.stage?._id === filters.stage))
      && (!filters.portCall || (filters.portCall === "voyage" ? !t.portCall : t.portCall?._id === filters.portCall))
      && (!filters.status || (filters.status === "OPEN" ? OPEN.includes(t.status) : t.status === filters.status))
      && (!filters.assignee || (t.assignedTo || []).some((a) => a._id === filters.assignee))
      && (!q || `${t.code || ""} ${t.name}`.toLowerCase().includes(q)));
  }, [data, filters]);
  const rows = useMemo(() => filtered.filter((t) => !bucket || t.bucket === bucket), [filtered, bucket]);
  const counts = useMemo(() => {
    const c = {};
    for (const t of filtered) c[t.bucket] = (c[t.bucket] || 0) + 1;
    return c;
  }, [filtered]);

  // Selection survives filtering only for rows that are still shown
  const shownIds = useMemo(() => new Set(rows.map((t) => t._id)), [rows]);
  const sel = [...selected].filter((id) => shownIds.has(id));
  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allShown = rows.length > 0 && rows.every((t) => selected.has(t._id));

  const bulk = async (patch, label) => {
    try {
      const res = await OpsTaskService.bulk(sel, patch);
      showToast(`${label}: ${res.updated} task${res.updated === 1 ? "" : "s"}${res.skipped.length ? ` · ${res.skipped.length} skipped (${res.skipped[0].reason})` : ""}`, res.skipped.length ? "warning" : "success");
      setSelected(new Set());
      setBulkDialog(null);
      await changed(null);
    } catch (e) { showToast(e.message, "error"); }
  };

  const addTask = async (body) => {
    const t = await OpsTaskService.addAdhoc(voyage._id, body);
    showToast(`Task added${t.dueDate ? `, due ${formatLocalDate(t.dueDate)}` : ""}`, "success");
    setAdding(false);
    await changed(null);
  };

  if (error) return <div className={styles.formError}>{error}</div>;
  if (!data) return <div className={styles.empty}>Loading tasks…</div>;

  const setF = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const calls = (voyage.portCalls || []).filter((p) => p.status !== "CANCELLED");
  const cols = editable ? 9 : 7;
  let lastGroup = null;

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <button className={styles.btnLink} style={{ fontWeight: bucket ? 400 : 700 }} onClick={() => setBucket("")}>All ({filtered.length})</button>
        {BUCKETS.map((b) => (
          <button key={b.key} onClick={() => setBucket(bucket === b.key ? "" : b.key)} className={styles.chip}
            style={{ cursor: "pointer", background: b.bg, color: b.color, border: bucket === b.key ? `2px solid ${b.color}` : b.border ? `1px dashed ${b.border}` : "1px solid transparent" }}>
            {b.label} {counts[b.key] || 0}
          </button>
        ))}
        <span className={styles.subtle}>Today (office time): {formatLocalDate(data.today)}</span>
      </div>

      <div className={ov.filters}>
        <input className={styles.search} placeholder="Search task or code" value={filters.search} onChange={setF("search")} aria-label="Search tasks" />
        <select className={styles.select} value={filters.stage} onChange={setF("stage")} aria-label="Stage filter">
          <option value="">All stages</option>
          {stages.map((s) => <option key={s._id} value={s._id}>{s.order}. {s.name}</option>)}
          <option value="none">Ad-hoc (no stage)</option>
        </select>
        <select className={styles.select} value={filters.portCall} onChange={setF("portCall")} aria-label="Port filter">
          <option value="">All ports</option>
          <option value="voyage">Voyage-level only</option>
          {calls.map((p) => <option key={p._id} value={p._id}>{p.port?.name}</option>)}
        </select>
        <select className={styles.select} value={filters.status} onChange={setF("status")} aria-label="Status filter">
          <option value="">Any status</option>
          <option value="OPEN">Open (not done)</option>
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
        </select>
        <select className={styles.select} value={filters.assignee} onChange={setF("assignee")} aria-label="Assignee filter">
          <option value="">Anyone</option>
          {me && <option value={me}>Me</option>}
          {employees.filter((e) => e._id !== me).map((e) => <option key={e._id} value={e._id}>{e.employeeName}</option>)}
        </select>
        {Object.values(filters).some(Boolean) && <button className={styles.btnLink} onClick={() => setFilters({ search: "", stage: "", portCall: "", status: "", assignee: "" })}>Clear filters</button>}
        <span style={{ flex: 1 }} />
        {editable && <button className={styles.btnPrimary} onClick={() => setAdding(true)}>+ Add task</button>}
      </div>

      {editable && sel.length > 0 && (
        <div className={ov.bulkBar} role="toolbar" aria-label="Bulk actions">
          <b>{sel.length} selected</b>
          <button className={ov.doneBtn} onClick={() => bulk({ status: "DONE" }, "Marked done")}>✓ Mark done</button>
          <button className={styles.btnSecondary} onClick={() => bulk({ status: "INITIATED" }, "Marked initiated")}>Initiated</button>
          <button className={styles.btnSecondary} onClick={() => setBulkDialog({ kind: "NA", value: "" })}>Not applicable…</button>
          <select className={ov.rowSelect} value="" onChange={(e) => e.target.value && bulk({ priority: e.target.value }, "Priority changed")} aria-label="Set priority">
            <option value="">Priority…</option>
            {["HIGH", "MEDIUM", "LOW"].map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
          </select>
          <select className={ov.rowSelect} value="" onChange={(e) => e.target.value && bulk({ addAssignees: [e.target.value] }, "Assignee added")} aria-label="Add assignee">
            <option value="">Assign to…</option>
            {employees.map((e) => <option key={e._id} value={e._id}>{e.employeeName}</option>)}
          </select>
          <button className={styles.btnSecondary} onClick={() => setBulkDialog({ kind: "due", value: "" })}>Due date…</button>
          <button className={styles.btnLink} onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className={styles.tableWrap} style={{ maxHeight: 560, overflowY: "auto" }}>
        <table className={styles.table}>
          <thead>
            <tr>
              {editable && <th style={{ width: 28 }}><input type="checkbox" aria-label="Select all shown" checked={allShown}
                onChange={() => setSelected(allShown ? new Set() : new Set(rows.map((t) => t._id)))} /></th>}
              <th className={ov.hideSm}>Code</th><th>Task</th><th>Due</th><th>Status</th><th>When</th><th className={ov.hideSm}>Priority</th><th className={ov.hideSm}>Assigned</th>
              {editable && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols} className={styles.empty}>No tasks match</td></tr>}
            {rows.map((t) => {
              const group = t.stage ? `${t.stage.order}. ${t.stage.name}${t.portCall ? ` — ${t.portCall.port?.name}` : ""}` : `Ad-hoc tasks${t.portCall ? ` — ${t.portCall.port?.name}` : ""}`;
              const header = group !== lastGroup;
              lastGroup = group;
              const closed = t.status === "DONE" || t.status === "NA";
              return (
                <React.Fragment key={t._id}>
                  {header && <tr className={styles.groupRow}><td colSpan={cols}>{group}</td></tr>}
                  <tr className={t.status === "NA" ? styles.inactive : ""} data-task={t.code || t.baseName}>
                    {editable && <td><input type="checkbox" checked={selected.has(t._id)} onChange={() => toggle(t._id)} aria-label={`Select ${t.baseName || t.name}`} /></td>}
                    <td className={`${styles.mono} ${ov.hideSm}`}>{t.code || "—"}</td>
                    <td>
                      <button className={ov.taskName} onClick={() => setOpenTask(t._id)} style={closed ? { textDecoration: t.status === "DONE" ? "line-through" : "none", color: "#667085" } : undefined}>{t.baseName || t.name}</button>
                      {t.dueOverridden && <span className={styles.defaulted}>date set by hand</span>}
                      {t.linkedField && !closed && <span className={styles.defaulted} title="Completing asks for a date/time that is saved on the voyage">records time</span>}
                      {(t.attachments || []).length > 0 && <span className={styles.subtle}> 📎{t.attachments.length}</span>}
                      {t.naReason && <div className={styles.note}>{t.naReason}</div>}
                      {t.remarks && <div className={styles.note}>{t.remarks}</div>}
                      <div className={styles.note}>{t.anchor?.event ? ruleText(t.anchor.event, t.offsetDays, t.recurrence) : ""}</div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{t.dueDate ? formatLocalDate(t.dueDate) : <span className={styles.subtle}>—</span>}
                      {t.status === "DONE" && t.completedDate && <div className={styles.note}>done {formatLocalDate(t.completedDate)}</div>}</td>
                    <td>
                      {editable ? (
                        <select className={ov.rowSelect} value={t.status} onChange={(e) => setStatus(t, e.target.value)} aria-label={`Status of ${t.baseName || t.name}`}>
                          {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
                        </select>
                      ) : TASK_STATUS_LABEL[t.status]}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <BucketChip bucket={t.bucket} />
                      {t.overdueDays > 0 && <div className={styles.note}>{t.overdueDays} day(s) {t.status === "DONE" ? "late" : "overdue"}</div>}
                      {t.dueInDays != null && !closed && <div className={styles.note}>due in {t.dueInDays} day(s)</div>}
                    </td>
                    <td className={ov.hideSm}><PriorityTag value={t.priority} /></td>
                    <td className={`${styles.subtle} ${ov.hideSm}`}>{(t.assignedTo || []).map((a) => a.employeeName).join(", ") || "—"}</td>
                    {editable && <td>{!closed && <button className={ov.doneBtn} onClick={() => setStatus(t, "DONE")} aria-label={`Mark ${t.baseName || t.name} done`}>✓ Done</button>}</td>}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={styles.hint} style={{ marginTop: 8 }}>
        Click a task to see its details, files and history. {editable ? "“✓ Done” records today as the completion date; open the task to choose another date." : "Read only."}
      </div>

      {openTask && <TaskDrawer taskId={openTask} employees={employees} officeTz={officeTz} onClose={() => { setOpenTask(null); if (onTaskClosed) onTaskClosed(); }} onChanged={changed} />}
      {adding && <AdhocTaskDialog voyage={voyage} stages={stages} employees={employees} myEmployeeId={me} onClose={() => setAdding(false)} onSubmit={addTask} />}
      <OpsModal isOpen={Boolean(bulkDialog)} title={bulkDialog?.kind === "NA" ? `Mark ${sel.length} task(s) Not applicable` : `Set the due date of ${sel.length} task(s)`}
        onClose={() => setBulkDialog(null)} width={500}
        footer={<>
          <button className={styles.btnSecondary} onClick={() => setBulkDialog(null)}>Cancel</button>
          <button className={styles.btnPrimary} disabled={!bulkDialog?.value?.trim()}
            onClick={() => (bulkDialog.kind === "NA" ? bulk({ status: "NA", naReason: bulkDialog.value.trim() }, "Marked N/A") : bulk({ dueDate: bulkDialog.value }, "Due date set"))}>Apply</button>
        </>}>
        {bulkDialog?.kind === "NA" && (
          <div className={styles.field}>
            <label>Reason <span className={styles.req}>*</span></label>
            <textarea className={styles.textarea} rows={3} value={bulkDialog.value} onChange={(e) => setBulkDialog({ ...bulkDialog, value: e.target.value })} aria-label="Reason" autoFocus />
          </div>
        )}
        {bulkDialog?.kind === "due" && (
          <div className={styles.field}>
            <label>Due date</label>
            <input type="date" className={styles.input} value={bulkDialog.value} onChange={(e) => setBulkDialog({ ...bulkDialog, value: e.target.value })} aria-label="Due date" />
            <div className={styles.hint}>These dates become “set by hand”: later key-date changes will not move them.</div>
          </div>
        )}
      </OpsModal>
      {dialogs}
    </div>
  );
}

export default OperationsView;
