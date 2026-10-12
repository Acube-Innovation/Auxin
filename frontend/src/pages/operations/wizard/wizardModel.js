import { suggestTimes } from "../../../utils/opsSuggest";

// Form model of the New Voyage wizard: conversion between the API voyage and the form, payloads, step checks.
// Times in the form are UTC ISO strings; the inputs show them in the port's / office's local time.

let seq = 0;
export const newKey = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;

export const STEPS = ["Cargo", "Fixture & Vessel", "Port Rotation", "Delivery & Bunkers", "Task Preview", "Review & Activate"];

export const clientOption = (c) => (c ? { value: c._id, label: c.companyName } : null);
export const employeeOption = (e) => (e ? { value: e._id, label: e.employeeName } : null);
export const portOption = (p) => (p ? { value: p._id, label: `${p.name}, ${p.country || ""}`.replace(/, $/, ""), name: p.name, timeZone: p.timeZone, defaultAgents: p.defaultAgents || [] } : null);
export const vesselOption = (v) => (v ? { value: v._id, label: v.name + (v.imo ? ` (IMO ${v.imo})` : ""), owners: v.owners, ownersBroker: v.ownersBroker } : null);

const emptyTimes = () => ({ eta: null, etb: null, etc: null, ets: null });
export const emptyRow = (type = "LOADING") => ({ key: newKey(), _id: null, port: null, type, agent: null, cargoQty: "", ratePerDay: "", planned: emptyTimes(), manual: { etb: false, etc: false, ets: false }, remarks: "" });
export const emptyCargo = () => ({ key: newKey(), description: "", quantity: "", unit: "MT", packages: "", packageUnit: "", remarks: "" });
const emptyHandover = () => ({ place: "", port: null, estimated: null });

export function emptyForm() {
  return {
    voyageType: "TC_TRIP",
    vessel: null,
    master: { name: "", email: "", phone: "" },
    charterers: null,
    owners: null,
    brokers: [],
    operators: [],
    fixture: { cargoFixedAt: null, vesselFixedAt: null, cargoLaycanFrom: null, cargoLaycanTo: null, vesselLaycanFrom: null, vesselLaycanTo: null, cpDate: null },
    cargo: [emptyCargo()],
    rows: [emptyRow("LOADING"), emptyRow("DISCHARGING")],
    delivery: emptyHandover(),
    redelivery: emptyHandover(),
    bunker: { rowKey: "", supplier: null, grade: "", quantity: "", bookedOn: null, bunkeringDate: null },
    remarks: "",
  };
}

// Populated API voyage -> form
export function fromVoyage(v) {
  const rows = (v.portCalls || []).filter((pc) => pc.status !== "CANCELLED").map((pc) => ({
    key: newKey(),
    _id: pc._id,
    port: portOption(pc.port),
    type: pc.type,
    agent: clientOption(pc.agent),
    cargoQty: pc.cargoQty ?? "",
    ratePerDay: pc.ratePerDay ?? "",
    planned: { ...emptyTimes(), ...(pc.planned || {}) },
    manual: { etb: false, etc: false, ets: false, ...(pc.manual || {}) },
    remarks: pc.remarks || "",
  }));
  const bunkerRow = rows.find((r) => r._id && r._id === v.bunker?.portCall);
  const handover = (h) => ({ place: h?.place || "", port: h?.port ? portOption(h.port) : null, estimated: h?.estimated || null });
  return {
    voyageType: v.voyageType || "TC_TRIP",
    vessel: v.vessel ? { value: v.vessel._id, label: v.vessel.name + (v.vessel.imo ? ` (IMO ${v.vessel.imo})` : "") } : null,
    master: { name: v.master?.name || "", email: v.master?.email || "", phone: v.master?.phone || "" },
    charterers: clientOption(v.charterers),
    owners: clientOption(v.owners),
    brokers: (v.brokers || []).map(clientOption),
    operators: (v.operators || []).map(employeeOption),
    fixture: { ...emptyForm().fixture, ...(v.fixture || {}) },
    cargo: (v.cargo || []).length ? v.cargo.map((c) => ({ key: newKey(), description: c.description, quantity: c.quantity ?? "", unit: c.unit || "MT", packages: c.packages ?? "", packageUnit: c.packageUnit || "", remarks: c.remarks || "" })) : [emptyCargo()],
    rows,
    delivery: handover(v.delivery),
    redelivery: handover(v.redelivery),
    bunker: {
      rowKey: bunkerRow ? bunkerRow.key : "",
      supplier: clientOption(v.bunker?.supplier),
      grade: v.bunker?.grade || "",
      quantity: v.bunker?.quantity ?? "",
      bookedOn: v.bunker?.bookedOn || null,
      bunkeringDate: v.bunker?.bunkeringDate || null,
    },
    remarks: v.remarks || "",
  };
}

const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
const val = (o) => (o ? o.value : null);

// Voyage fields for POST / PUT (bunker.portCall is set separately once port calls have ids)
export function voyagePayload(form) {
  return {
    voyageType: form.voyageType,
    vessel: val(form.vessel),
    master: form.master,
    charterers: val(form.charterers),
    owners: val(form.owners),
    brokers: form.brokers.map(val),
    operators: form.operators.map(val),
    fixture: form.fixture,
    cargo: form.cargo.filter((c) => String(c.description).trim()).map((c) => ({
      description: c.description.trim(), quantity: num(c.quantity), unit: c.unit || "MT", packages: num(c.packages), packageUnit: c.packageUnit, remarks: c.remarks,
    })),
    delivery: { place: form.delivery.place, port: val(form.delivery.port), estimated: form.delivery.estimated },
    redelivery: { place: form.redelivery.place, port: val(form.redelivery.port), estimated: form.redelivery.estimated },
    bunker: {
      supplier: val(form.bunker.supplier), grade: form.bunker.grade, quantity: num(form.bunker.quantity),
      bookedOn: form.bunker.bookedOn, bunkeringDate: form.bunker.bunkeringDate,
    },
    remarks: form.remarks,
  };
}

// One port call. Suggested (not manual) ETB / ETC / ETS are sent as null so the server keeps suggesting them.
export function rowPayload(row) {
  return {
    port: val(row.port),
    type: row.type,
    agent: val(row.agent),
    cargoQty: num(row.cargoQty),
    ratePerDay: num(row.ratePerDay),
    remarks: row.remarks,
    planned: {
      eta: row.planned.eta || null,
      etb: row.manual.etb ? row.planned.etb : null,
      etc: row.manual.etc ? row.planned.etc : null,
      ets: row.manual.ets ? row.planned.ets : null,
    },
  };
}

// Problems that stop the user leaving a step (null = fine)
export function stepError(step, form, { isOperator, settings } = {}) {
  if (step === 2) {
    if (!form.vessel) return "Choose the vessel";
    if (!form.operators.length && !isOperator) return "Choose at least one operator";
    if (form.master.email && !/^\S+@\S+\.\S+$/.test(form.master.email)) return "The Master's email is not valid";
    const f = form.fixture;
    if (f.cargoLaycanFrom && f.cargoLaycanTo && f.cargoLaycanTo < f.cargoLaycanFrom) return "Cargo laycan 'to' is before 'from'";
    if (f.vesselLaycanFrom && f.vesselLaycanTo && f.vesselLaycanTo < f.vesselLaycanFrom) return "Vessel laycan 'to' is before 'from'";
  }
  if (step === 1) {
    const bad = form.cargo.find((c) => !String(c.description).trim() && (c.quantity !== "" || c.packages !== ""));
    if (bad) return "Every cargo line with a quantity needs a description";
  }
  if (step === 3) {
    if (!form.rows.length) return "Add at least one port call";
    const i = form.rows.findIndex((r) => !r.port);
    if (i >= 0) return `Port call ${i + 1}: choose the port`;
    for (const [n, r] of form.rows.entries()) {
      const p = suggestTimes(r, settings); // typed values and suggestions together
      const order = [["ETA", p.eta, "ETB", p.etb], ["ETB", p.etb, "ETC", p.etc], ["ETC", p.etc, "ETS", p.ets]];
      for (const [a, av, b, bv] of order) if (av && bv && bv < av) return `Port call ${n + 1}: ${b} cannot be before ${a}`;
    }
  }
  if (step === 4) {
    const d = form.delivery.estimated;
    const r = form.redelivery.estimated;
    if (d && r && r < d) return "Re-delivery cannot be before delivery";
    if (form.bunker.rowKey && !form.rows.some((row) => row.key === form.bunker.rowKey && row.type === "BUNKERING")) return "The bunkering port must be a Bunkering port call";
  }
  return null;
}
