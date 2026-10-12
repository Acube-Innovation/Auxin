// Seeds the Vessel Operations masters from the client's "Vessel Operations.xlsx"
// (Phase 2 Feature List Appendix A/C, Development Scope Appendix A).
//
//   node scripts/seedOps.js          add anything missing; never overwrites edits made in the app
//   node scripts/seedOps.js --reset  also restore seeded records to their original values
//
// Run from the server/ folder (reads MONGO_URI from .env).
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const OpsStage = require('../models/ops/OpsStage');
const TaskTemplate = require('../models/ops/TaskTemplate');
const DailyCheckTemplate = require('../models/ops/DailyCheckTemplate');
const Port = require('../models/ops/Port');
const Vessel = require('../models/ops/Vessel');

const RESET = process.argv.includes('--reset');

// ------------------------------------------------------------------ stages (feature list 2.1)
const STAGES = [
  ['CARGO_FIXED', 'Once Cargo Fixed', 'VOYAGE', null],
  ['BEFORE_SUBS', 'Before Vessel Subs Lifted', 'VOYAGE', null],
  ['VESSEL_FIXED', 'Once Vessel Fixed', 'VOYAGE', null],
  ['PRE_DELIVERY', 'Pre-Vessel Delivery', 'VOYAGE', null],
  ['DELIVERED', 'Once Vessel Delivered', 'VOYAGE', null],
  ['BUNKER_BOOKED', 'Once Bunker Booked', 'VOYAGE', null],
  ['PRE_ARRIVAL_LP', 'Pre-Arrival Load Port', 'PORT_CALL', 'LOADING'],
  ['AT_LP', 'At Load Port', 'PORT_CALL', 'LOADING'],
  ['AFTER_SAILING_LP', 'After Sailing Load Port', 'PORT_CALL', 'LOADING'],
  ['PRE_ARRIVAL_BP', 'Pre-Arrival Bunkering Port', 'PORT_CALL', 'BUNKERING'],
  ['AT_BP', 'At Bunkering Port', 'PORT_CALL', 'BUNKERING'],
  ['AFTER_SAILING_BP', 'After Sailing Bunkering Port', 'PORT_CALL', 'BUNKERING'],
  ['PRE_ARRIVAL_DP', 'Pre-Arrival Discharge Port', 'PORT_CALL', 'DISCHARGING'],
  ['AT_DP', 'At Discharge Port', 'PORT_CALL', 'DISCHARGING'],
  ['AFTER_SAILING_DP', 'After Sailing Discharge Port', 'PORT_CALL', 'DISCHARGING'],
  ['REDELIVERY_NOTICES', 'Re-Delivery Notices', 'VOYAGE', null],
  ['ON_REDELIVERY', 'On Vessel Re-Delivery', 'VOYAGE', null],
  ['VOYAGE_RECURRING', 'Voyage-wise (Recurring)', 'VOYAGE', null],
];

// ------------------------------------------------------------------ task templates (scope Appendix A)
// [code, name, anchor, offsetDays, priority (null = not given in sheet), source, extra]
const E = 'EXCEL', P = 'PROPOSED', C = 'CORRECTED';
const TEMPLATES = {
  CARGO_FIXED: [
    ['T001', 'Read Cargo Recap', 'CARGO_FIXED', 1, 'HIGH', E],
    ['T002', 'IMBSC Code Check', 'CARGO_FIXED', 1, 'MEDIUM', E],
    ['T003', 'Get Shipper Contact details & Loadport Agent Details', 'CARGO_FIXED', 1, 'LOW', E],
    ['T004', 'Send Shipper Contact to Loadport Agent', 'CARGO_FIXED', 1, 'LOW', E],
    ['T005', 'Check Loadport & Discharge port PDA & Restrictions', 'CARGO_FIXED', 1, 'HIGH', E],
    ['T006', 'Update Charts FN Main Terms in Excel', 'CARGO_FIXED', 1, 'MEDIUM', E],
    ['T007', 'Get Weather Routing Cost', 'CARGO_FIXED', 1, 'HIGH', E],
    ['T008', 'Create terms for Owners negotiation', 'CARGO_FIXED', 1, 'MEDIUM', E],
  ],
  BEFORE_SUBS: [
    ['T009', 'Initial Voyage Estimation', 'VESSEL_FIXED', -1, 'MEDIUM', E],
    ['T010', 'Check Vessel historic performance speed bss WRI', 'VESSEL_FIXED', -1, 'HIGH', E],
    ['T011', 'Vessel Trading Certificate', 'VESSEL_FIXED', -1, 'HIGH', E],
    ['T012', 'Updated LP & DP & Bunkering PDA bss Final Vsl', 'VESSEL_FIXED', -1, 'HIGH', E],
    ['T013', 'Vessel Nomination', 'VESSEL_FIXED', -1, 'HIGH', E],
  ],
  VESSEL_FIXED: [
    ['T014', 'Read Vessel Recap', 'VESSEL_FIXED', 1, 'HIGH', E],
    ['T015', 'Get Master Contact details', 'VESSEL_FIXED', 1, null, E],
    ['T016', 'Send Introduction Email to Master', 'VESSEL_FIXED', 1, null, E],
    ['T017', 'Update Owners FN Main Terms in Excel', 'VESSEL_FIXED', 1, null, E],
    ['T018', 'Prepare/Send Voyage Instruction', 'VESSEL_FIXED', 1, null, E],
    ['T019', 'Prepare Owners FN', 'VESSEL_FIXED', 1, null, E],
    ['T020', 'Ask Charts FN from Brokers', 'VESSEL_FIXED', 1, null, E],
    ['T021', 'Ask Owners WCP from Brokers', 'VESSEL_FIXED', 1, null, E],
    ['T022', 'Ask Charts WCP from Brokers', 'VESSEL_FIXED', 1, null, E],
    ['T023', 'Pre-Stowage Plan', 'VESSEL_FIXED', 1, null, E],
    ['T024', 'Estimated Bunker Calculation (master)', 'VESSEL_FIXED', 1, null, E],
    ['T025', 'Passage Plan (Waypoints)', 'VESSEL_FIXED', 1, null, E],
    ['T026', 'Estimation bss Waypoints', 'VESSEL_FIXED', 1, null, E],
    ['T027', 'Hold Pictures', 'VESSEL_FIXED', 1, null, E],
    ['T028', 'Updated Load Port PDA + Survey Costs', 'VESSEL_FIXED', 1, null, E],
    ['T029', 'Get OPA Costings at Load Port', 'VESSEL_FIXED', 1, null, E],
    ['T030', 'Do First Hire Calculation', 'VESSEL_FIXED', 1, null, E],
  ],
  PRE_DELIVERY: [
    ['T031', 'Check Waypoints / Send to Weather Routing', 'DELIVERY', -2, null, E],
    ['T032', 'Do Bunker Calculation', 'DELIVERY', -2, null, E],
    ['T033', 'Check QTY Vsl can take without Commingling', 'DELIVERY', -2, null, E],
    ['T034', 'On-Hire Survey cost confirmation with Owners', 'DELIVERY', -2, null, E],
    ['T035', 'Master reply as per Voyage Instruction', 'DELIVERY', -2, null, E],
    ['T036', 'Appoint Weather Routing Company', 'DELIVERY', -2, null, E],
  ],
  DELIVERED: [
    ['T037', 'Bunker to be Booked', 'DELIVERY', 0, null, E, { linkedField: 'bunker.bookedOn', sourceNote: 'Proposed link: completing the task asks for the bunker booked date' }],
    ['T038', 'Proper Delivery Notice Sign Stamped', 'DELIVERY', 0, null, E, { linkedField: 'delivery.actual', sourceNote: 'Proposed link: completing the task asks for the actual delivery time' }],
    ['T039', 'Apply For P&I Cover', 'DELIVERY', 0, null, E],
    ['T040', 'Ask for 1st Hire Invoice', 'DELIVERY', 0, null, E],
  ],
  BUNKER_BOOKED: [
    ['T041', 'Get Sample COQ From Supplier', 'BUNKER_BOOKED', 0, null, E],
    ['T042', 'Get COQ Approval from Owners / Master', 'BUNKER_BOOKED', 0, null, E],
  ],
  PRE_ARRIVAL_LP: [
    ['T043', 'Appoint Loadport Agent', 'ARRIVAL', -5, null, E],
    ['T044', 'Appoint OPA Agent', 'ARRIVAL', -5, null, E],
    ['T045', 'Ask For Shipper Declaration', 'ARRIVAL', -2, null, E],
    ['T046', 'NOR Instruction to Master', 'ARRIVAL', -2, null, E],
    ['T047', 'Hold Clean Instruction to Master', 'ARRIVAL', -2, null, E],
    ['T048', 'On-Hire Survey Instructions to Agents', 'ARRIVAL', -2, null, E],
    ['T049', 'China AGM Inspection (If required)', 'ARRIVAL', -2, null, E, { isOptional: true }],
    ['T050', 'Ensure Pre-Arrival Documents Recd by Agents', 'ARRIVAL', -2, null, E],
    ['T051', 'Stowage Instruction to Master / Agents', 'ARRIVAL', -2, null, E],
    ['T052', 'Get Bunker Port PDA', 'ARRIVAL', -2, null, E],
    ['T053', 'Check Any delay due to Vsl GA Plan', 'ARRIVAL', -5, null, E],
  ],
  AT_LP: [
    ['T066', 'NOR as per CP check / Send NOR to Charts', 'ARRIVAL', 0, null, E, { linkedField: 'portCall.actual.norTendered', sourceNote: 'Completing the task asks for the NOR tendered time (feature C5)' }],
    ['T067', 'Do Initial Demurrage Calculation', 'ARRIVAL', 0, null, E],
    ['T068', 'Ask Loading photos from agent', 'ARRIVAL', 0, null, E],
    ['T069', 'Ballast Leg Remarks', 'ARRIVAL', 0, null, E],
    ['T070', 'Raise Freight Invoice as per CP', 'SAILING', 1, null, P, { sourceNote: 'Duplicate of T083 – confirm whether both are needed' }],
    ['T071', 'Ask for Draft SOF / MR / BL', 'OPS_COMPLETED', -2, 'HIGH', E],
    ['T072', 'Send MR / BL Draft to Charts for Approval', 'OPS_COMPLETED', -2, 'HIGH', E],
    ['T073', 'Ensure Cargo is Trimmed / Even Keel', 'OPS_COMPLETED', -1, null, E],
    ['T074', 'Instruction on Port Clearance', 'OPS_COMPLETED', -2, null, E],
  ],
  AFTER_SAILING_LP: [
    ['T075', 'Ensure all Sailing Documents received', 'SAILING', 1, null, E],
    ['T076', 'Send Sailing Documents to Charterers', 'SAILING', 1, null, E],
    ['T077', 'Load port Remarks', 'SAILING', 1, null, E],
    ['T078', 'If Clean BL required / Clean LOI to be received', 'SAILING', 1, null, E, { isOptional: true }],
    ['T079', 'Release of Bill of Lading', 'SAILING', 1, null, E],
    ['T080', 'Check and Demurrage / Off-Hire', 'SAILING', 1, null, E],
    ['T081', 'Get Load Port Laytime Approval', 'SAILING', 1, null, E],
    ['T082', 'Do Freight Calculation / Send to Accounts', 'SAILING', 1, null, E],
    ['T083', 'Raise Freight Invoice as per CP', 'SAILING', 1, null, E],
    ['T084', 'Updated Discharge Port PDA + Survey Costs', 'SAILING', 1, null, E],
    ['T085', 'Get OPA Costings at Discharge Port', 'SAILING', 1, null, E],
    ['T086', 'Ask For LP Final DA', 'SAILING', 3, null, E],
  ],
  PRE_ARRIVAL_BP: [
    ['T054', 'Appoint Bunker Port Agent', 'ARRIVAL', -2, null, E],
    ['T055', 'Get Bunker Agency Agreement and PDA Invoice', 'ARRIVAL', -2, null, E],
    ['T056', 'Send Appointed Agent Details to Bunker Supplier', 'ARRIVAL', -2, null, E],
    ['T057', 'Inform Master of Bunkering Details', 'ARRIVAL', -2, null, E],
    ['T058', 'Get Physical Supplier details / Send to Agent', 'ARRIVAL', -2, null, E],
    ['T059', 'Send Final Bunkering Qty to Supplier', 'ARRIVAL', -2, null, E],
    ['T060', 'Get Barge Details / Barge COQ', 'ARRIVAL', -2, null, E],
    ['T061', 'Send Barge Details / COQ to Owner / Master', 'ARRIVAL', -2, null, E],
    ['T062', 'Send Bunker Quantity / Sample Instruction to Agents', 'ARRIVAL', -2, null, E],
    ['T063', 'Ensure Bunkering is done on Arrival', 'ARRIVAL', -1, null, E],
    ['T064', 'Bunker Sample Handover Instruction Master / Agent', 'ARRIVAL', -1, null, E],
    ['T065', 'Attending Bunker Surveyor detail to Master', 'ARRIVAL', -1, null, E],
  ],
  AT_BP: [
    ['T087', 'Check sample for charts and Owners collected by agent', 'ARRIVAL', 0, null, C, { sourceNote: 'Excel refers to Load Port ETA; proposed Bunkering Port arrival' }],
  ],
  AFTER_SAILING_BP: [
    ['T088', 'Bunker port Remarks', 'BUNKERING_DATE', 1, null, E],
    ['T089', 'Bunker Quantity Survey report', 'BUNKERING_DATE', 1, null, E],
    ['T090', 'Bunker Lab Analysis report', 'BUNKERING_DATE', 2, null, E],
    ['T091', 'Bunker Payment', 'BUNKERING_DATE', 31, null, E],
    ['T092', 'Bunker Supplier No Due Cert', 'BUNKERING_DATE', 30, null, C, { sourceNote: 'Excel refers to an empty cell (G7); proposed bunkering date + 30' }],
  ],
  PRE_ARRIVAL_DP: [
    ['T100', 'Appoint Discharge Port Agents', 'ARRIVAL', -10, null, E],
    ['T101', 'Send Cargo Documents to Discharge Port Agents', 'ARRIVAL', -10, null, E],
    ['T102', 'Confirm OBL Status', 'ARRIVAL', -10, null, E],
    ['T103', 'If OBL not available / To get Release without OBL LOI', 'ARRIVAL', -5, null, P, { isOptional: true }],
    ['T104', 'Release without OBL to be endorsed by receiver', 'ARRIVAL', -3, null, P],
    ['T105', 'Delivery Order Instruction to Agent', 'ARRIVAL', -3, null, P],
    ['T106', 'Off-Hire Survey Instructions to Agents', 'ARRIVAL', -2, null, P, { sourceNote: 'Mirrors T048' }],
    ['T107', 'China AGM Inspection (If required)', 'ARRIVAL', -2, null, P, { isOptional: true, sourceNote: 'Mirrors T049' }],
    ['T108', 'Ensure Pre-Arrival Documents Recd by Agents', 'ARRIVAL', -2, null, P, { sourceNote: 'Mirrors T050' }],
    ['T109', 'NOR Instruction to Master', 'ARRIVAL', -2, null, P, { sourceNote: 'Mirrors T046' }],
    ['T110', 'Check Any delay due to Vsl GA Plan', 'ARRIVAL', -5, null, P, { sourceNote: 'Mirrors T053' }],
  ],
  AT_DP: [
    ['T111', 'NOR as per CP check / Send NOR to Charts', 'ARRIVAL', 0, null, E, { linkedField: 'portCall.actual.norTendered', sourceNote: 'Completing the task asks for the NOR tendered time (feature C5)' }],
    ['T112', 'Do Initial Demurrage Calculation', 'ARRIVAL', 0, null, P],
    ['T113', 'Laden Leg Remarks', 'ARRIVAL', 0, null, P],
    ['T114', 'Ask discharging photos from Agent', 'ARRIVAL', 0, null, P],
    ['T115', 'Ask for Draft SOF', 'OPS_COMPLETED', -2, null, E],
  ],
  AFTER_SAILING_DP: [
    ['T116', 'Ensure all Sailing Documents received', 'SAILING', 1, null, E],
    ['T117', 'Send Sailing Documents to Charterers', 'SAILING', 1, null, E],
    ['T118', 'Check and Demurrage / Off-Hire', 'SAILING', 1, null, P, { sourceNote: 'Mirrors T080' }],
    ['T119', 'Get Discharge Port Laytime Approval', 'SAILING', 1, null, P, { sourceNote: 'Mirrors T081' }],
    ['T120', 'Raise Freight Invoice as per CP', 'SAILING', 1, null, P, { sourceNote: 'Mirrors T083' }],
    ['T121', 'Ensure proper Re-Delivery Notice Recd', 'REDELIVERY', 0, null, P],
    ['T122', 'Discharge port remarks', 'SAILING', 1, null, P, { sourceNote: 'Mirrors T077' }],
  ],
  REDELIVERY_NOTICES: [
    ['T093', 'Send Approximate Re Delivery Notice 15 Days', 'REDELIVERY', -15, 'HIGH', E],
    ['T094', 'Send Approximate Re Delivery Notice 10 Days', 'REDELIVERY', -10, 'HIGH', E],
    ['T095', 'Send Approximate Re Delivery Notice 07 Days', 'REDELIVERY', -7, 'HIGH', E],
    ['T096', 'Send Approximate Re Delivery Notice 05 Days', 'REDELIVERY', -5, 'HIGH', E],
    ['T097', 'Send Definite Re Delivery Notice 03 Days', 'REDELIVERY', -3, 'HIGH', E],
    ['T098', 'Send Definite Re Delivery Notice 02 Days', 'REDELIVERY', -2, 'HIGH', E],
    ['T099', 'Send Definite Re Delivery Notice 01 Days', 'REDELIVERY', -1, 'HIGH', E],
  ],
  ON_REDELIVERY: [
    ['T123', 'Voyage Estimated vs Actual Report', 'REDELIVERY', 7, null, P],
    ['T124', 'Master Thankyou Email', 'REDELIVERY', 1, null, P],
    ['T125', 'Final SOA to Owners', 'REDELIVERY', 15, null, P],
    ['T126', 'Voyage Estimation and Actuals Comparison', 'REDELIVERY', 7, null, P, { sourceNote: 'Appears to duplicate T123 – confirm' }],
  ],
  VOYAGE_RECURRING: [
    ['T127', 'Next Hire Payment', 'DELIVERY', 15, null, P, { recurrence: { everyDays: 15, until: 'REDELIVERY' }, sourceNote: 'Recurring every 15 days from delivery – confirm hire cycle' }],
  ],
};

// ------------------------------------------------------------------ daily checks (feature list Appendix C)
// "Update … in Excel" items become the field update itself (feature D9) – linkedField ticks them automatically.
// [name, linkedField, source, note]
const X = (name, linkedField = null, sourceTag = 'EXCEL', sourceNote) => ({ name, linkedField, sourceTag, sourceNote });
const UPDATE_EXPENSES = X('Update Expenses', null, 'EXCEL', 'Was "Updated Expenses in Excel"; expenses are not tracked in Auxin (out of Phase 2 scope)');
const DAILY_CHECKS = {
  AWAITING_DELIVERY: [
    X('Check Vessel Itinerary'), X('Send Loadport ETA Notice'), X('Check Cargo Readiness'),
    X('Update Delivery', 'delivery.estimated', 'EXCEL', 'Was "Update Delivery in Excel"'), UPDATE_EXPENSES, X('Check Weather Updates'),
  ],
  AWAITING_APS_DELIVERY: [
    X('Check Vessel Itinerary'), X('Send Loadport ETA Notice'), X('Check Cargo Readiness'),
    X('Update Delivery', 'delivery.estimated', 'EXCEL', 'Was "Update Delivery in Excel"'), UPDATE_EXPENSES, X('Check Weather Updates'),
    X('Check Berthing Prospects'), X('Check No of Gangs Loading'),
  ],
  DELIVERY_TO_LOAD_PORT: [
    X('Check Vessel Position'), X('Check Sea/Port Weather Updates'), X('Check Berthing Prospects'), X('Send Loadport ETA Notice'),
    X('Check & Update Noon Reports'), X('Check No of Gangs Loading'), X('Check Cargo Readiness'), X('Send Noon Position in WA Group'),
    X('Update ETA Loadport', 'portCall.LOADING.planned.eta', 'EXCEL', 'Was "Update ETA Loadport in Excel"'), UPDATE_EXPENSES,
  ],
  ENROUTE_LOAD_PORT: [
    X('Check Vessel Position'), X('Check Sea/Port Weather Updates'), X('Check Berthing Prospects'), X('Send Loadport ETA Notice'),
    X('Check & Update Noon Reports'), X('Check No of Gangs Loading'), X('Check Cargo Readiness'), X('Send Noon Position in WA Group'),
    X('Update ETA Loadport', 'portCall.LOADING.planned.eta', 'EXCEL', 'Was "Update ETA Loadport in Excel"'), UPDATE_EXPENSES,
  ],
  WAITING_FOR_BERTH: [
    X('Check Weather Updates'), X('Check Berthing Prospects'), X('Check & Update Noon Reports'), X('Check Cargo Readiness'), UPDATE_EXPENSES,
  ],
  AT_LOAD_PORT: [
    X('Check Weather Updates'), X('Send Cargo Loading Report in WA Group'), X('Send Cargo Loading Summary to Charts'),
    X('Check & Update Noon Reports'), X('Update ETC Loadport', 'portCall.LOADING.planned.etc', 'EXCEL', 'Was "Update ETC Loadport in Excel"'), UPDATE_EXPENSES,
  ],
  ENROUTE_BUNKERING_PORT: [
    X('Check Vessel Position'), X('Check Sea Weather Updates'), X('Send Discharge port ETA Notice'), X('Send Bunkering port ETA Notice'),
    X('Check & Update Noon Reports'), X('Send Noon Position in WA Group'),
    X('Update ETA Bunkering', 'portCall.BUNKERING.planned.eta', 'EXCEL', 'Was "Update ETA Bunkering in Excel"'),
    X('Update ETA Discharge Port', 'portCall.DISCHARGING.planned.eta', 'EXCEL', 'Was "Update ETA Discharge Port in Excel"'), UPDATE_EXPENSES,
  ],
  AT_BUNKERING_PORT: [
    X('Check Weather Updates'), X('Check & Update Noon Reports', null, 'CORRECTED', 'Listed twice in the sheet; kept once'),
    X('Update ETA Discharge Port', 'portCall.DISCHARGING.planned.eta', 'EXCEL', 'Was "Update ETA Discharge Port in Excel"'),
    X('Send Noon Position in WA Group'), UPDATE_EXPENSES,
    X('Update Bunkering Date', 'bunker.bunkeringDate', 'EXCEL', 'Was "Update Bunkering Date in Excel"'),
  ],
  ENROUTE_DISCHARGE_PORT: [
    X('Check Vessel Position'), X('Check Weather Updates'), X('Check & Update Noon Reports'), X('Send Noon Position in WA Group'),
    X('Estimated Bunker on Redelivery in WA Group'),
    X('Update ETA Discharge Port', 'portCall.DISCHARGING.planned.eta', 'EXCEL', 'Was "Update ETA Discharge Port in Excel"'),
    X('Check Berthing Prospects'), UPDATE_EXPENSES,
  ],
  AT_DISCHARGE_PORT: [
    X('Check Weather Updates'), X('Send Cargo Discharging Report in WA Group'), X('Send Cargo Discharge Summary'),
    X('Check & Update Noon Reports'), X('Check No of Gangs Discharging'), X('Estimated Bunker on Redelivery in WA Group'),
    X('Update ETC Discharge Port', 'portCall.DISCHARGING.planned.etc', 'CORRECTED', 'Sheet says "Update ETC Loadport in Excel" at the discharge port; corrected to discharge port ETC'),
    UPDATE_EXPENSES,
  ],
};

// ------------------------------------------------------------------ sample ports and vessel (scope section 10)
const PORTS = [
  { name: 'Djibouti', country: 'Djibouti', unlocode: 'DJJIB', timeZone: 'Africa/Djibouti', notes: 'Sample voyage: delivery port' },
  { name: 'Salalah', country: 'Oman', unlocode: 'OMSLL', timeZone: 'Asia/Muscat', notes: 'Sample voyage: load port' },
  { name: 'Kochi', country: 'India', unlocode: 'INCOK', timeZone: 'Asia/Kolkata', notes: 'Sample voyage: bunkering port' },
  { name: 'Kakinada', country: 'India', unlocode: 'INKAK', timeZone: 'Asia/Kolkata', notes: 'Sample voyage: discharge port' },
];
const VESSELS = [
  { name: 'MV Auxin Sample', type: 'Supramax', dwt: 58000, flag: 'Panama', yearBuilt: 2012, notes: 'Sample vessel for UAT – not a real ship' },
];

// ------------------------------------------------------------------ runner
async function upsert(Model, filter, data, label, stats) {
  const existing = await Model.findOne(filter);
  if (!existing) {
    await Model.create({ ...filter, ...data });
    stats.created++;
  } else if (RESET) {
    Object.assign(existing, data);
    await existing.save();
    stats.reset++;
  } else {
    stats.kept++;
  }
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Seeding Vessel Operations masters${RESET ? ' (--reset: seeded records restored)' : ''}…`);

  const s1 = { created: 0, reset: 0, kept: 0 };
  for (const [i, [code, name, scope, portType]] of STAGES.entries()) {
    await upsert(OpsStage, { code }, { name, order: i + 1, scope, portType, isActive: true }, 'stage', s1);
  }
  const stageIds = new Map((await OpsStage.find().lean()).map((s) => [s.code, s._id]));

  const s2 = { created: 0, reset: 0, kept: 0 };
  let total = 0;
  for (const [stageCode, rows] of Object.entries(TEMPLATES)) {
    for (const [i, row] of rows.entries()) {
      const [code, name, event, offsetDays, priority, sourceTag, extra = {}] = row;
      const p = priority || 'MEDIUM';
      await upsert(TaskTemplate, { code }, {
        name,
        stage: stageIds.get(stageCode),
        anchor: { event, basis: 'BEST' },
        offsetDays,
        recurrence: extra.recurrence || { everyDays: null, until: null },
        defaultPriority: p,
        priorityDefaulted: !priority,
        reminderProfile: p,
        defaultRole: null,
        isOptional: Boolean(extra.isOptional),
        linkedField: extra.linkedField || null,
        autoCompleteOnField: false,
        voyageTypes: [],
        sourceTag,
        sourceNote: extra.sourceNote,
        sortOrder: (i + 1) * 10,
        isActive: true,
      }, 'template', s2);
      total++;
    }
  }

  const s3 = { created: 0, reset: 0, kept: 0 };
  for (const [vesselStatus, items] of Object.entries(DAILY_CHECKS)) {
    await upsert(DailyCheckTemplate, { vesselStatus }, {
      items: items.map((it, i) => ({ code: `${vesselStatus}_${i + 1}`, order: i + 1, isActive: true, ...it })),
    }, 'daily checks', s3);
  }

  const s4 = { created: 0, reset: 0, kept: 0 };
  for (const port of PORTS) await upsert(Port, { unlocode: port.unlocode }, port, 'port', s4);
  const s5 = { created: 0, reset: 0, kept: 0 };
  for (const vessel of VESSELS) await upsert(Vessel, { name: vessel.name }, vessel, 'vessel', s5);

  const fmt = (s) => `${s.created} created, ${s.reset} restored, ${s.kept} kept`;
  console.log(`  Stages:           ${fmt(s1)}  (${STAGES.length} in seed)`);
  console.log(`  Task templates:   ${fmt(s2)}  (${total} in seed)`);
  console.log(`  Daily check sets: ${fmt(s3)}  (${Object.keys(DAILY_CHECKS).length} vessel statuses)`);
  console.log(`  Ports:            ${fmt(s4)}`);
  console.log(`  Vessels:          ${fmt(s5)}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
