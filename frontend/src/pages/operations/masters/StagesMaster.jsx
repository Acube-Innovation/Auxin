import React, { useCallback, useEffect, useState } from "react";
import OpsModal from "../../../components/operations/OpsModal";
import DeleteModal from "../../../components/delete-modal/DeleteModal";
import OpsMasterService from "../../../services/OpsMasterService";
import { useToast } from "../../../context/ToastContext";
import { PORT_TYPE_LABEL } from "../../../utils/opsFormat";
import styles from "./Masters.module.css";

const EMPTY = { code: "", name: "", scope: "VOYAGE", portType: "", isActive: true };

// Stage master (feature A3). Order drives grouping everywhere; PORT_CALL stages repeat per port call.
function StagesMaster({ canEdit }) {
  const { showToast } = useToast();
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStages(await OpsMasterService.getStages());
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const move = async (index, delta) => {
    const next = [...stages];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setStages(next.map((s, i) => ({ ...s, order: i + 1 })));
    try {
      await OpsMasterService.reorderStages(next.map((s) => s._id));
    } catch (e) {
      showToast(`Order not saved: ${e.message}`, "error");
      load();
    }
  };

  const openForm = (stage) => {
    setFormError("");
    setEditing(stage || "new");
    setForm(stage ? { ...EMPTY, ...stage, portType: stage.portType || "" } : EMPTY);
  };

  const save = async () => {
    if (!form.name.trim()) return setFormError("Stage name is required");
    if (editing === "new" && !/^[A-Za-z0-9_]+$/.test(form.code.trim())) return setFormError("Code is required: letters, numbers and _ only, e.g. PRE_ARRIVAL_LP");
    if (form.scope === "PORT_CALL" && !form.portType) return setFormError("Choose the port type this stage repeats for");
    setSaving(true);
    setFormError("");
    const payload = {
      name: form.name.trim(),
      scope: form.scope,
      portType: form.scope === "PORT_CALL" ? form.portType : null,
      isActive: form.isActive,
    };
    try {
      if (editing === "new") await OpsMasterService.createStage({ ...payload, code: form.code.trim().toUpperCase() });
      else await OpsMasterService.updateStage(editing._id, payload);
      showToast(`Stage ${payload.name} saved`, "success");
      setEditing(null);
      load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await OpsMasterService.deleteStage(toDelete._id);
      showToast(`Stage ${toDelete.name} deleted`, "success");
      setToDelete(null);
      load();
    } catch (e) {
      showToast(e.message, "error");
      setToDelete(null);
    }
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className={styles.card}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.cardTitle}>Stages</div>
          <span className={styles.subtle}>Stages group the task list. “Per port call” stages repeat for every port of that type in the rotation.</span>
        </div>
        {canEdit && <button className={styles.btnPrimary} onClick={() => openForm(null)}>+ Add Stage</button>}
      </div>
      {!canEdit && <div className={styles.readOnlyBanner}>View only. Only an admin can change stages.</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th style={{ width: 70 }}>Order</th><th>Stage</th><th>Code</th><th>Applies</th><th>Templates</th><th>Status</th>{canEdit && <th />}</tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className={styles.empty}>Loading…</td></tr>}
            {stages.map((s, i) => (
              <tr key={s._id} className={s.isActive ? "" : styles.inactive}>
                <td>
                  {s.order}
                  {canEdit && (
                    <span style={{ marginLeft: 6 }}>
                      <button className={styles.btnLink} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${s.name} up`}>▲</button>
                      <button className={styles.btnLink} disabled={i === stages.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${s.name} down`}>▼</button>
                    </span>
                  )}
                </td>
                <td><b>{s.name}</b></td>
                <td className={styles.mono}>{s.code}</td>
                <td>
                  <span className={`${styles.chip} ${styles.chipScope}`}>
                    {s.scope === "PORT_CALL" ? `Per ${PORT_TYPE_LABEL[s.portType]?.toLowerCase() || "port"} call` : "Once per voyage"}
                  </span>
                </td>
                <td>{s.activeTemplateCount}{s.templateCount !== s.activeTemplateCount && <span className={styles.subtle}> (+{s.templateCount - s.activeTemplateCount} inactive)</span>}</td>
                <td><span className={`${styles.chip} ${s.isActive ? styles.chipActive : styles.chipInactive}`}>{s.isActive ? "Active" : "Inactive"}</span></td>
                {canEdit && (
                  <td>
                    <button className={styles.btnLink} onClick={() => openForm(s)}>Edit</button>
                    <button className={styles.btnLink} style={{ color: "#d92d20" }} onClick={() => setToDelete(s)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <OpsModal
        isOpen={Boolean(editing)}
        title={editing === "new" ? "Add Stage" : `Edit ${editing?.name || "Stage"}`}
        onClose={() => setEditing(null)}
        width={560}
        footer={<>
          <button className={styles.btnSecondary} onClick={() => setEditing(null)}>Cancel</button>
          <button className={styles.btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </>}
      >
        {formError && <div className={styles.formError}>{formError}</div>}
        <div className={styles.formGrid}>
          <div className={`${styles.field} ${styles.full}`}><label>Stage name<span className={styles.req}>*</span></label><input className={styles.input} value={form.name} onChange={set("name")} /></div>
          <div className={styles.field}>
            <label>Code{editing === "new" && <span className={styles.req}>*</span>}</label>
            <input className={`${styles.input} ${styles.mono}`} value={form.code} onChange={set("code")} disabled={editing !== "new"} placeholder="PRE_ARRIVAL_LP" />
            {editing !== "new" && <div className={styles.hint}>The code cannot be changed</div>}
          </div>
          <div className={styles.field}>
            <label>Applies</label>
            <select className={`${styles.select} ${styles.input}`} value={form.scope} onChange={set("scope")}>
              <option value="VOYAGE">Once per voyage</option>
              <option value="PORT_CALL">Per port call</option>
            </select>
          </div>
          {form.scope === "PORT_CALL" && (
            <div className={styles.field}>
              <label>Port type<span className={styles.req}>*</span></label>
              <select className={`${styles.select} ${styles.input}`} value={form.portType} onChange={set("portType")}>
                <option value="">Select…</option>
                {Object.entries(PORT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          )}
          <label className={`${styles.checkRow} ${styles.full}`}><input type="checkbox" checked={form.isActive} onChange={set("isActive")} /> Active</label>
        </div>
      </OpsModal>

      <DeleteModal
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this stage?"
        description={`${toDelete?.name || ""} can only be deleted when no task templates use it.`}
      />
    </div>
  );
}

export default StagesMaster;
