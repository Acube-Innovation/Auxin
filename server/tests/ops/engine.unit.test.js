// Unit tests for the due-date engine, suggestions and vessel status (no database).
// Run: npm run test:ops   (from server/)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../../services/ops/dueDateEngine');
const { suggest, manualFlagsFromInput } = require('../../services/ops/suggestions');
const { deriveVesselStatus, effectiveVesselStatus } = require('../../services/ops/vesselStatus');
const { localToUtc } = require('../../services/ops/time');

const at = localToUtc;
const MUSCAT = 'Asia/Muscat';
const KOLKATA = 'Asia/Kolkata';
const DJIBOUTI = 'Africa/Djibouti';

// The client sample voyage (Development Scope §13)
const voyage = {
  voyageType: 'TC_TRIP',
  fixture: { cargoFixedAt: at('2026-06-25T10:00', KOLKATA), vesselFixedAt: at('2026-06-27T10:00', KOLKATA) },
  delivery: { estimated: at('2026-07-05T06:00', DJIBOUTI), timeZone: DJIBOUTI },
  redelivery: { estimated: at('2026-07-27T05:30', KOLKATA), timeZone: KOLKATA },
  bunker: {},
};
const salalah = { _id: 'pc1', seq: 1, type: 'LOADING', timeZone: MUSCAT, cargoQty: 61535, planned: { eta: at('2026-07-05T11:30', MUSCAT) }, actual: {} };
const kochi = { _id: 'pc2', seq: 2, type: 'BUNKERING', timeZone: KOLKATA, planned: { eta: at('2026-07-13T12:00', KOLKATA) }, actual: {} };
const kakinada = { _id: 'pc3', seq: 3, type: 'DISCHARGING', timeZone: KOLKATA, cargoQty: 62400, ratePerDay: 20000, planned: { eta: at('2026-07-21T12:00', KOLKATA) }, actual: {} };
const calls = [salalah, kochi, kakinada];
const rule = (event, offsetDays, extra = {}) => ({ anchor: { event, basis: 'BEST' }, offsetDays, ...extra });

test('due dates of the scope §13 examples', () => {
  assert.equal(engine.dueDateFor(rule('CARGO_FIXED', 1), voyage, null, calls), '2026-06-26');   // Read Cargo Recap
  assert.equal(engine.dueDateFor(rule('VESSEL_FIXED', -1), voyage, null, calls), '2026-06-26'); // Initial Voyage Estimation
  assert.equal(engine.dueDateFor(rule('VESSEL_FIXED', 1), voyage, null, calls), '2026-06-28');  // Read Vessel Recap
  assert.equal(engine.dueDateFor(rule('DELIVERY', -2), voyage, null, calls), '2026-07-03');     // Check Waypoints
  assert.equal(engine.dueDateFor(rule('ARRIVAL', -5), voyage, salalah, calls), '2026-06-30');   // Appoint Loadport Agent
  assert.equal(engine.dueDateFor(rule('ARRIVAL', -10), voyage, kakinada, calls), '2026-07-11'); // Appoint Discharge Port Agents
  assert.equal(engine.dueDateFor(rule('REDELIVERY', -15), voyage, null, calls), '2026-07-12');  // Re-delivery notice 15 days
});

test('calendar date in port local time replaces Excel ROUND (Kochi ETA 12:00 − 2 days = 11-Jul, not 12-Jul)', () => {
  assert.equal(engine.dueDateFor(rule('ARRIVAL', -2), voyage, kochi, calls), '2026-07-11');
});

test('the zone decides the calendar day around midnight', () => {
  const late = new Date('2026-07-04T22:00:00Z'); // 02:00 on 5 July in Muscat, still 4 July in UTC
  assert.equal(engine.computeDueDate(late, MUSCAT, 0), '2026-07-05');
  assert.equal(engine.computeDueDate(late, 'UTC', 0), '2026-07-04');
});

test('basis: BEST prefers the actual, ESTIMATE ignores it, ACTUAL waits for it', () => {
  const pc = { ...salalah, actual: { ata: at('2026-07-07T09:00', MUSCAT) } };
  assert.equal(engine.dueDateFor(rule('ARRIVAL', 0), voyage, pc, calls), '2026-07-07');
  assert.equal(engine.dueDateFor({ anchor: { event: 'ARRIVAL', basis: 'ESTIMATE' }, offsetDays: 0 }, voyage, pc, calls), '2026-07-05');
  assert.equal(engine.dueDateFor({ anchor: { event: 'ARRIVAL', basis: 'ACTUAL' }, offsetDays: 0 }, voyage, salalah, calls), null);
});

test('unknown key date gives no due date (awaiting date)', () => {
  assert.equal(engine.dueDateFor(rule('BUNKER_BOOKED', 0), voyage, null, calls), null);
});

test('bunkering date: explicit date wins, else berthing at the bunkering call', () => {
  const withEtb = { ...kochi, planned: { ...kochi.planned, etb: at('2026-07-14T00:00', KOLKATA) } };
  assert.equal(engine.dueDateFor(rule('BUNKERING_DATE', 1), voyage, withEtb, [salalah, withEtb, kakinada]), '2026-07-15');
  const v2 = { ...voyage, bunker: { bunkeringDate: at('2026-07-16T08:00', KOLKATA), portCall: 'pc2' } };
  assert.equal(engine.dueDateFor(rule('BUNKERING_DATE', 1), v2, withEtb, [salalah, withEtb, kakinada]), '2026-07-17');
});

test('sailing uses ATD, else ETS, else ETC', () => {
  const pc = { ...salalah, planned: { ...salalah.planned, etc: at('2026-07-09T16:18', MUSCAT) } };
  assert.equal(engine.dueDateFor(rule('SAILING', 1), voyage, pc, calls), '2026-07-10');
  pc.actual = { atd: at('2026-07-11T18:00', MUSCAT) };
  assert.equal(engine.dueDateFor(rule('SAILING', 1), voyage, pc, calls), '2026-07-12');
});

test('recurring hire payment: every 15 days from delivery until re-delivery', () => {
  const hire = rule('DELIVERY', 15, { recurrence: { everyDays: 15, until: 'REDELIVERY' } });
  assert.deepEqual(engine.recurringDueDates(hire, voyage, null, calls), ['2026-07-20']);
  const longer = { ...voyage, redelivery: { ...voyage.redelivery, estimated: at('2026-08-30T05:30', KOLKATA) } };
  assert.deepEqual(engine.recurringDueDates(hire, longer, null, calls), ['2026-07-20', '2026-08-04', '2026-08-19']);
  assert.equal(engine.dueDateFor(hire, longer, null, calls, 2), '2026-08-19');
  assert.equal(engine.dueDateFor(hire, longer, null, calls, 3), null); // after re-delivery
});

test('derived values: overdue, pending, due in, buckets and colours', () => {
  const today = '2026-07-10';
  assert.deepEqual(
    { ...engine.derive({ status: 'NOT_STARTED', dueDate: '2026-07-07' }, today) },
    { overdueDays: 3, pendingDays: null, dueInDays: null, bucket: 'OVERDUE', colour: 'red', onTime: null },
  );
  assert.equal(engine.derive({ status: 'INITIATED', dueDate: '2026-07-07', startDate: '2026-07-06' }, today).pendingDays, 3);
  assert.equal(engine.derive({ status: 'NOT_STARTED', dueDate: today }, today).bucket, 'TODAY');
  assert.equal(engine.derive({ status: 'NOT_STARTED', dueDate: '2026-07-17' }, today).bucket, 'NEXT_7');
  assert.equal(engine.derive({ status: 'NOT_STARTED', dueDate: '2026-07-18' }, today).bucket, 'LATER');
  assert.equal(engine.derive({ status: 'NOT_STARTED', dueDate: '2026-07-18' }, today).dueInDays, 8);
  assert.equal(engine.derive({ status: 'NOT_STARTED', dueDate: null }, today).bucket, 'AWAITING_DATE');
  const lateDone = engine.derive({ status: 'DONE', dueDate: '2026-07-07', completedDate: '2026-07-09' }, today);
  assert.equal(lateDone.overdueDays, 2);
  assert.equal(lateDone.onTime, false);
  assert.equal(lateDone.bucket, 'CLOSED');
  assert.equal(engine.derive({ status: 'NA', dueDate: '2026-07-01' }, today).overdueDays, 0);
});

test('suggestions: Salalah ETB = ETA + 4.8 h, ETC = ETB + 4 days (no rate); Kakinada ETC = ETB + 3.12 days', () => {
  const s = suggest({ ...salalah, manual: {} });
  assert.equal(s.etb.toISOString(), at('2026-07-05T16:18', MUSCAT).toISOString());
  assert.equal(s.etc.toISOString(), at('2026-07-09T16:18', MUSCAT).toISOString());
  assert.equal(s.ets.toISOString(), s.etc.toISOString());
  const k = suggest({ ...kakinada, manual: {} });
  const days = (k.etc - k.etb) / 86400000;
  assert.equal(Math.round(days * 100) / 100, 3.12);
});

test('suggestions never overwrite a value typed by the user', () => {
  const manualEtb = at('2026-07-06T08:00', MUSCAT);
  const s = suggest({ ...salalah, planned: { ...salalah.planned, etb: manualEtb }, manual: { etb: true } });
  assert.equal(s.etb.toISOString(), manualEtb.toISOString());
  assert.equal(s.etc.toISOString(), new Date(manualEtb.getTime() + 4 * 86400000).toISOString());
});

test('manual flags: typed value → manual, cleared value → back to suggestions', () => {
  assert.deepEqual(manualFlagsFromInput({ planned: { etb: '2026-07-06T04:00:00Z' } }, null), { etb: true, etc: false, ets: false });
  assert.deepEqual(manualFlagsFromInput({ planned: { etb: null } }, { etb: true, etc: true, ets: false }), { etb: false, etc: true, ets: false });
});

test('vessel status from actuals', () => {
  const v = { ...voyage };
  const pcs = calls.map((c) => ({ ...c, actual: {} }));
  assert.equal(deriveVesselStatus(v, pcs), 'AWAITING_DELIVERY');
  v.delivery = { ...v.delivery, actual: at('2026-07-05T06:00', DJIBOUTI) };
  assert.equal(deriveVesselStatus(v, pcs), 'ENROUTE_LOAD_PORT');
  pcs[0].actual = { ata: at('2026-07-05T11:00', MUSCAT) };
  assert.equal(deriveVesselStatus(v, pcs), 'WAITING_FOR_BERTH');
  pcs[0].actual.atb = at('2026-07-05T20:00', MUSCAT);
  assert.equal(deriveVesselStatus(v, pcs), 'AT_LOAD_PORT');
  pcs[0].actual.atd = at('2026-07-09T20:00', MUSCAT);
  assert.equal(deriveVesselStatus(v, pcs), 'ENROUTE_BUNKERING_PORT');
  pcs[1].actual = { ata: at('2026-07-13T12:00', KOLKATA) };
  assert.equal(deriveVesselStatus(v, pcs), 'AT_BUNKERING_PORT'); // no "waiting for berth" at bunkering calls
  pcs[1].actual.atd = at('2026-07-14T12:00', KOLKATA);
  assert.equal(deriveVesselStatus(v, pcs), 'ENROUTE_DISCHARGE_PORT');
  v.redelivery = { ...v.redelivery, actual: at('2026-07-27T05:30', KOLKATA) };
  assert.equal(deriveVesselStatus(v, pcs), 'REDELIVERED');
});

test('vessel status: under way once a port is reached, even before the actual delivery is entered', () => {
  const pcs = calls.map((c) => ({ ...c, actual: {} }));
  pcs[0].actual = { ata: at('2026-07-05T11:00', MUSCAT), atb: at('2026-07-05T20:00', MUSCAT), atd: at('2026-07-09T20:00', MUSCAT) };
  assert.equal(deriveVesselStatus(voyage, pcs), 'ENROUTE_BUNKERING_PORT');
});

test('a manual override wins over the derived status; cancelled calls are ignored', () => {
  const v = { ...voyage, vesselStatusOverride: { value: 'AWAITING_APS_DELIVERY' } };
  assert.equal(effectiveVesselStatus(v, calls), 'AWAITING_APS_DELIVERY');
  const pcs = [{ ...salalah, status: 'CANCELLED', actual: { ata: at('2026-07-05T11:00', MUSCAT) } }];
  assert.equal(deriveVesselStatus(voyage, pcs), 'AWAITING_DELIVERY');
});
