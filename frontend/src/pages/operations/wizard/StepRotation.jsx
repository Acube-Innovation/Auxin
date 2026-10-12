import React from "react";
import Select from "react-select";
import { PortDateTimeInput } from "../../../components/operations/PortDateTimeInput";
import { suggestTimes } from "../../../utils/opsSuggest";
import { zoneLabel } from "../../../utils/opsTime";
import { clientOption, emptyRow } from "./wizardModel";
import styles from "../masters/Masters.module.css";

const TYPES = [["LOADING", "Loading"], ["DISCHARGING", "Discharging"], ["BUNKERING", "Bunkering"]];
const TYPE_COLOR = { LOADING: "#067647", DISCHARGING: "#b54708", BUNKERING: "#3538cd" };

// Step 3 — Port rotation with ETB / ETC / ETS suggestions (features B6, B7)
function StepRotation({ form, update, opts, settings }) {
  const setRow = (key, patch) => update((f) => ({ ...f, rows: f.rows.map((r) => (r.key === key ? { ...r, ...(typeof patch === "function" ? patch(r) : patch) } : r)) }));
  const move = (i, d) => update((f) => {
    const rows = [...f.rows];
    const j = i + d;
    if (j < 0 || j >= rows.length) return f;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    return { ...f, rows };
  });
  const remove = (key) => update((f) => ({ ...f, rows: f.rows.filter((r) => r.key !== key), bunker: f.bunker.rowKey === key ? { ...f.bunker, rowKey: "" } : f.bunker }));
  const add = (type) => update((f) => ({ ...f, rows: [...f.rows, emptyRow(type)] }));

  // Choosing a port suggests its first default agent
  const choosePort = (row, opt) => setRow(row.key, (r) => {
    const next = { ...r, port: opt };
    if (opt && !r.agent && opt.defaultAgents && opt.defaultAgents.length) next.agent = clientOption(opt.defaultAgents[0]);
    return next;
  });
  // A typed ETB / ETC / ETS replaces the suggestion; clearing it hands it back to the suggestion
  const setTime = (row, k, iso) => setRow(row.key, (r) => ({
    ...r, planned: { ...r.planned, [k]: iso }, manual: k === "eta" ? r.manual : { ...r.manual, [k]: Boolean(iso) },
  }));
  const resetTime = (row, k) => setRow(row.key, (r) => ({ ...r, planned: { ...r.planned, [k]: null }, manual: { ...r.manual, [k]: false } }));

  return (
    <div>
      <p className={styles.subtle} style={{ marginTop: 0 }}>
        Add the ports in the order the vessel calls them. Times are entered in each port's <b>local time</b>; UTC is shown beneath.
        ETB, ETC and ETS are <i>suggested</i> (ETB = ETA + {settings.waitHoursCargo} h, or {settings.waitHoursBunker} h at bunkering ports; ETC = ETB + quantity ÷ rate,
        else {settings.defaultOpsDays} days, {settings.defaultBunkerDays} day at bunkering ports). Type a time to replace a suggestion; ↺ brings it back.
      </p>

      {form.rows.length === 0 && <div className={styles.empty}>No port calls yet</div>}
      {form.rows.map((row, i) => {
        const zone = row.port?.timeZone;
        const eff = suggestTimes(row, settings);
        return (
          <div key={row.key} className={styles.card} style={{ marginBottom: 12, borderLeft: `4px solid ${TYPE_COLOR[row.type]}`, padding: "0.9rem 1rem" }} data-testid={`port-call-${i + 1}`}>
            <div className={styles.toolbar} style={{ marginBottom: 8 }}>
              <div className={styles.toolbarLeft}>
                <b>Port call {i + 1}</b>
                {zone && <span className={styles.subtle}>{zoneLabel(zone)}</span>}
              </div>
              <div>
                <button type="button" className={styles.btnLink} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move port call ${i + 1} up`}>▲</button>
                <button type="button" className={styles.btnLink} disabled={i === form.rows.length - 1} onClick={() => move(i, 1)} aria-label={`Move port call ${i + 1} down`}>▼</button>
                <button type="button" className={styles.btnLink} style={{ color: "#d92d20" }} onClick={() => remove(row.key)} aria-label={`Remove port call ${i + 1}`}>Remove</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 2fr 1fr 1fr", gap: 10 }}>
              <div className={styles.field}>
                <label>Port<span className={styles.req}>*</span></label>
                <Select inputId={`wz-port-${i + 1}`} options={opts.ports} value={row.port} onChange={(o) => choosePort(row, o)} placeholder="Select port…" />
              </div>
              <div className={styles.field}>
                <label>Type<span className={styles.req}>*</span></label>
                <select className={`${styles.select} ${styles.input}`} value={row.type} onChange={(e) => setRow(row.key, { type: e.target.value })} aria-label={`Port call ${i + 1} type`}>
                  {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Agent</label>
                <Select inputId={`wz-agent-${i + 1}`} options={opts.clients.Agent} value={row.agent} onChange={(o) => setRow(row.key, { agent: o })} isClearable placeholder="Select agent…" />
              </div>
              <div className={styles.field}>
                <label>{row.type === "BUNKERING" ? "Quantity" : "Cargo qty"}</label>
                <input className={styles.input} type="number" min="0" value={row.cargoQty} onChange={(e) => setRow(row.key, { cargoQty: e.target.value })} aria-label={`Port call ${i + 1} cargo quantity`} />
              </div>
              <div className={styles.field}>
                <label>Rate / day</label>
                <input className={styles.input} type="number" min="0" value={row.ratePerDay} onChange={(e) => setRow(row.key, { ratePerDay: e.target.value })} disabled={row.type === "BUNKERING"} aria-label={`Port call ${i + 1} rate per day`} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 6 }}>
              {[["eta", "ETA"], ["etb", "ETB"], ["etc", "ETC"], ["ets", "ETS"]].map(([k, label]) => {
                const isSuggested = k !== "eta" && !row.manual[k];
                return (
                  <div key={k} className={styles.field}>
                    <label>{label}{isSuggested && eff[k] && <span className={styles.defaulted}>suggested</span>}</label>
                    <PortDateTimeInput
                      value={k === "eta" ? row.planned.eta : eff[k]}
                      zone={zone}
                      suggested={isSuggested && Boolean(eff[k])}
                      onChange={(iso) => setTime(row, k, iso)}
                      onReset={k === "eta" ? undefined : () => resetTime(row, k)}
                      ariaLabel={`Port call ${i + 1} ${label}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className={styles.toolbarLeft}>
        <button type="button" className={styles.btnSecondary} onClick={() => add("LOADING")}>+ Load port</button>
        <button type="button" className={styles.btnSecondary} onClick={() => add("BUNKERING")}>+ Bunkering port</button>
        <button type="button" className={styles.btnSecondary} onClick={() => add("DISCHARGING")}>+ Discharge port</button>
      </div>
    </div>
  );
}

export default StepRotation;
