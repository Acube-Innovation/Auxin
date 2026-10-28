import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import OpsModal from "../../../components/operations/OpsModal";
import { allTimeZones, zoneNow } from "../../../utils/opsFormat";
import styles from "../masters/Masters.module.css";

const zoneOption = (tz) => {
  const { offset } = zoneNow(tz);
  return { value: tz, label: `${tz}${offset ? `  (${offset})` : ""}` };
};

// Add a port from the New Voyage form: the port's time zone is needed for its local times
function QuickAddPort({ request, onSave, onCancel }) {
  const [form, setForm] = useState({ name: "", country: "", timeZone: null });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const zoneOptions = useMemo(() => allTimeZones().map(zoneOption), []);

  useEffect(() => {
    if (request) { setForm({ name: request.name, country: "", timeZone: null }); setError(""); }
  }, [request]);

  const save = async () => {
    if (!form.name.trim()) return setError("Port name is required");
    if (!form.country.trim()) return setError("Country is required");
    if (!form.timeZone) return setError("Time zone is required (it is used to show local time and UTC)");
    setSaving(true);
    try {
      await onSave({ name: form.name.trim(), country: form.country.trim(), timeZone: form.timeZone.value });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const zone = form.timeZone ? zoneNow(form.timeZone.value) : null;
  return (
    <OpsModal isOpen={Boolean(request)} title="Add port" onClose={onCancel} width={560}
      footer={<>
        <button className={styles.btnSecondary} onClick={onCancel}>Cancel</button>
        <button className={styles.btnPrimary} onClick={save} disabled={saving}>{saving ? "Saving…" : "Add port"}</button>
      </>}>
      {error && <div className={styles.formError} role="alert">{error}</div>}
      <div className={styles.formGrid}>
        <div className={styles.field}><label>Port name<span className={styles.req}>*</span></label>
          <input className={styles.input} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} aria-label="New port name" /></div>
        <div className={styles.field}><label>Country<span className={styles.req}>*</span></label>
          <input className={styles.input} value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} placeholder="Oman" aria-label="New port country" autoFocus /></div>
        <div className={`${styles.field} ${styles.full}`}>
          <label>Time zone<span className={styles.req}>*</span></label>
          <Select inputId="qa-port-zone" options={zoneOptions} value={form.timeZone} onChange={(o) => setForm((f) => ({ ...f, timeZone: o }))} placeholder="Type a city, e.g. Muscat" />
          <div className={styles.hint}>{zone ? `Local time now: ${zone.time} (${zone.offset})` : "Times at this port are entered in this zone; UTC is calculated from it."}</div>
        </div>
      </div>
      <div className={styles.hint}>UN/LOCODE, default agents and notes can be added later in Ops Masters → Ports.</div>
    </OpsModal>
  );
}

export default QuickAddPort;
