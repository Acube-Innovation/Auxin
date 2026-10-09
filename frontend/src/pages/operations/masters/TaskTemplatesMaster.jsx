import React, { useCallback, useEffect, useMemo, useState } from "react";
import OpsModal from "../../../components/operations/OpsModal";
import OpsMasterService from "../../../services/OpsMasterService";
import { useToast } from "../../../context/ToastContext";
import { addDays, formatLocalDate, plannedText, ruleText, ANCHOR_SHORT, PORT_TYPE_LABEL } from "../../../utils/opsFormat";
import styles from "./Masters.module.css";

const PRIORITY_CLASS = { HIGH: styles.chipHigh, MEDIUM: styles.chipMedium, LOW: styles.chipLow, NONE: styles.chipNone };
const SOURCE_CLASS = { EXCEL: styles.chipExcel, PROPOSED: styles.chipProposed, CORRECTED: styles.chipCorrected, USER: styles.chipUser };
const SOURCE_LABEL = { EXCEL: "Excel", PROPOSED: "Proposed", CORRECTED: "Corrected", USER: "Added in app" };
const REMINDER_HINT = {
  HIGH: "1 day before, on the due date, and daily while overdue",
  MEDIUM: "On the due date, and daily while overdue",
  LOW: "On the due date only",
  NONE: "No reminders",
};
const BASIS_LABEL = { BEST: "Best known date (actual if entered, else estimate)", ESTIMATE: "Estimate only", ACTUAL: "Actual only (no due date until the actual is entered)" };
const SAMPLE_DATE = "2026-07-05";

const emptyForm = (stageId) => ({
  name: "", instructions: "", stage: stageId || "", event: "", direction: "after", days: 1, basis: "BEST",
  recurring: false, everyDays: 15, until: "", plannedHours: "", defaultPriority: "MEDIUM", reminderProfile: "MEDIUM", defaultRole: "",
  isOptional: false, linkedField: "", autoCompleteOnField: false, voyageTypes: [], isActive: true,
});

function toForm(t) {
  const off = Number(t.offsetDays || 0);
  return {
    name: t.name, instructions: t.instructions || "", stage: t.stage?._id || t.stage, event: t.anchor?.event || "",
    direction: off === 0 ? "on" : off < 0 ? "before" : "after", days: Math.abs(off), basis: t.anchor?.basis || "BEST",
    recurring: Boolean(t.recurrence?.everyDays), everyDays: t.recurrence?.everyDays || 15, until: t.recurrence?.until || "",
    plannedHours: t.plannedHours ?? "", defaultPriority: t.defaultPriority, reminderProfile: t.reminderProfile, defaultRole: t.defaultRole || "",
    isOptional: t.isOptional, linkedField: t.linkedField || "", autoCompleteOnField: t.autoCompleteOnField,
    voyageTypes: t.voyageTypes || [], isActive: t.isActive,
  };
}

const offsetOf = (f) => (f.direction === "on" ? 0 : (f.direction === "before" ? -1 : 1) * Math.abs(parseInt(f.days, 10) || 0));

// Task template library (feature A4)
function TaskTemplatesMaster({ canEdit, meta }) {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sampleDate, setSampleDate] = useState(SAMPLE_DATE);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, s] = await Promise.all([OpsMasterService.getTaskTemplates(), OpsMasterService.getStages()]);
      setTemplates(t);
      setStages(s);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const stageById = useMemo(() => new Map(stages.map((s) => [s._id, s])), [stages]);
  const linkedLabel = useMemo(() => new Map((meta?.linkedFields || []).map((f) => [f.value, f.label])), [meta]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) =>
      (!stageFilter || t.stage?._id === stageFilter) &&
      (!sourceFilter || t.sourceTag === sourceFilter) &&
      (statusFilter === "all" || (statusFilter === "active" ? t.isActive : !t.isActive)) &&
      (!q || t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)));
  }, [templates, stageFilter, sourceFilter, statusFilter, search]);

  const grouped = useMemo(() => {
    const groups = [];
    let current = null;
    for (const t of filtered) {
      if (!current || current.stage._id !== t.stage?._id) {
        current = { stage: t.stage || { _id: "none", name: "No stage" }, items: [] };
        groups.push(current);
      }
      current.items.push(t);
    }
    return groups;
  }, [filtered]);

  const summary = useMemo(() => ({
    total: templates.length,
    active: templates.filter((t) => t.isActive).length,
    proposed: templates.filter((t) => t.sourceTag === "PROPOSED").length,
    corrected: templates.filter((t) => t.sourceTag === "CORRECTED").length,
    defaulted: templates.filter((t) => t.priorityDefaulted).length,
  }), [templates]);

  // Drag re-ordering is only safe when the full list of a stage is visible
  const canDrag = canEdit && !search && !sourceFilter && statusFilter === "all";

  const onDrop = async (target) => {
    const dragged = templates.find((t) => t._id === dragId);
    setDragId(null);
    setOverId(null);
    if (!dragged || dragged._id === target._id || dragged.stage?._id !== target.stage?._id) {
      if (dragged && dragged.stage?._id !== target.stage?._id) showToast("Tasks can only be re-ordered within their own stage", "info");
      return;
    }
    const stageId = target.stage._id;
    const original = templates.filter((t) => t.stage?._id === stageId).map((t) => t._id);
    const movingDown = original.indexOf(dragged._id) < original.indexOf(target._id);
    const ids = original.filter((id) => id !== dragged._id);
    // Dragging down drops below the target row, dragging up drops above it
    ids.splice(ids.indexOf(target._id) + (movingDown ? 1 : 0), 0, dragged._id);
    const order = new Map(ids.map((id, i) => [id, (i + 1) * 10]));
    setTemplates((prev) => {
      const next = prev.map((t) => (order.has(t._id) ? { ...t, sortOrder: order.get(t._id) } : t));
      return next.sort((a, b) => (a.stage?.order ?? 999) - (b.stage?.order ?? 999) || a.sortOrder - b.sortOrder);
    });
    try {
      await OpsMasterService.reorderTaskTemplates(ids);
      showToast("Order saved", "success");
    } catch (e) {
      showToast(`Order not saved: ${e.message}`, "error");
      load();
    }
  };

  const openForm = (template) => {
    setFormError("");
    setEditing(template || "new");
    setForm(template ? toForm(template) : emptyForm(stageFilter || stages[0]?._id));
  };

  const selectedStage = stageById.get(form.stage);
  const eventOptions = (meta?.anchorEvents || []).filter((e) => e.scope === "VOYAGE" || selectedStage?.scope === "PORT_CALL");

  const save = async () => {
    if (!form.name.trim()) return setFormError("Task name is required");
    if (!form.stage) return setFormError("Choose a stage");
    if (!form.event) return setFormError("Choose the key date the due date is calculated from");
    if (form.direction !== "on" && !(parseInt(form.days, 10) > 0)) return setFormError("Enter the number of days (1 or more), or choose “on the day”");
    if (form.recurring && !(parseInt(form.everyDays, 10) > 0)) return setFormError("Enter how often the task repeats");
    if (form.plannedHours !== "" && !(Number(form.plannedHours) >= 0)) return setFormError("Planned hours must be a number of 0 or more");
    setSaving(true);
    setFormError("");
    const payload = {
      name: form.name.trim(),
      instructions: form.instructions,
      stage: form.stage,
      anchor: { event: form.event, basis: form.basis },
      offsetDays: offsetOf(form),
      recurrence: form.recurring ? { everyDays: parseInt(form.everyDays, 10), until: form.until || null } : { everyDays: null, until: null },
      plannedHours: form.plannedHours === "" ? null : Number(form.plannedHours),
      defaultPriority: form.defaultPriority,
      reminderProfile: form.reminderProfile,
      defaultRole: form.defaultRole || null,
      isOptional: form.isOptional,
      linkedField: form.linkedField || null,
      autoCompleteOnField: Boolean(form.linkedField) && form.autoCompleteOnField,
      voyageTypes: form.voyageTypes,
      isActive: form.isActive,
    };
    try {
      if (editing === "new") await OpsMasterService.createTaskTemplate(payload);
      else await OpsMasterService.updateTaskTemplate(editing._id, payload);
      showToast(`Task template "${payload.name}" saved`, "success");
      setEditing(null);
      load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "defaultPriority") next.reminderProfile = value; // reminders follow priority unless changed after
      if (key === "stage") {
        const st = stageById.get(value);
        const ev = (meta?.anchorEvents || []).find((x) => x.value === f.event);
        if (st?.scope === "VOYAGE" && ev?.scope === "PORT_CALL") next.event = "";
      }
      if (key === "direction" && value === "on") next.days = 0;
      if (key === "direction" && value !== "on" && !(parseInt(f.days, 10) > 0)) next.days = 1;
      return next;
    });
  };

  const toggleVoyageType = (vt) => setForm((f) => ({
    ...f, voyageTypes: f.voyageTypes.includes(vt) ? f.voyageTypes.filter((x) => x !== vt) : [...f.voyageTypes, vt],
  }));

  // Preview: the due date for a sample key date (and the next few recurring instances)
  const preview = useMemo(() => {
    if (!form.event || !/^\d{4}-\d{2}-\d{2}$/.test(sampleDate)) return null;
    const off = offsetOf(form);
    const first = addDays(sampleDate, off);
    const dates = [first];
    if (form.recurring && parseInt(form.everyDays, 10) > 0) {
      for (let k = 1; k < 3; k++) dates.push(addDays(first, k * parseInt(form.everyDays, 10)));
    }
    return { off, dates };
  }, [form, sampleDate]);

  return (
    <div className={styles.card}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.cardTitle}>Task Templates</div>
          <span className={styles.subtle}>
            {summary.active} active of {summary.total} · {summary.proposed} proposed · {summary.corrected} corrected · {summary.defaulted} with default priority
          </span>
        </div>
        {canEdit && <button className={styles.btnPrimary} onClick={() => openForm(null)}>+ Add Task Template</button>}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <input className={styles.search} placeholder="Search task or code" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className={styles.select} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} aria-label="Stage">
            <option value="">All stages</option>
            {stages.map((s) => <option key={s._id} value={s._id}>{s.order}. {s.name}</option>)}
          </select>
          <select className={styles.select} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} aria-label="Source">
            <option value="">All sources</option>
            <option value="EXCEL">From the Excel sheet</option>
            <option value="PROPOSED">Proposed (awaiting client confirmation)</option>
            <option value="CORRECTED">Corrected (awaiting client confirmation)</option>
            <option value="USER">Added in app</option>
          </select>
          <select className={styles.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
        </div>
        {canEdit && <span className={styles.subtle}>{canDrag ? "Drag ⠿ to re-order within a stage" : "To re-order, set Status to “All” and clear search and source"}</span>}
      </div>
      {!canEdit && <div className={styles.readOnlyBanner}>View only. Admin and the chartering / operations &amp; pricing managers can edit task templates.</div>}
      <div className={styles.hint} style={{ marginBottom: "0.75rem" }}>Changes apply to voyages created afterwards. Running voyages keep the tasks they were created with.</div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {canDrag && <th style={{ width: 24 }} />}
              <th>Code</th><th>Task</th><th>Due date rule</th><th>Planned hours</th><th>Priority</th><th>Options</th><th>Source</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className={styles.empty}>Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={9} className={styles.empty}>No task templates match these filters</td></tr>}
            {grouped.map((g) => (
              <React.Fragment key={g.stage._id}>
                <tr className={styles.groupRow}>
                  <td colSpan={canDrag ? 9 : 8}>
                    {g.stage.order}. {g.stage.name}
                    <span className={styles.subtle} style={{ fontWeight: 400, marginLeft: 8 }}>
                      {g.stage.scope === "PORT_CALL" ? `repeats for every ${PORT_TYPE_LABEL[g.stage.portType]?.toLowerCase()} call` : "once per voyage"} · {g.items.length} task{g.items.length === 1 ? "" : "s"}
                    </span>
                  </td>
                </tr>
                {g.items.map((t) => (
                  <tr
                    key={t._id}
                    className={`${canEdit ? styles.clickable : ""} ${t.isActive ? "" : styles.inactive} ${dragId === t._id ? styles.dragging : ""} ${overId === t._id && dragId !== t._id ? styles.dropTarget : ""}`}
                    onClick={() => canEdit && openForm(t)}
                    draggable={canDrag}
                    onDragStart={(e) => { setDragId(t._id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={(e) => { if (canDrag) { e.preventDefault(); setOverId(t._id); } }}
                    onDragEnd={() => { setDragId(null); setOverId(null); }}
                    onDrop={(e) => { e.preventDefault(); onDrop(t); }}
                  >
                    {canDrag && <td className={styles.handle} title="Drag to re-order">⠿</td>}
                    <td className={styles.mono}>{t.code}</td>
                    <td>
                      {t.name}
                      {t.instructions && <div className={styles.note}>{t.instructions}</div>}
                    </td>
                    <td>
                      {ruleText(t.anchor?.event, t.offsetDays, t.recurrence)}
                      {t.anchor?.basis && t.anchor.basis !== "BEST" && <div className={styles.note}>{t.anchor.basis === "ACTUAL" ? "actual date only" : "estimate only"}</div>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }} className={t.plannedHours == null ? styles.subtle : ""}>{plannedText(t.plannedHours)}</td>
                    <td>
                      <span className={`${styles.chip} ${PRIORITY_CLASS[t.defaultPriority]}`}>{t.defaultPriority}</span>
                      {t.priorityDefaulted && <span className={styles.defaulted} title="The sheet gave no priority; Medium is the default until the client confirms">default</span>}
                    </td>
                    <td className={styles.subtle}>
                      {[t.isOptional && "Optional", t.linkedField && `Captures: ${linkedLabel.get(t.linkedField) || t.linkedField}`, t.recurrence?.everyDays && "Recurring"].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td>
                      <span className={`${styles.chip} ${SOURCE_CLASS[t.sourceTag]}`}>{SOURCE_LABEL[t.sourceTag]}</span>
                      {t.sourceNote && <div className={styles.note}>{t.sourceNote}</div>}
                    </td>
                    <td><span className={`${styles.chip} ${t.isActive ? styles.chipActive : styles.chipInactive}`}>{t.isActive ? "Active" : "Inactive"}</span></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <OpsModal
        isOpen={Boolean(editing)}
        title={editing === "new" ? "Add Task Template" : `Edit ${editing?.code} – ${editing?.name}`}
        onClose={() => setEditing(null)}
        width={820}
        footer={<>
          <button className={styles.btnSecondary} onClick={() => setEditing(null)}>Cancel</button>
          <button className={styles.btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </>}
      >
        {formError && <div className={styles.formError}>{formError}</div>}
        {editing && editing !== "new" && (editing.sourceTag === "PROPOSED" || editing.sourceTag === "CORRECTED") && (
          <div className={styles.readOnlyBanner}>
            {SOURCE_LABEL[editing.sourceTag]} by us, awaiting client confirmation{editing.sourceNote ? `: ${editing.sourceNote}` : "."}
          </div>
        )}
        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.full}`}><label>Task<span className={styles.req}>*</span></label><input className={styles.input} value={form.name} onChange={set("name")} /></div>
          <div className={styles.field}>
            <label>Stage<span className={styles.req}>*</span></label>
            <select className={`${styles.select} ${styles.input}`} value={form.stage} onChange={set("stage")}>
              <option value="">Select…</option>
              {stages.map((s) => <option key={s._id} value={s._id}>{s.order}. {s.name}</option>)}
            </select>
            {selectedStage?.scope === "PORT_CALL" && <div className={styles.hint}>Created once for every {PORT_TYPE_LABEL[selectedStage.portType]?.toLowerCase()} call in the rotation</div>}
          </div>
          <div className={styles.field}>
            <label>Priority</label>
            <select className={`${styles.select} ${styles.input}`} value={form.defaultPriority} onChange={set("defaultPriority")}>
              {(meta?.priorities || []).map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
            </select>
          </div>

          <div className={`${styles.field} ${styles.full}`}>
            <label>Planned hours</label>
            <input className={styles.input} style={{ maxWidth: 160 }} type="number" min="0" step="0.25" value={form.plannedHours} onChange={set("plannedHours")} placeholder="e.g. 2" aria-label="Planned hours" />
            <div className={styles.hint}>Expected working time. Shown next to the actual hours in the Operations View</div>
          </div>
          <div className={`${styles.field} ${styles.full}`}>
            <label>Due date rule<span className={styles.req}>*</span></label>
            <div className={styles.ruleRow}>
              <select className={styles.select} value={form.direction} onChange={set("direction")} aria-label="Before, after or on">
                <option value="before">Days before</option>
                <option value="after">Days after</option>
                <option value="on">On the day of</option>
              </select>
              {form.direction !== "on" && (
                <input className={styles.input} style={{ width: 80 }} type="number" min="1" value={form.days} onChange={set("days")} aria-label="Days" />
              )}
              <span className={styles.subtle}>{form.direction === "on" ? "" : form.direction === "before" ? "day(s) before" : "day(s) after"}</span>
              <select className={styles.select} value={form.event} onChange={set("event")} aria-label="Key date">
                <option value="">Select key date…</option>
                {eventOptions.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div className={styles.hint}>
              Rule: <b>{form.event ? ruleText(form.event, offsetOf(form), form.recurring ? { everyDays: form.everyDays, until: form.until } : null) : "—"}</b>
              {selectedStage?.scope === "PORT_CALL" && " (port dates are taken from the port call this task belongs to)"}
            </div>
          </div>

          <div className={styles.field}>
            <label>Which date to use</label>
            <select className={`${styles.select} ${styles.input}`} value={form.basis} onChange={set("basis")}>
              {Object.entries(BASIS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label>Repeats</label>
            <label className={styles.checkRow}><input type="checkbox" checked={form.recurring} onChange={set("recurring")} /> Recurring task</label>
            {form.recurring && (
              <div className={styles.ruleRow} style={{ marginTop: 6 }}>
                <span className={styles.subtle}>every</span>
                <input className={styles.input} style={{ width: 70 }} type="number" min="1" value={form.everyDays} onChange={set("everyDays")} aria-label="Every N days" />
                <span className={styles.subtle}>days until</span>
                <select className={styles.select} value={form.until} onChange={set("until")} aria-label="Until">
                  <option value="">end of voyage</option>
                  {(meta?.anchorEvents || []).filter((e) => e.scope === "VOYAGE").map((e) => <option key={e.value} value={e.value}>{ANCHOR_SHORT[e.value]}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className={`${styles.field} ${styles.full}`}>
            <div className={styles.preview}>
              <span>Preview: if {form.event ? ANCHOR_SHORT[form.event] : "the key date"} is </span>
              <input type="date" value={sampleDate} onChange={(e) => setSampleDate(e.target.value)} style={{ border: "1px solid #b9d4ff", borderRadius: 6, padding: "1px 4px" }} aria-label="Sample key date" />
              {sampleDate && <span> ({formatLocalDate(sampleDate)})</span>}
              {preview ? (
                <span> → due <b>{formatLocalDate(preview.dates[0])}</b>
                  {preview.dates.length > 1 && <>, then {preview.dates.slice(1).map(formatLocalDate).join(", ")} …</>}
                </span>
              ) : <span> → choose a key date</span>}
            </div>
          </div>

          <div className={styles.field}>
            <label>Reminders</label>
            <select className={`${styles.select} ${styles.input}`} value={form.reminderProfile} onChange={set("reminderProfile")}>
              {(meta?.reminderProfiles || []).map((p) => <option key={p} value={p}>{p === "NONE" ? "None" : `${p[0] + p.slice(1).toLowerCase()} profile`}</option>)}
            </select>
            <div className={styles.hint}>{REMINDER_HINT[form.reminderProfile]}</div>
          </div>
          <div className={styles.field}>
            <label>Default assignee (role)</label>
            <select className={`${styles.select} ${styles.input}`} value={form.defaultRole} onChange={set("defaultRole")}>
              <option value="">Voyage operator</option>
              {(meta?.userRoles || []).map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
          </div>

          <div className={styles.field}>
            <label>Captures a voyage date when completed</label>
            <select className={`${styles.select} ${styles.input}`} value={form.linkedField} onChange={set("linkedField")}>
              <option value="">No</option>
              {(meta?.linkedFields || []).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <div className={styles.hint}>When the task is marked Done, the user is asked for this date/time</div>
          </div>
          <div className={styles.field}>
            <label>Options</label>
            <label className={styles.checkRow}><input type="checkbox" checked={form.isOptional} onChange={set("isOptional")} /> Optional (“if required”): unticked by default when a voyage is created</label>
            <label className={styles.checkRow} style={{ marginTop: 6, opacity: form.linkedField ? 1 : 0.5 }}>
              <input type="checkbox" checked={form.autoCompleteOnField} disabled={!form.linkedField} onChange={set("autoCompleteOnField")} /> Mark Done automatically when that date is entered
            </label>
          </div>

          <div className={styles.field}>
            <label>Voyage types</label>
            {(meta?.voyageTypes || []).map((vt) => (
              <label key={vt} className={styles.checkRow}>
                <input type="checkbox" checked={form.voyageTypes.includes(vt)} onChange={() => toggleVoyageType(vt)} />
                {vt === "TC_TRIP" ? "Time-charter trip" : "Voyage charter"}
              </label>
            ))}
            <div className={styles.hint}>None ticked = applies to every voyage type</div>
          </div>
          <div className={styles.field}>
            <label>Status</label>
            <label className={styles.checkRow}><input type="checkbox" checked={form.isActive} onChange={set("isActive")} /> Active (inactive templates are not added to new voyages)</label>
          </div>

          <div className={`${styles.field} ${styles.full}`}>
            <label>Instructions</label>
            <textarea className={styles.textarea} value={form.instructions} onChange={set("instructions")} placeholder="How to do this task, who to contact, templates to use…" />
          </div>
        </div>
      </OpsModal>
    </div>
  );
}

export default TaskTemplatesMaster;
