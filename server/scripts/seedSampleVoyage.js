// Creates the sample voyage from the client's sheet (Development Scope §13) as a DRAFT, for testing.
//   node scripts/seedSampleVoyage.js          create it if it does not exist yet
//   node scripts/seedSampleVoyage.js --reset  delete the sample voyage and create it again
//   add --today to shift every date so the voyage starts today (cargo fixed = today), keeping all gaps
// Needs the masters seed (node scripts/seedOps.js) and, ideally, an employee with email ops1@auxin.local.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const Voyage = require('../models/ops/Voyage');
const PortCall = require('../models/ops/PortCall');
const Vessel = require('../models/ops/Vessel');
const Port = require('../models/ops/Port');
const Counter = require('../models/ops/Counter');
const Client = require('../models/Client');
const Employee = require('../models/Employee');
const { localToUtc } = require('../services/ops/time');
const { applySuggestions } = require('../services/ops/suggestions');
const { OFFICE_TZ } = require('../services/ops/config');

const MARK = 'SAMPLE VOYAGE – client sheet (Development Scope §13)';
const RESET = process.argv.includes('--reset');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const existing = await Voyage.findOne({ remarks: MARK });
  if (existing && !RESET) {
    console.log(`Sample voyage already exists: ${existing.voyageNo} (use --reset to recreate)`);
    return mongoose.disconnect();
  }
  if (existing) {
    await PortCall.deleteMany({ voyage: existing._id });
    await require('../models/ops/VoyageTask').deleteMany({ voyage: existing._id });
    await require('../models/ops/DateRevision').deleteMany({ voyage: existing._id });
    await existing.deleteOne();
    console.log(`Deleted previous sample voyage ${existing.voyageNo}`);
  }

  const vessel = await Vessel.findOne({ name: 'MV Auxin Sample' });
  const ports = Object.fromEntries((await Port.find({ unlocode: { $in: ['DJJIB', 'OMSLL', 'INCOK', 'INKAK'] } })).map((p) => [p.unlocode, p]));
  if (!vessel || Object.keys(ports).length !== 4) throw new Error('Run "node scripts/seedOps.js" first (sample vessel and ports missing)');

  const operator = (await Employee.findOne({ emailId: 'ops1@auxin.local' })) || (await Employee.findOne({ employeeStatus: 'Active' }));
  if (!operator) throw new Error('No employee found to act as operator. Create one in Team Management first.');
  const charterer = await Client.findOne({ clientType: 'Charterer' });
  const agent = await Client.findOne({ clientType: 'Agent' });

  // --today: move the whole voyage so that "cargo fixed" (25-Jun-2026 in the client sheet) is today
  const shiftDays = process.argv.includes('--today')
    ? Math.round(DateTime.now().setZone(OFFICE_TZ).startOf('day').diff(DateTime.fromISO('2026-06-25', { zone: OFFICE_TZ }), 'days').days)
    : 0;
  const at = (local, zone) => DateTime.fromJSDate(localToUtc(local, zone)).plus({ days: shiftDays }).toJSDate();
  const year = DateTime.now().setZone(OFFICE_TZ).year;
  const voyageNo = `VOY-${year}-${String(await Counter.next(`voyage-${year}`)).padStart(4, '0')}`;

  const voyage = await Voyage.create({
    voyageNo,
    status: 'DRAFT',
    voyageType: 'TC_TRIP',
    vessel: vessel._id,
    master: { name: 'Capt. Sample Master', email: 'master@auxin-sample.local', phone: '+000 0000 0000' },
    charterers: charterer?._id || null,
    operators: [operator._id],
    fixture: {
      cargoFixedAt: at('2026-06-25T10:00', OFFICE_TZ),
      vesselFixedAt: at('2026-06-27T10:00', OFFICE_TZ),
    },
    cargo: [{ description: 'Limestone', quantity: 61535, unit: 'MT' }],
    delivery: { place: 'Djibouti', port: ports.DJJIB._id, timeZone: ports.DJJIB.timeZone, estimated: at('2026-07-05T06:00', ports.DJJIB.timeZone) },
    redelivery: { place: 'DLOSP Kakinada', port: ports.INKAK._id, timeZone: ports.INKAK.timeZone, estimated: at('2026-07-27T05:30', ports.INKAK.timeZone) },
    bunker: { grade: 'VLSFO', quantity: 450 },
    remarks: MARK,
  });

  const rotation = [
    { voyage: voyage._id, seq: 1, port: ports.OMSLL._id, timeZone: ports.OMSLL.timeZone, type: 'LOADING', agent: agent?._id || null, cargoQty: 61535, planned: { eta: at('2026-07-05T11:30', ports.OMSLL.timeZone) } },
    { voyage: voyage._id, seq: 2, port: ports.INCOK._id, timeZone: ports.INCOK.timeZone, type: 'BUNKERING', planned: { eta: at('2026-07-13T12:00', ports.INCOK.timeZone) } },
    { voyage: voyage._id, seq: 3, port: ports.INKAK._id, timeZone: ports.INKAK.timeZone, type: 'DISCHARGING', cargoQty: 62400, ratePerDay: 20000, planned: { eta: at('2026-07-21T12:00', ports.INKAK.timeZone) } },
  ];
  rotation.forEach((pc) => { pc.manual = { etb: false, etc: false, ets: false }; applySuggestions(pc); }); // ETB / ETC / ETS as suggested (B7)
  const calls = await PortCall.insertMany(rotation);
  voyage.bunker.portCall = calls[1]._id;
  await voyage.save();

  console.log(`Created sample voyage ${voyage.voyageNo} (DRAFT): MV Auxin Sample, Djibouti → Salalah (L) → Kochi (B) → Kakinada (D)${shiftDays ? ` — dates shifted ${shiftDays} days to start today` : ''}`);
  console.log(`  operator: ${operator.employeeName} · charterer: ${charterer?.companyName || '—'} · Salalah agent: ${agent?.companyName || '—'}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Sample voyage failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
