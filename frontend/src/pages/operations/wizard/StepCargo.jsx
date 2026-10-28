import React from "react";
import { emptyCargo } from "./wizardModel";
import PickOrAdd from "./PickOrAdd";
import { PortDateTimeInput, ZoneDateInput } from "../../../components/operations/PortDateTimeInput";
import styles from "../masters/Masters.module.css";

const UNITS = ["MT", "CBM", "Units", "TEU", "Pieces"];

// Step 1 — Customer, cargo lines and the cargo fixture dates (feature B4)
function StepCargo({ form, update, opts, officeTz, quickAdd }) {
  const setCustomer = (patch) => update((f) => ({ ...f, customer: { ...f.customer, ...patch } }));
  const setFixture = (k) => (v) => update((f) => ({ ...f, fixture: { ...f.fixture, [k]: v } }));
  const set = (key, field) => (e) => update((f) => ({ ...f, cargo: f.cargo.map((c) => (c.key === key ? { ...c, [field]: e.target.value } : c)) }));
  const remove = (key) => update((f) => ({ ...f, cargo: f.cargo.length > 1 ? f.cargo.filter((c) => c.key !== key) : [emptyCargo()] }));
  const add = () => update((f) => ({ ...f, cargo: [...f.cargo, emptyCargo()] }));
  const total = form.cargo.filter((c) => c.unit === "MT").reduce((s, c) => s + (Number(c.quantity) || 0), 0);

  return (
    <div>
      <div className={styles.formGrid} style={{ marginBottom: 14 }}>
        <div className={`${styles.field} ${styles.full}`}><label style={{ fontSize: "0.95rem", color: "#0b3a6f" }}>Customer</label></div>
        <div className={styles.field}>
          <label>Customer</label>
          <PickOrAdd inputId="wz-customer" what="customer" options={opts.clients.All} value={form.customer.client} isClearable placeholder="Type to search or add…"
            onChange={(o) => setCustomer({ client: o })} onCreate={(name) => quickAdd.client("Other", name)} />
          <div className={styles.hint}>Any client in Sales &amp; Leads; a new one is added with type “Other”</div>
        </div>
        <div className={styles.field}><label>Contact person</label><input className={styles.input} value={form.customer.contactName} onChange={(e) => setCustomer({ contactName: e.target.value })} aria-label="Customer contact person" /></div>
        <div className={styles.field}><label>Email</label><input className={styles.input} value={form.customer.email} onChange={(e) => setCustomer({ email: e.target.value })} placeholder="name@company.com" aria-label="Customer email" /></div>
        <div className={styles.field}><label>Phone</label><input className={styles.input} value={form.customer.phone} onChange={(e) => setCustomer({ phone: e.target.value })} aria-label="Customer phone" /></div>
      </div>

      <div className={styles.field} style={{ marginBottom: 6 }}><label style={{ fontSize: "0.95rem", color: "#0b3a6f" }}>Cargo</label></div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>#</th><th>Description<span className={styles.req}>*</span></th><th>Quantity</th><th>Unit</th><th>Bags / pieces</th><th>Package unit</th><th>Remarks</th><th /></tr></thead>
          <tbody>
            {form.cargo.map((c, i) => (
              <tr key={c.key}>
                <td className={styles.itemNo}>{i + 1}</td>
                <td><input className={styles.input} value={c.description} onChange={set(c.key, "description")} placeholder="e.g. Limestone" aria-label={`Cargo ${i + 1} description`} /></td>
                <td style={{ width: 130 }}><input className={styles.input} type="number" min="0" value={c.quantity} onChange={set(c.key, "quantity")} aria-label={`Cargo ${i + 1} quantity`} /></td>
                <td style={{ width: 100 }}>
                  <select className={`${styles.select} ${styles.input}`} value={c.unit} onChange={set(c.key, "unit")} aria-label={`Cargo ${i + 1} unit`}>
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </td>
                <td style={{ width: 120 }}><input className={styles.input} type="number" min="0" value={c.packages} onChange={set(c.key, "packages")} /></td>
                <td style={{ width: 120 }}><input className={styles.input} value={c.packageUnit} onChange={set(c.key, "packageUnit")} placeholder="bags" /></td>
                <td><input className={styles.input} value={c.remarks} onChange={set(c.key, "remarks")} /></td>
                <td><button type="button" className={styles.btnLink} style={{ color: "#d92d20" }} onClick={() => remove(c.key)} aria-label={`Remove cargo ${i + 1}`}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.toolbar} style={{ marginTop: 10 }}>
        <button type="button" className={styles.btnSecondary} onClick={add}>+ Add cargo line</button>
        {total > 0 && <span className={styles.subtle}>Total: {total.toLocaleString("en-IN")} MT</span>}
      </div>
      <div className={styles.hint}>Cargo is optional at this stage; lines without a description are ignored.</div>

      <div className={styles.formGrid} style={{ marginTop: 16, borderTop: "1px solid #eef0f3", paddingTop: 12 }}>
        <div className={`${styles.field} ${styles.full}`}>
          <label style={{ fontSize: "0.95rem", color: "#0b3a6f" }}>Fixture <span className={styles.subtle} style={{ fontWeight: 400 }}>· office time ({officeTz})</span></label>
        </div>
        <div className={styles.field}>
          <label>Cargo fixed</label>
          <PortDateTimeInput value={form.fixture.cargoFixedAt} zone={officeTz} onChange={setFixture("cargoFixedAt")} ariaLabel="Cargo fixed" />
        </div>
        <div className={styles.field}>
          <label>CP date</label>
          <ZoneDateInput value={form.fixture.cpDate} zone={officeTz} onChange={setFixture("cpDate")} ariaLabel="CP date" />
        </div>
        <div className={styles.field}>
          <label>Cargo laycan (from – to)</label>
          <div style={{ display: "flex", gap: 6 }}>
            <ZoneDateInput value={form.fixture.cargoLaycanFrom} zone={officeTz} onChange={setFixture("cargoLaycanFrom")} ariaLabel="Cargo laycan from" />
            <ZoneDateInput value={form.fixture.cargoLaycanTo} zone={officeTz} onChange={setFixture("cargoLaycanTo")} ariaLabel="Cargo laycan to" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default StepCargo;
