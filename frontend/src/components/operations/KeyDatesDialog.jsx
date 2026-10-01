import React, { useEffect, useState } from "react";
import OpsModal from "./OpsModal";
import { PortDateTimeInput } from "./PortDateTimeInput";
import { zoneLabel } from "../../utils/opsTime";
import styles from "../../pages/operations/masters/Masters.module.css";

// Voyage-level key dates on an active voyage: delivery / re-delivery (estimated + actual), bunker dates,
// fixture dates (features B2, B5, B8). Every change recalculates the linked tasks and is logged.
function KeyDatesDialog({ voyage, officeTz, onClose, onSubmit }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!voyage) return;
    setError("");
    setForm({
      delivery: { estimated: voyage.delivery?.estimated || null, actual: voyage.delivery?.actual || null },
      redelivery: { estimated: voyage.redelivery?.estimated || null, actual: voyage.redelivery?.actual || null },
      bunker: { bookedOn: voyage.bunker?.bookedOn || null, bunkeringDate: voyage.bunker?.bunkeringDate || null },
      fixture: { cargoFixedAt: voyage.fixture?.cargoFixedAt || null, vesselFixedAt: voyage.fixture?.vesselFixedAt || null },
      reason: "",
    });
  }, [voyage]);

  if (!voyage || !form) return null;
  const set = (group, key) => (iso) => setForm((f) => ({ ...f, [group]: { ...f[group], [key]: iso } }));
  const dz = voyage.delivery?.timeZone || officeTz;
  const rz = voyage.redelivery?.timeZone || officeTz;
  const bunkerCall = voyage.portCalls.find((p) => p._id === voyage.bunker?.portCall);
  const bz = bunkerCall?.timeZone || officeTz;

  const submit = async () => {
    setError("");
    if (form.delivery.estimated && form.redelivery.estimated && form.redelivery.estimated < form.delivery.estimated) return setError("Re-delivery cannot be before delivery");
    setSaving(true);
    try {
      await onSubmit({ delivery: form.delivery, redelivery: form.redelivery, bunker: form.bunker, fixture: form.fixture, reason: form.reason });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const block = (title, zone, fields) => (
    <div className={styles.card} style={{ padding: "0.8rem 1rem" }}>
      <b>{title}</b> <span className={styles.subtle}>{zoneLabel(zone)}</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
        {fields.map(([label, group, key]) => (
          <div key={`${group}.${key}`} className={styles.field}>
            <label>{label}</label>
            <PortDateTimeInput value={form[group][key]} zone={zone} onChange={set(group, key)} ariaLabel={label} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <OpsModal isOpen title={`Key dates — ${voyage.voyageNo}`} onClose={onClose} width={900}
      footer={<>
        <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
        <button className={styles.btnPrimary} onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </>}>
      {error && <div className={styles.formError} role="alert">{error}</div>}
      <div style={{ display: "grid", gap: 12 }}>
        {block(`Delivery${voyage.delivery?.place ? ` — ${voyage.delivery.place}` : ""}`, dz, [["Delivery estimated", "delivery", "estimated"], ["Delivery actual", "delivery", "actual"]])}
        {block(`Re-delivery${voyage.redelivery?.place ? ` — ${voyage.redelivery.place}` : ""}`, rz, [["Re-delivery estimated", "redelivery", "estimated"], ["Re-delivery actual", "redelivery", "actual"]])}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {block("Bunker booked (office time)", officeTz, [["Bunker booked on", "bunker", "bookedOn"]])}
          {block(`Bunkering${bunkerCall ? ` — ${bunkerCall.port?.name}` : ""}`, bz, [["Bunkering date", "bunker", "bunkeringDate"]])}
        </div>
        {block("Fixture (office time)", officeTz, [["Cargo fixed", "fixture", "cargoFixedAt"], ["Vessel fixed", "fixture", "vesselFixedAt"]])}
        <div className={styles.field}>
          <label>Reason for the change <span className={styles.subtle}>(optional, kept in the revision log)</span></label>
          <input className={styles.input} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} aria-label="Reason" />
        </div>
      </div>
    </OpsModal>
  );
}

export default KeyDatesDialog;
