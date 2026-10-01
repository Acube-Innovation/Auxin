// Validates and normalises voyage / port-call input from the API (features B1–B8, C1).
// All date-times arrive as ISO 8601 instants (the UI converts port local time to UTC).
const mongoose = require('mongoose');
const Vessel = require('../../models/ops/Vessel');
const Port = require('../../models/ops/Port');
const Client = require('../../models/Client');
const Employee = require('../../models/Employee');
const { parseInstant } = require('./time');
const { OFFICE_TZ } = require('./config');
const { PORT_TYPES, VOYAGE_TYPES } = require('./constants');

const has = (obj, key) => obj && Object.prototype.hasOwnProperty.call(obj, key);

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function refId(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const id = typeof value === 'object' && value._id ? value._id : value;
  if (!mongoose.isValidObjectId(id)) throw badRequest(`${label} is not a valid id`);
  return String(id);
}

function refIds(values, label) {
  if (values === null || values === undefined) return [];
  if (!Array.isArray(values)) throw badRequest(`${label} must be a list`);
  return [...new Set(values.map((v) => refId(v, label)).filter(Boolean))];
}

function num(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw badRequest(`${label} must be a number of 0 or more`);
  return n;
}

async function assertExist(Model, ids, label, extraFilter = {}) {
  const list = ids.filter(Boolean);
  if (!list.length) return;
  const found = await Model.countDocuments({ _id: { $in: list }, ...extraFilter });
  if (found !== list.length) throw badRequest(`${label} not found`);
}

// "a must not be after b" for every pair that is set
function assertOrder(pairs) {
  for (const [aLabel, a, bLabel, b] of pairs) {
    if (a && b && a.getTime() > b.getTime()) throw badRequest(`${bLabel} cannot be before ${aLabel}`);
  }
}

const portZone = async (portId) => {
  if (!portId) return null;
  const port = await Port.findById(portId).select('timeZone').lean();
  if (!port) throw badRequest('Port not found');
  return port.timeZone;
};

// Delivery / re-delivery block
async function handover(input, label, current = {}) {
  if (!input || typeof input !== 'object') throw badRequest(`${label} must be an object`);
  const out = { ...current };
  if (has(input, 'place')) out.place = input.place ? String(input.place).trim() : '';
  if (has(input, 'port')) {
    out.port = refId(input.port, `${label} port`);
    out.timeZone = (await portZone(out.port)) || OFFICE_TZ;
  }
  if (!out.timeZone) out.timeZone = OFFICE_TZ;
  if (has(input, 'estimated')) out.estimated = parseInstant(input.estimated, `${label} estimated`);
  if (has(input, 'actual')) out.actual = parseInstant(input.actual, `${label} actual`);
  return out;
}

// Voyage fields. `current` is the existing voyage (plain object) for updates.
async function normaliseVoyage(body, current = null) {
  const b = body || {};
  const out = {};

  if (has(b, 'voyageType')) {
    if (!VOYAGE_TYPES.includes(b.voyageType)) throw badRequest(`voyageType must be one of ${VOYAGE_TYPES.join(', ')}`);
    out.voyageType = b.voyageType;
  }
  if (has(b, 'vessel') || !current) {
    out.vessel = refId(b.vessel, 'Vessel');
    if (!out.vessel) throw badRequest('Vessel is required');
    // A new voyage must use an active vessel; an existing one may keep a vessel deactivated since
    const changed = !current || String(current.vessel) !== out.vessel;
    await assertExist(Vessel, [out.vessel], changed ? 'Active vessel' : 'Vessel', changed ? { isActive: true } : {});
  }
  if (has(b, 'master')) {
    const m = b.master || {};
    out.master = { name: (m.name || '').trim(), email: (m.email || '').trim().toLowerCase(), phone: (m.phone || '').trim() };
    if (out.master.email && !/^\S+@\S+\.\S+$/.test(out.master.email)) throw badRequest("Master's email is not valid");
  }
  for (const key of ['charterers', 'owners']) {
    if (has(b, key)) {
      out[key] = refId(b[key], key === 'charterers' ? 'Charterer' : 'Owners');
      await assertExist(Client, [out[key]], key === 'charterers' ? 'Charterer' : 'Owners');
    }
  }
  if (has(b, 'brokers')) {
    out.brokers = refIds(b.brokers, 'Broker');
    await assertExist(Client, out.brokers, 'Broker');
  }
  if (has(b, 'operators')) {
    out.operators = refIds(b.operators, 'Operator');
    await assertExist(Employee, out.operators, 'Operator');
  }
  if (has(b, 'fixture')) {
    const f = b.fixture || {};
    const prev = (current && current.fixture) || {};
    const keys = ['cargoFixedAt', 'vesselFixedAt', 'cargoLaycanFrom', 'cargoLaycanTo', 'vesselLaycanFrom', 'vesselLaycanTo', 'cpDate'];
    out.fixture = {};
    for (const k of keys) out.fixture[k] = has(f, k) ? parseInstant(f[k], `Fixture ${k}`) : (prev[k] || null);
    assertOrder([
      ['cargo laycan from', out.fixture.cargoLaycanFrom, 'Cargo laycan to', out.fixture.cargoLaycanTo],
      ['vessel laycan from', out.fixture.vesselLaycanFrom, 'Vessel laycan to', out.fixture.vesselLaycanTo],
    ]);
  }
  if (has(b, 'cargo')) {
    if (!Array.isArray(b.cargo)) throw badRequest('cargo must be a list');
    out.cargo = b.cargo.map((c, i) => {
      if (!c || !String(c.description || '').trim()) throw badRequest(`Cargo line ${i + 1}: description is required`);
      return {
        description: String(c.description).trim(),
        quantity: num(c.quantity, `Cargo line ${i + 1} quantity`),
        unit: (c.unit || 'MT').trim(),
        packages: num(c.packages, `Cargo line ${i + 1} packages`),
        packageUnit: (c.packageUnit || '').trim(),
        remarks: c.remarks || '',
      };
    });
  }
  if (has(b, 'delivery')) out.delivery = await handover(b.delivery, 'Delivery', (current && current.delivery) || {});
  if (has(b, 'redelivery')) out.redelivery = await handover(b.redelivery, 'Re-delivery', (current && current.redelivery) || {});
  const deliveryAt = (out.delivery || (current && current.delivery) || {});
  const redeliveryAt = (out.redelivery || (current && current.redelivery) || {});
  assertOrder([
    ['estimated delivery', deliveryAt.estimated, 'Estimated re-delivery', redeliveryAt.estimated],
    ['actual delivery', deliveryAt.actual, 'Actual re-delivery', redeliveryAt.actual],
  ]);

  if (has(b, 'bunker')) {
    const k = b.bunker || {};
    const prev = (current && current.bunker) || {};
    out.bunker = {
      bookedOn: has(k, 'bookedOn') ? parseInstant(k.bookedOn, 'Bunker booked on') : (prev.bookedOn || null),
      bunkeringDate: has(k, 'bunkeringDate') ? parseInstant(k.bunkeringDate, 'Bunkering date') : (prev.bunkeringDate || null),
      supplier: has(k, 'supplier') ? refId(k.supplier, 'Bunker supplier') : (prev.supplier || null),
      grade: has(k, 'grade') ? (k.grade || '').trim() : (prev.grade || ''),
      quantity: has(k, 'quantity') ? num(k.quantity, 'Bunker quantity') : (prev.quantity ?? null),
      portCall: has(k, 'portCall') ? refId(k.portCall, 'Bunkering port call') : (prev.portCall || null),
    };
    await assertExist(Client, [out.bunker.supplier], 'Bunker supplier');
  }
  if (has(b, 'remarks')) out.remarks = b.remarks || '';
  return out;
}

// One port call. `current` is the existing port call for updates.
async function normalisePortCall(input, current = null, index = null) {
  const p = input || {};
  const label = index !== null ? `Port call ${index + 1}` : 'Port call';
  const out = {};
  if (has(p, 'port') || !current) {
    out.port = refId(p.port, `${label} port`);
    if (!out.port) throw badRequest(`${label}: port is required`);
    out.timeZone = await portZone(out.port);
  }
  if (has(p, 'type') || !current) {
    if (!PORT_TYPES.includes(p.type)) throw badRequest(`${label}: type must be one of ${PORT_TYPES.join(', ')}`);
    out.type = p.type;
  }
  if (has(p, 'agent')) {
    out.agent = refId(p.agent, `${label} agent`);
    await assertExist(Client, [out.agent], `${label} agent`);
  }
  if (has(p, 'cargoQty')) out.cargoQty = num(p.cargoQty, `${label} cargo quantity`);
  if (has(p, 'ratePerDay')) out.ratePerDay = num(p.ratePerDay, `${label} rate per day`);
  if (has(p, 'remarks')) out.remarks = p.remarks || '';

  const prevPlanned = (current && current.planned) || {};
  const prevActual = (current && current.actual) || {};
  const planned = { ...prevPlanned };
  const actual = { ...prevActual };
  if (has(p, 'planned')) {
    for (const k of ['eta', 'etb', 'etc', 'ets']) if (has(p.planned, k)) planned[k] = parseInstant(p.planned[k], `${label} ${k.toUpperCase()}`);
    out.planned = { eta: planned.eta || null, etb: planned.etb || null, etc: planned.etc || null, ets: planned.ets || null };
  }
  if (has(p, 'actual')) {
    for (const k of ['ata', 'norTendered', 'pob', 'atb', 'commenced', 'completed', 'atd']) {
      if (has(p.actual, k)) actual[k] = parseInstant(p.actual[k], `${label} ${k}`);
    }
    out.actual = Object.fromEntries(['ata', 'norTendered', 'pob', 'atb', 'commenced', 'completed', 'atd'].map((k) => [k, actual[k] || null]));
  }
  if (has(p, 'manual')) {
    const m = p.manual || {};
    out.manual = { etb: Boolean(m.etb), etc: Boolean(m.etc), ets: Boolean(m.ets) };
  }

  assertOrder([
    [`${label} ETA`, planned.eta, `${label} ETB`, planned.etb],
    [`${label} ETB`, planned.etb, `${label} ETC`, planned.etc],
    [`${label} ETC`, planned.etc, `${label} ETS`, planned.ets],
    [`${label} ATA`, actual.ata, `${label} ATB`, actual.atb],
    [`${label} ATB`, actual.atb, `${label} operations commenced`, actual.commenced],
    [`${label} operations commenced`, actual.commenced, `${label} operations completed`, actual.completed],
    [`${label} operations completed`, actual.completed, `${label} ATD`, actual.atd],
    [`${label} ATA`, actual.ata, `${label} ATD`, actual.atd],
  ]);
  return out;
}

module.exports = { normaliseVoyage, normalisePortCall, badRequest, refId };
