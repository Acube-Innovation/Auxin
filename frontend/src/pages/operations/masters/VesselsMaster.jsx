import React, { useCallback, useEffect, useMemo, useState } from "react";
import Select from "react-select";
import OpsModal from "../../../components/operations/OpsModal";
import DeleteModal from "../../../components/delete-modal/DeleteModal";
import OpsMasterService from "../../../services/OpsMasterService";
import { useToast } from "../../../context/ToastContext";
import styles from "./Masters.module.css";

const EMPTY = { name: "", imo: "", type: "", dwt: "", flag: "", yearBuilt: "", owners: null, ownersBroker: null, notes: "", isActive: true };
const toOption = (c) => (c ? { value: c._id, label: c.companyName } : null);

// Vessel master (feature A1)
function VesselsMaster({ canEdit }) {
  const { showToast } = useToast();
  const [vessels, setVessels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState(null); // null | 'new' | vessel
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [ownerOptions, setOwnerOptions] = useState([]);
  const [brokerOptions, setBrokerOptions] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setVessels(await OpsMasterService.getVessels());
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const openForm = async (vessel) => {
    setFormError("");
    setEditing(vessel || "new");
    setForm(vessel ? {
      ...EMPTY,
      ...vessel,
      imo: vessel.imo || "",
      dwt: vessel.dwt ?? "",
      yearBuilt: vessel.yearBuilt ?? "",
      owners: toOption(vessel.owners),
      ownersBroker: toOption(vessel.ownersBroker),
    } : EMPTY);
    try {
      const [owners, brokers] = await Promise.all([
        OpsMasterService.lookupClients("Ship Owners"),
        OpsMasterService.lookupClients("Broker"),
      ]);
      setOwnerOptions(owners.map(toOption));
      setBrokerOptions(brokers.map(toOption));
    } catch (e) {
      showToast(`Could not load owners/brokers: ${e.message}`, "error");
    }
  };

  const save = async () => {
    if (!form.name.trim()) return setFormError("Vessel name is required");
    if (form.imo && !/^\d{7}$/.test(form.imo.trim())) return setFormError("IMO number must be 7 digits");
    setSaving(true);
    setFormError("");
    const payload = {
      name: form.name.trim(),
      imo: form.imo.trim() || null,
      type: form.type.trim(),
      dwt: form.dwt === "" ? null : Number(form.dwt),
      flag: form.flag.trim(),
      yearBuilt: form.yearBuilt === "" ? null : Number(form.yearBuilt),
      owners: form.owners?.value || null,
      ownersBroker: form.ownersBroker?.value || null,
      notes: form.notes,
      isActive: form.isActive,
    };
    try {
      if (editing === "new") await OpsMasterService.createVessel(payload);
      else await OpsMasterService.updateVessel(editing._id, payload);
      showToast(`Vessel ${payload.name} saved`, "success");
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
      await OpsMasterService.deleteVessel(toDelete._id);
      showToast(`Vessel ${toDelete.name} deleted`, "success");
      setToDelete(null);
      load();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vessels.filter((v) => (showInactive || v.isActive) && (!q || v.name.toLowerCase().includes(q) || (v.imo || "").includes(q)));
  }, [vessels, search, showInactive]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e && e.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));

  return (
    <div className={styles.card}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.cardTitle}>Vessels</div>
          <input className={styles.search} placeholder="Search name or IMO" value={search} onChange={(e) => setSearch(e.target.value)} />
          <label className={styles.checkRow}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive
          </label>
        </div>
        {canEdit && <button className={styles.btnPrimary} onClick={() => openForm(null)}>+ Add Vessel</button>}
      </div>
      {!canEdit && <div className={styles.readOnlyBanner}>View only. Only an admin can add or change vessels.</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Vessel</th><th>IMO</th><th>Type</th><th>DWT</th><th>Flag</th><th>Built</th><th>Owners</th><th>Owners' broker</th><th>Status</th>{canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className={styles.empty}>Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={10} className={styles.empty}>No vessels found</td></tr>}
            {rows.map((v) => (
              <tr key={v._id} className={`${canEdit ? styles.clickable : ""} ${v.isActive ? "" : styles.inactive}`} onClick={() => canEdit && openForm(v)}>
                <td><b>{v.name}</b>{v.notes && <div className={styles.note}>{v.notes}</div>}</td>
                <td className={styles.mono}>{v.imo || "—"}</td>
                <td>{v.type || "—"}</td>
                <td>{v.dwt ? v.dwt.toLocaleString("en-IN") : "—"}</td>
                <td>{v.flag || "—"}</td>
                <td>{v.yearBuilt || "—"}</td>
                <td>{v.owners?.companyName || "—"}</td>
                <td>{v.ownersBroker?.companyName || "—"}</td>
                <td><span className={`${styles.chip} ${v.isActive ? styles.chipActive : styles.chipInactive}`}>{v.isActive ? "Active" : "Inactive"}</span></td>
                {canEdit && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className={styles.btnLink} onClick={() => openForm(v)}>Edit</button>
                    <button className={styles.btnLink} style={{ color: "#d92d20" }} onClick={() => setToDelete(v)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <OpsModal
        isOpen={Boolean(editing)}
        title={editing === "new" ? "Add Vessel" : `Edit ${editing?.name || "Vessel"}`}
        onClose={() => setEditing(null)}
        footer={<>
          <button className={styles.btnSecondary} onClick={() => setEditing(null)}>Cancel</button>
          <button className={styles.btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </>}
      >
        {formError && <div className={styles.formError}>{formError}</div>}
        <div className={styles.formGrid}>
          <div className={styles.field}><label>Vessel name<span className={styles.req}>*</span></label><input className={styles.input} value={form.name} onChange={set("name")} placeholder="MV Ocean Star" /></div>
          <div className={styles.field}><label>IMO number</label><input className={styles.input} value={form.imo} onChange={set("imo")} placeholder="7 digits" maxLength={7} /></div>
          <div className={styles.field}><label>Type / size</label><input className={styles.input} value={form.type} onChange={set("type")} placeholder="Supramax" /></div>
          <div className={styles.field}><label>DWT</label><input className={styles.input} type="number" min="0" value={form.dwt} onChange={set("dwt")} /></div>
          <div className={styles.field}><label>Flag</label><input className={styles.input} value={form.flag} onChange={set("flag")} /></div>
          <div className={styles.field}><label>Year built</label><input className={styles.input} type="number" min="1900" max="2100" value={form.yearBuilt} onChange={set("yearBuilt")} /></div>
          <div className={styles.field}>
            <label>Owners</label>
            <Select options={ownerOptions} value={form.owners} onChange={set("owners")} isClearable placeholder="Select ship owner…" />
            <div className={styles.hint}>Clients with type “Ship Owners” (Sales &amp; Leads)</div>
          </div>
          <div className={styles.field}>
            <label>Owners' broker</label>
            <Select options={brokerOptions} value={form.ownersBroker} onChange={set("ownersBroker")} isClearable placeholder="Select broker…" />
            <div className={styles.hint}>Clients with type “Broker”</div>
          </div>
          <div className={`${styles.field} ${styles.full}`}><label>Notes</label><textarea className={styles.textarea} value={form.notes || ""} onChange={set("notes")} /></div>
          <label className={styles.checkRow}><input type="checkbox" checked={form.isActive} onChange={set("isActive")} /> Active (can be selected on new voyages)</label>
        </div>
      </OpsModal>

      <DeleteModal
        isOpen={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this vessel?"
        description={`${toDelete?.name || ""} will be removed. To keep it for history, untick "Active" instead.`}
      />
    </div>
  );
}

export default VesselsMaster;
