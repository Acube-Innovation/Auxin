import React, { useCallback, useEffect, useMemo, useState } from "react";
import Select from "react-select";
import OpsModal from "../../../components/operations/OpsModal";
import DeleteModal from "../../../components/delete-modal/DeleteModal";
import OpsMasterService from "../../../services/OpsMasterService";
import { useToast } from "../../../context/ToastContext";
import { allTimeZones, zoneNow } from "../../../utils/opsFormat";
import styles from "./Masters.module.css";

const EMPTY = { name: "", country: "", unlocode: "", timeZone: null, defaultAgents: [], notes: "", isActive: true };
const toOption = (c) => ({ value: c._id, label: c.companyName });
const zoneOption = (tz) => {
  const { offset } = zoneNow(tz);
  return { value: tz, label: `${tz}${offset ? `  (${offset})` : ""}` };
};

// Port master (feature A2). The time zone drives local time / UTC everywhere in the module.
function PortsMaster({ canEdit }) {
  const { showToast } = useToast();
  const [ports, setPorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [agentOptions, setAgentOptions] = useState([]);
  const zoneOptions = useMemo(() => allTimeZones().map(zoneOption), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPorts(await OpsMasterService.getPorts());
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const openForm = async (port) => {
    setFormError("");
    setEditing(port || "new");
    setForm(port ? {
      ...EMPTY,
      ...port,
      unlocode: port.unlocode || "",
      timeZone: port.timeZone ? zoneOption(port.timeZone) : null,
      defaultAgents: (port.defaultAgents || []).map(toOption),
    } : EMPTY);
    try {
      setAgentOptions((await OpsMasterService.lookupClients("Agent")).map(toOption));
    } catch (e) {
      showToast(`Could not load agents: ${e.message}`, "error");
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.country.trim()) return setFormError("Port name and country are required");
    if (!form.timeZone) return setFormError("Time zone is required (it is used to show local time and UTC)");
    if (form.unlocode && !/^[A-Za-z]{2}[A-Za-z0-9]{3}$/.test(form.unlocode.trim())) return setFormError("UN/LOCODE must be 5 characters, e.g. OMSLL");
    setSaving(true);
    setFormError("");
    const payload = {
      name: form.name.trim(),
      country: form.country.trim(),
      unlocode: form.unlocode.trim() || null,
      timeZone: form.timeZone.value,
      defaultAgents: form.defaultAgents.map((a) => a.value),
      notes: form.notes,
      isActive: form.isActive,
    };
    try {
      if (editing === "new") await OpsMasterService.createPort(payload);
      else await OpsMasterService.updatePort(editing._id, payload);
      showToast(`Port ${payload.name} saved`, "success");
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
      await OpsMasterService.deletePort(toDelete._id);
      showToast(`Port ${toDelete.name} deleted`, "success");
      setToDelete(null);
      load();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ports.filter((p) => (showInactive || p.isActive) && (!q || [p.name, p.country, p.unlocode].some((x) => (x || "").toLowerCase().includes(q))));
  }, [ports, search, showInactive]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e && e.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));
  const selectedZone = form.timeZone ? zoneNow(form.timeZone.value) : null;

  return (
    <div className={styles.card}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.cardTitle}>Ports</div>
          <input className={styles.search} placeholder="Search name, country or UN/LOCODE" value={search} onChange={(e) => setSearch(e.target.value)} />
          <label className={styles.checkRow}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive
          </label>
        </div>
        {canEdit && <button className={styles.btnPrimary} onClick={() => openForm(null)}>+ Add Port</button>}
      </div>
      {!canEdit && <div className={styles.readOnlyBanner}>View only. Only an admin can add or change ports.</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Port</th><th>Country</th><th>UN/LOCODE</th><th>Time zone</th><th>Local time now</th><th>Default agents</th><th>Status</th>{canEdit && <th />}</tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className={styles.empty}>Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className={styles.empty}>No ports found</td></tr>}
            {rows.map((p) => {
              const now = zoneNow(p.timeZone);
              return (
                <tr key={p._id} className={`${canEdit ? styles.clickable : ""} ${p.isActive ? "" : styles.inactive}`} onClick={() => canEdit && openForm(p)}>
                  <td><b>{p.name}</b>{p.notes && <div className={styles.note}>{p.notes}</div>}</td>
                  <td>{p.country}</td>
                  <td className={styles.mono}>{p.unlocode || "—"}</td>
                  <td className={styles.mono}>{p.timeZone}</td>
                  <td>{now.time} <span className={styles.subtle}>{now.offset}</span></td>
                  <td>{(p.defaultAgents || []).map((a) => a.companyName).join(", ") || "—"}</td>
                  <td><span className={`${styles.chip} ${p.isActive ? styles.chipActive : styles.chipInactive}`}>{p.isActive ? "Active" : "Inactive"}</span></td>
                  {canEdit && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <button className={styles.btnLink} onClick={() => openForm(p)}>Edit</button>
                      <button className={styles.btnLink} style={{ color: "#d92d20" }} onClick={() => setToDelete(p)}>Delete</button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <OpsModal
        isOpen={Boolean(editing)}
        title={editing === "new" ? "Add Port" : `Edit ${editing?.name || "Port"}`}
        onClose={() => setEditing(null)}
        footer={<>
          <button className={styles.btnSecondary} onClick={() => setEditing(null)}>Cancel</button>
          <button className={styles.btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </>}
      >
        {formError && <div className={styles.formError}>{formError}</div>}
        <div className={styles.formGrid}>
          <div className={styles.field}><label>Port name<span className={styles.req}>*</span></label><input className={styles.input} value={form.name} onChange={set("name")} placeholder="Salalah" /></div>
          <div className={styles.field}><label>Country<span className={styles.req}>*</span></label><input className={styles.input} value={form.country} onChange={set("country")} placeholder="Oman" /></div>
          <div className={styles.field}><label>UN/LOCODE</label><input className={styles.input} value={form.unlocode} onChange={set("unlocode")} placeholder="OMSLL" maxLength={5} /></div>
          <div className={styles.field}>
            <label>Time zone<span className={styles.req}>*</span></label>
            <Select options={zoneOptions} value={form.timeZone} onChange={set("timeZone")} placeholder="Type a city, e.g. Muscat" />
            <div className={styles.hint}>{selectedZone ? `Local time now: ${selectedZone.time} (${selectedZone.offset})` : "Times at this port are entered in this zone; UTC is calculated from it."}</div>
          </div>
          <div className={`${styles.field} ${styles.full}`}>
            <label>Default agents</label>
            <Select options={agentOptions} value={form.defaultAgents} onChange={(v) => setForm((f) => ({ ...f, defaultAgents: v || [] }))} isMulti placeholder="Select agents…" />
            <div className={styles.hint}>Clients with type “Agent”. Suggested when this port is added to a voyage.</div>
          </div>
          <div className={`${styles.field} ${styles.full}`}><label>Notes / restrictions</label><textarea className={styles.textarea} value={form.notes || ""} onChange={set("notes")} placeholder="Draft limits, working hours, restrictions…" /></div>
          <label className={styles.checkRow}><input type="checkbox" checked={form.isActive} onChange={set("isActive")} /> Active</label>
        </div>
      </OpsModal>

      <DeleteModal
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this port?"
        description={`${toDelete?.name || ""} will be removed. To keep it for history, untick "Active" instead.`}
      />
    </div>
  );
}

export default PortsMaster;
