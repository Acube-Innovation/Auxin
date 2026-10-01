import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import OpsModal from "./OpsModal";
import { PortDateTimeInput } from "./PortDateTimeInput";
import { suggestTimes } from "../../utils/opsSuggest";
import { zoneLabel } from "../../utils/opsTime";
import styles from "../../pages/operations/masters/Masters.module.css";

const ACTUALS = [
  ["ata", "ATA — arrived"], ["norTendered", "NOR tendered"], ["pob", "Pilot on board"], ["atb", "ATB — berthed"],
  ["commenced", "Operations commenced"], ["completed", "Operations completed"], ["atd", "ATD — sailed"],
];
const PLANNED = [["eta", "ETA"], ["etb", "ETB"], ["etc", "ETC"], ["ets", "ETS"]];
const TYPE_LABEL = { LOADING: "Loading", DISCHARGING: "Discharging", BUNKERING: "Bunkering" };

// Port-call changes on an active voyage.
//   mode "planned" — Update ETA / ETB / ETC / ETS with suggestions and a reason (C3, B7)
//   mode "actual"  — statement-of-facts times (C1)
//   mode "details" — agent, quantity, rate, remarks
//   mode "add"     — new port call (its tasks are generated)
function PortCallDialog({ mode, portCall, portCalls = [], options, settings, onClose, onSubmit }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setError("");
    if (mode === "add") {
      setForm({ port: null, type: "DISCHARGING", agent: null, cargoQty: "", ratePerDay: "", planned: { eta: null, etb: null, etc: null, ets: null }, manual: { etb: false, etc: false, ets: false }, position: "", reason: "" });
    } else {
      setForm({
        planned: { eta: null, etb: null, etc: null, ets: null, ...(portCall.planned || {}) },
        manual: { etb: false, etc: false, ets: false, ...(portCall.manual || {}) },
        actual: { ...(portCall.actual || {}) },
        agent: portCall.agent ? { value: portCall.agent._id, label: portCall.agent.companyName } : null,
        cargoQty: portCall.cargoQty ?? "",
        ratePerDay: portCall.ratePerDay ?? "",
        remarks: portCall.remarks || "",
        reason: "",
      });
    }
  }, [mode, portCall]);

  const zone = mode === "add" ? form?.port?.timeZone : portCall?.timeZone;
  const type = mode === "add" ? form?.type : portCall?.type;
  const effective = useMemo(() => (form ? suggestTimes({ type, cargoQty: form.cargoQty, ratePerDay: form.ratePerDay, planned: form.planned, manual: form.manual }, settings) : {}), [form, type, settings]);

  if (!mode || !form) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setPlanned = (k, iso) => setForm((f) => ({ ...f, planned: { ...f.planned, [k]: iso }, manual: k === "eta" ? f.manual : { ...f.manual, [k]: Boolean(iso) } }));
  const resetPlanned = (k) => setForm((f) => ({ ...f, planned: { ...f.planned, [k]: null }, manual: { ...f.manual, [k]: false } }));
  const setActual = (k, iso) => setForm((f) => ({ ...f, actual: { ...f.actual, [k]: iso } }));
  const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
  const plannedPayload = () => ({
    eta: form.planned.eta || null,
    etb: form.manual.etb ? form.planned.etb : null,
    etc: form.manual.etc ? form.planned.etc : null,
    ets: form.manual.ets ? form.planned.ets : null,
  });

  const submit = async () => {
    setError("");
    let body;
    if (mode === "planned") {
      for (const [a, b] of [["eta", "etb"], ["etb", "etc"], ["etc", "ets"]]) {
        if (effective[a] && effective[b] && effective[b] < effective[a]) return setError(`${b.toUpperCase()} cannot be before ${a.toUpperCase()}`);
      }
      body = { planned: plannedPayload(), reason: form.reason };
    } else if (mode === "actual") {
      body = { actual: Object.fromEntries(ACTUALS.map(([k]) => [k, form.actual[k] || null])), reason: form.reason };
    } else if (mode === "details") {
      body = { agent: form.agent ? form.agent.value : null, cargoQty: num(form.cargoQty), ratePerDay: num(form.ratePerDay), remarks: form.remarks, reason: form.reason };
    } else {
      if (!form.port) return setError("Choose the port");
      body = { port: form.port.value, type: form.type, agent: form.agent ? form.agent.value : null, cargoQty: num(form.cargoQty), ratePerDay: num(form.ratePerDay), planned: plannedPayload() };
      if (form.position) body.position = Number(form.position);
    }
    setSaving(true);
    try {
      await onSubmit(body);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const titles = {
    planned: `Update ETA — ${portCall?.port?.name}`,
    actual: `Actual times (SOF) — ${portCall?.port?.name}`,
    details: `Details — ${portCall?.port?.name}`,
    add: "Add port call",
  };

  return (
    <OpsModal isOpen title={titles[mode]} onClose={onClose} width={mode === "planned" || mode === "add" ? 900 : 760}
      footer={<>
        <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
        <button className={styles.btnPrimary} onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </>}>
      {error && <div className={styles.formError} role="alert">{error}</div>}
      {zone && <div className={styles.subtle} style={{ marginBottom: 10 }}>Times in port local time — {zoneLabel(zone)}. The UTC equivalent is shown under each field.</div>}

      {mode === "add" && (
        <div className={styles.formGrid} style={{ marginBottom: 12 }}>
          <div className={styles.field}>
            <label>Port<span className={styles.req}>*</span></label>
            <Select inputId="pc-add-port" options={options.ports} value={form.port} onChange={(o) => set({ port: o, agent: form.agent || (o && o.defaultAgents && o.defaultAgents[0] ? { value: o.defaultAgents[0]._id, label: o.defaultAgents[0].companyName } : null) })} />
          </div>
          <div className={styles.field}>
            <label>Type</label>
            <select className={`${styles.select} ${styles.input}`} value={form.type} onChange={(e) => set({ type: e.target.value })} aria-label="New port call type">
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label>Position in the rotation</label>
            <select className={`${styles.select} ${styles.input}`} value={form.position} onChange={(e) => set({ position: e.target.value })} aria-label="Position">
              <option value="">At the end</option>
              {portCalls.filter((p) => p.status !== "CANCELLED").map((p) => <option key={p._id} value={p.seq}>Before {p.seq}. {p.port?.name}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label>Agent</label>
            <Select inputId="pc-add-agent" options={options.agents} value={form.agent} onChange={(o) => set({ agent: o })} isClearable />
          </div>
        </div>
      )}

      {(mode === "details" || mode === "add") && (
        <div className={styles.formGrid} style={{ marginBottom: 12 }}>
          {mode === "details" && (
            <div className={styles.field}>
              <label>Agent</label>
              <Select inputId="pc-agent" options={options.agents} value={form.agent} onChange={(o) => set({ agent: o })} isClearable />
            </div>
          )}
          <div className={styles.field}>
            <label>{type === "BUNKERING" ? "Quantity" : "Cargo quantity"}</label>
            <input className={styles.input} type="number" min="0" value={form.cargoQty} onChange={(e) => set({ cargoQty: e.target.value })} aria-label="Cargo quantity" />
          </div>
          <div className={styles.field}>
            <label>Rate / day</label>
            <input className={styles.input} type="number" min="0" value={form.ratePerDay} onChange={(e) => set({ ratePerDay: e.target.value })} disabled={type === "BUNKERING"} aria-label="Rate per day" />
            {mode === "details" && <div className={styles.hint}>Changing the rate changes the suggested ETC (and the tasks that depend on it)</div>}
          </div>
          {mode === "details" && (
            <div className={`${styles.field} ${styles.full}`}><label>Remarks</label><textarea className={styles.textarea} value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} /></div>
          )}
        </div>
      )}

      {(mode === "planned" || mode === "add") && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          {PLANNED.map(([k, label]) => {
            const suggested = k !== "eta" && !form.manual[k] && Boolean(effective[k]);
            return (
              <div key={k} className={styles.field}>
                <label>{label}{suggested && <span className={styles.defaulted}>suggested</span>}</label>
                <PortDateTimeInput value={k === "eta" ? form.planned.eta : effective[k]} zone={zone} suggested={suggested}
                  onChange={(iso) => setPlanned(k, iso)} onReset={k === "eta" ? undefined : () => resetPlanned(k)} ariaLabel={`Planned ${label}`} />
                {mode === "planned" && portCall.original?.[k] && <div className={styles.hint}>Original plan kept for comparison</div>}
              </div>
            );
          })}
        </div>
      )}

      {mode === "actual" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {ACTUALS.map(([k, label]) => (
            <div key={k} className={styles.field}>
              <label>{label}</label>
              <PortDateTimeInput value={form.actual[k] || null} zone={zone} onChange={(iso) => setActual(k, iso)} ariaLabel={`Actual ${label}`} />
            </div>
          ))}
          <div className={`${styles.hint} ${styles.full}`}>Entering ATA / ATB / ATD moves the vessel status automatically, and tasks keyed to these times move to the actual dates.</div>
        </div>
      )}

      {mode !== "add" && (
        <div className={styles.field} style={{ marginTop: 12 }}>
          <label>Reason for the change <span className={styles.subtle}>(optional, kept in the revision log)</span></label>
          <input className={styles.input} value={form.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="e.g. Delay at previous port" aria-label="Reason" />
        </div>
      )}
    </OpsModal>
  );
}

export default PortCallDialog;
