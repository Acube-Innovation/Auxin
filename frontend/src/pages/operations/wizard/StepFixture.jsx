import React from "react";
import Select from "react-select";
import { PortDateTimeInput, ZoneDateInput } from "../../../components/operations/PortDateTimeInput";
import { zoneLabel } from "../../../utils/opsTime";
import { clientOption } from "./wizardModel";
import PickOrAdd from "./PickOrAdd";
import styles from "../masters/Masters.module.css";

const section = (title, note) => (
  <div className={`${styles.field} ${styles.full}`} style={{ borderTop: "1px solid #eef0f3", paddingTop: 12 }}>
    <label style={{ fontSize: "0.95rem", color: "#0b3a6f" }}>{title}{note && <span className={styles.subtle} style={{ fontWeight: 400 }}> · {note}</span>}</label>
  </div>
);

// Step 2 — Fixture & Vessel, with delivery and re-delivery (features B1–B3, B5)
function StepFixture({ form, update, opts, officeTz, isOperator, quickAdd }) {
  const setFixture = (k) => (v) => update((f) => ({ ...f, fixture: { ...f.fixture, [k]: v } }));
  const setMaster = (k) => (e) => update((f) => ({ ...f, master: { ...f.master, [k]: e.target.value } }));
  const setHandover = (which, patch) => update((f) => ({ ...f, [which]: { ...f[which], ...patch } }));

  // Picking a vessel fills owners and owners' broker from the vessel master when still empty
  const chooseVessel = (opt) => update((f) => {
    const next = { ...f, vessel: opt };
    if (opt && !f.owners && opt.owners) next.owners = clientOption(opt.owners);
    if (opt && opt.ownersBroker && !f.brokers.some((b) => b.value === (opt.ownersBroker._id || opt.ownersBroker))) {
      const b = clientOption(opt.ownersBroker);
      if (b) next.brokers = [...f.brokers, b];
    }
    return next;
  });

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
            <PickOrAdd inputId={`wz-${which}-port`} what="port" options={opts.ports} value={h.port} isClearable placeholder="Type to search or add…"
              onChange={(o) => setHandover(which, { port: o })} onCreate={quickAdd.port} />
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
    <div className={styles.formGrid}>
      <div className={`${styles.field} ${styles.full}`}>
        <label>Voyage type</label>
        <div style={{ display: "flex", gap: 24 }}>
          {[["TC_TRIP", "Time-charter trip (delivery / hire / re-delivery)"], ["VOYAGE_CHARTER", "Voyage charter"]].map(([v, l]) => (
            <label key={v} className={styles.checkRow}>
              <input type="radio" name="voyageType" checked={form.voyageType === v} onChange={() => update((f) => ({ ...f, voyageType: v }))} /> {l}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <label>Vessel<span className={styles.req}>*</span></label>
        <PickOrAdd inputId="wz-vessel" what="vessel" options={opts.vessels} value={form.vessel} onChange={chooseVessel} onCreate={quickAdd.vessel} placeholder="Type to search or add…" isClearable />
        <div className={styles.hint}>Active vessels from Ops Masters → Vessels</div>
      </div>
      <div className={styles.field}>
        <label>Operators{!isOperator && <span className={styles.req}>*</span>}</label>
        <Select inputId="wz-operators" isMulti options={opts.employees} value={form.operators} onChange={(v) => update((f) => ({ ...f, operators: v || [] }))}
          placeholder="Select operators…" />
        <div className={styles.hint}>{isOperator ? "You are added as an operator automatically" : "Tasks are assigned to the operators by default"}</div>
      </div>

      <div className={styles.field}>
        <label>Charterer</label>
        <PickOrAdd inputId="wz-charterer" what="charterer" options={opts.clients.Charterer} value={form.charterers} onChange={(v) => update((f) => ({ ...f, charterers: v }))}
          onCreate={(name) => quickAdd.client("Charterer", name)} placeholder="Type to search or add…" isClearable />
        <div className={styles.hint}>Clients with type “Charterer” (Sales &amp; Leads)</div>
      </div>
      <div className={styles.field}>
        <label>Owners</label>
        <PickOrAdd inputId="wz-owners" what="owners" options={opts.clients["Ship Owners"]} value={form.owners} onChange={(v) => update((f) => ({ ...f, owners: v }))}
          onCreate={(name) => quickAdd.client("Ship Owners", name)} placeholder="Type to search or add…" isClearable />
      </div>
      <div className={`${styles.field} ${styles.full}`}>
        <label>Brokers</label>
        <PickOrAdd inputId="wz-brokers" what="broker" isMulti options={opts.clients.Broker} value={form.brokers} onChange={(v) => update((f) => ({ ...f, brokers: v || [] }))}
          onCreate={(name) => quickAdd.client("Broker", name)} placeholder="Type to search or add…" />
      </div>

      <div className={styles.field}><label>Master's name</label><input className={styles.input} value={form.master.name} onChange={setMaster("name")} placeholder="Capt. …" /></div>
      <div className={styles.field}><label>Master's email</label><input className={styles.input} value={form.master.email} onChange={setMaster("email")} placeholder="master@vessel…" /></div>
      <div className={styles.field}><label>Master's phone</label><input className={styles.input} value={form.master.phone} onChange={setMaster("phone")} /></div>
      <div />

      {section("Fixture", `office time (${officeTz})`)}
      <div className={styles.field}>
        <label>Vessel fixed</label>
        <PortDateTimeInput value={form.fixture.vesselFixedAt} zone={officeTz} onChange={setFixture("vesselFixedAt")} ariaLabel="Vessel fixed" />
      </div>
      <div className={styles.field}>
        <label>Vessel laycan (from – to)</label>
        <div style={{ display: "flex", gap: 6 }}>
          <ZoneDateInput value={form.fixture.vesselLaycanFrom} zone={officeTz} onChange={setFixture("vesselLaycanFrom")} ariaLabel="Vessel laycan from" />
          <ZoneDateInput value={form.fixture.vesselLaycanTo} zone={officeTz} onChange={setFixture("vesselLaycanTo")} ariaLabel="Vessel laycan to" />
        </div>
      </div>

      {section("Delivery and re-delivery")}
      <div className={`${styles.field} ${styles.full}`}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {handover("delivery", "Delivery")}
          {handover("redelivery", "Re-delivery")}
        </div>
      </div>

      <div className={`${styles.field} ${styles.full}`}>
        <label>Remarks</label>
        <input className={styles.input} value={form.remarks} onChange={(e) => update((f) => ({ ...f, remarks: e.target.value }))} />
      </div>
    </div>
  );
}

export default StepFixture;
