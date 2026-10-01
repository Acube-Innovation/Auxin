import React from "react";
import { emptyCargo } from "./wizardModel";
import styles from "../masters/Masters.module.css";

const UNITS = ["MT", "CBM", "Units", "TEU", "Pieces"];

// Step 2 — Cargo lines (feature B4)
function StepCargo({ form, update }) {
  const set = (key, field) => (e) => update((f) => ({ ...f, cargo: f.cargo.map((c) => (c.key === key ? { ...c, [field]: e.target.value } : c)) }));
  const remove = (key) => update((f) => ({ ...f, cargo: f.cargo.length > 1 ? f.cargo.filter((c) => c.key !== key) : [emptyCargo()] }));
  const add = () => update((f) => ({ ...f, cargo: [...f.cargo, emptyCargo()] }));
  const total = form.cargo.filter((c) => c.unit === "MT").reduce((s, c) => s + (Number(c.quantity) || 0), 0);

  return (
    <div>
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
    </div>
  );
}

export default StepCargo;
