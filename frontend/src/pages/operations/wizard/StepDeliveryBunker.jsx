import React from "react";
import Select from "react-select";
import { PortDateTimeInput } from "../../../components/operations/PortDateTimeInput";
import { zoneLabel } from "../../../utils/opsTime";
import styles from "../masters/Masters.module.css";

// Step 4 — Delivery, re-delivery and bunkers (features B5, B8)
function StepDeliveryBunker({ form, update, opts, officeTz }) {
  const setHandover = (which, patch) => update((f) => ({ ...f, [which]: { ...f[which], ...patch } }));
  const setBunker = (patch) => update((f) => ({ ...f, bunker: { ...f.bunker, ...patch } }));
  const bunkerRows = form.rows.map((r, i) => ({ ...r, n: i + 1 })).filter((r) => r.type === "BUNKERING");
  const bunkerRow = form.rows.find((r) => r.key === form.bunker.rowKey);
  const bunkerZone = bunkerRow?.port?.timeZone || officeTz;

  const handover = (which, title) => {
    const h = form[which];
    const zone = h.port?.timeZone || officeTz;
    return (
      <div className={styles.card} style={{ padding: "0.9rem 1rem" }}>
        <b>{title}</b>
        <div className={styles.formGrid} style={{ marginTop: 8 }}>
          <div className={styles.field}>
            <label>Place</label>
            <input className={styles.input} value={h.place} onChange={(e) => setHandover(which, { place: e.target.value })} placeholder={which === "delivery" ? "e.g. Djibouti / APS" : "e.g. DLOSP Kakinada"} aria-label={`${title} place`} />
          </div>
          <div className={styles.field}>
            <label>Port</label>
            <Select inputId={`wz-${which}-port`} options={opts.ports} value={h.port} onChange={(o) => setHandover(which, { port: o })} isClearable placeholder="Select port…" />
            <div className={styles.hint}>Times are in {h.port ? "this port's" : "office"} local time: {zoneLabel(zone)}</div>
          </div>
          <div className={`${styles.field} ${styles.full}`}>
            <label>Estimated date and time</label>
            <PortDateTimeInput value={h.estimated} zone={zone} onChange={(iso) => setHandover(which, { estimated: iso })} ariaLabel={`${title} estimated`} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {handover("delivery", "Delivery")}
        {handover("redelivery", "Re-delivery")}
      </div>

      <div className={styles.card} style={{ padding: "0.9rem 1rem" }}>
        <b>Bunkers</b>
        <div className={styles.formGrid} style={{ marginTop: 8 }}>
          <div className={styles.field}>
            <label>Bunkering port</label>
            <select className={`${styles.select} ${styles.input}`} value={form.bunker.rowKey} onChange={(e) => setBunker({ rowKey: e.target.value })} aria-label="Bunkering port call">
              <option value="">{bunkerRows.length ? "Select…" : "No bunkering port call in the rotation"}</option>
              {bunkerRows.map((r) => <option key={r.key} value={r.key}>Port call {r.n}: {r.port?.name || "(port not chosen)"}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label>Supplier</label>
            <Select inputId="wz-supplier" options={opts.clients.Supplier} value={form.bunker.supplier} onChange={(o) => setBunker({ supplier: o })} isClearable placeholder="Select supplier…" />
            <div className={styles.hint}>Clients with type “Supplier”</div>
          </div>
          <div className={styles.field}><label>Grade</label><input className={styles.input} value={form.bunker.grade} onChange={(e) => setBunker({ grade: e.target.value })} placeholder="VLSFO" aria-label="Bunker grade" /></div>
          <div className={styles.field}><label>Quantity (MT)</label><input className={styles.input} type="number" min="0" value={form.bunker.quantity} onChange={(e) => setBunker({ quantity: e.target.value })} aria-label="Bunker quantity" /></div>
          <div className={styles.field}>
            <label>Bunker booked on <span className={styles.subtle}>(office time)</span></label>
            <PortDateTimeInput value={form.bunker.bookedOn} zone={officeTz} onChange={(iso) => setBunker({ bookedOn: iso })} ariaLabel="Bunker booked on" />
            <div className={styles.hint}>Drives “Once Bunker Booked” tasks; leave empty until booked</div>
          </div>
          <div className={styles.field}>
            <label>Bunkering date <span className={styles.subtle}>({bunkerRow?.port ? "bunkering port time" : "office time"})</span></label>
            <PortDateTimeInput value={form.bunker.bunkeringDate} zone={bunkerZone} onChange={(iso) => setBunker({ bunkeringDate: iso })} ariaLabel="Bunkering date" />
            <div className={styles.hint}>If empty, the bunkering port's berthing time (ETB) is used</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StepDeliveryBunker;
