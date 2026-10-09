import React from "react";
import Select from "react-select";
import { PortDateTimeInput, ZoneDateInput } from "../../../components/operations/PortDateTimeInput";
import { clientOption } from "./wizardModel";
import styles from "../masters/Masters.module.css";

// Step 2 — Fixture & Vessel (features B1–B3)
function StepFixture({ form, update, opts, officeTz, isOperator }) {
  const setFixture = (k) => (v) => update((f) => ({ ...f, fixture: { ...f.fixture, [k]: v } }));
  const setMaster = (k) => (e) => update((f) => ({ ...f, master: { ...f.master, [k]: e.target.value } }));

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
        <Select inputId="wz-vessel" options={opts.vessels} value={form.vessel} onChange={chooseVessel} placeholder="Select vessel…" isClearable />
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
        <Select inputId="wz-charterer" options={opts.clients.Charterer} value={form.charterers} onChange={(v) => update((f) => ({ ...f, charterers: v }))} placeholder="Select charterer…" isClearable />
        <div className={styles.hint}>Clients with type “Charterer” (Sales &amp; Leads)</div>
      </div>
      <div className={styles.field}>
        <label>Owners</label>
        <Select inputId="wz-owners" options={opts.clients["Ship Owners"]} value={form.owners} onChange={(v) => update((f) => ({ ...f, owners: v }))} placeholder="Select owners…" isClearable />
      </div>
      <div className={`${styles.field} ${styles.full}`}>
        <label>Brokers</label>
        <Select inputId="wz-brokers" isMulti options={opts.clients.Broker} value={form.brokers} onChange={(v) => update((f) => ({ ...f, brokers: v || [] }))} placeholder="Select brokers…" />
      </div>

      <div className={styles.field}><label>Master's name</label><input className={styles.input} value={form.master.name} onChange={setMaster("name")} placeholder="Capt. …" /></div>
      <div className={styles.field}><label>Master's email</label><input className={styles.input} value={form.master.email} onChange={setMaster("email")} placeholder="master@vessel…" /></div>
      <div className={styles.field}><label>Master's phone</label><input className={styles.input} value={form.master.phone} onChange={setMaster("phone")} /></div>
      <div />

      <div className={`${styles.field} ${styles.full}`} style={{ borderTop: "1px solid #eef0f3", paddingTop: 12 }}>
        <label style={{ fontSize: "0.95rem", color: "#0b3a6f" }}>Fixture <span className={styles.subtle} style={{ fontWeight: 400 }}>· office time ({officeTz})</span></label>
      </div>
      <div className={styles.field}>
        <label>Cargo fixed</label>
        <PortDateTimeInput value={form.fixture.cargoFixedAt} zone={officeTz} onChange={setFixture("cargoFixedAt")} ariaLabel="Cargo fixed" />
      </div>
      <div className={styles.field}>
        <label>Vessel fixed</label>
        <PortDateTimeInput value={form.fixture.vesselFixedAt} zone={officeTz} onChange={setFixture("vesselFixedAt")} ariaLabel="Vessel fixed" />
      </div>
      <div className={styles.field}>
        <label>Cargo laycan (from – to)</label>
        <div style={{ display: "flex", gap: 6 }}>
          <ZoneDateInput value={form.fixture.cargoLaycanFrom} zone={officeTz} onChange={setFixture("cargoLaycanFrom")} ariaLabel="Cargo laycan from" />
          <ZoneDateInput value={form.fixture.cargoLaycanTo} zone={officeTz} onChange={setFixture("cargoLaycanTo")} ariaLabel="Cargo laycan to" />
        </div>
      </div>
      <div className={styles.field}>
        <label>Vessel laycan (from – to)</label>
        <div style={{ display: "flex", gap: 6 }}>
          <ZoneDateInput value={form.fixture.vesselLaycanFrom} zone={officeTz} onChange={setFixture("vesselLaycanFrom")} ariaLabel="Vessel laycan from" />
          <ZoneDateInput value={form.fixture.vesselLaycanTo} zone={officeTz} onChange={setFixture("vesselLaycanTo")} ariaLabel="Vessel laycan to" />
        </div>
      </div>
      <div className={styles.field}>
        <label>CP date</label>
        <ZoneDateInput value={form.fixture.cpDate} zone={officeTz} onChange={setFixture("cpDate")} ariaLabel="CP date" />
      </div>
      <div className={`${styles.field}`}>
        <label>Remarks</label>
        <input className={styles.input} value={form.remarks} onChange={(e) => update((f) => ({ ...f, remarks: e.target.value }))} />
      </div>
    </div>
  );
}

export default StepFixture;
