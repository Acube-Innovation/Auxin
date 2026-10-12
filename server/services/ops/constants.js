// Shared enums for the Vessel Operations module (Phase 2 Development Scope, sections 4–5).

const PORT_TYPES = ['LOADING', 'DISCHARGING', 'BUNKERING'];
const STAGE_SCOPES = ['VOYAGE', 'PORT_CALL'];
const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
const REMINDER_PROFILES = ['HIGH', 'MEDIUM', 'LOW', 'NONE'];
const VOYAGE_TYPES = ['TC_TRIP', 'VOYAGE_CHARTER'];
const SOURCE_TAGS = ['EXCEL', 'PROPOSED', 'CORRECTED', 'USER'];
const ANCHOR_BASES = ['BEST', 'ESTIMATE', 'ACTUAL'];

// Key dates that drive due dates (scope 5.1)
const ANCHOR_EVENTS = [
  { value: 'CARGO_FIXED', label: 'Cargo Fixed date', scope: 'VOYAGE' },
  { value: 'VESSEL_FIXED', label: 'Vessel Fixed date', scope: 'VOYAGE' },
  { value: 'DELIVERY', label: 'Delivery', scope: 'VOYAGE' },
  { value: 'REDELIVERY', label: 'Re-delivery', scope: 'VOYAGE' },
  { value: 'BUNKER_BOOKED', label: 'Bunker booked date', scope: 'VOYAGE' },
  { value: 'BUNKERING_DATE', label: 'Bunkering date', scope: 'VOYAGE' },
  { value: 'ARRIVAL', label: 'Port arrival (ATA / ETA)', scope: 'PORT_CALL' },
  { value: 'BERTHING', label: 'Berthing (ATB / ETB)', scope: 'PORT_CALL' },
  { value: 'OPS_COMPLETED', label: 'Operations completed (ETC)', scope: 'PORT_CALL' },
  { value: 'SAILING', label: 'Sailing (ATD / ETS)', scope: 'PORT_CALL' },
];
const ANCHOR_EVENT_VALUES = ANCHOR_EVENTS.map((e) => e.value);

// Vessel statuses (scope 5.5, feature list Appendix C)
const VESSEL_STATUSES = [
  { value: 'AWAITING_DELIVERY', label: 'Awaiting Delivery' },
  { value: 'AWAITING_APS_DELIVERY', label: 'Awaiting APS Delivery' },
  { value: 'DELIVERY_TO_LOAD_PORT', label: 'Delivery to Load Port' },
  { value: 'ENROUTE_LOAD_PORT', label: 'Enroute Load Port' },
  { value: 'WAITING_FOR_BERTH', label: 'Waiting for Berth' },
  { value: 'AT_LOAD_PORT', label: 'At Load Port' },
  { value: 'ENROUTE_BUNKERING_PORT', label: 'Enroute Bunkering Port' },
  { value: 'AT_BUNKERING_PORT', label: 'At Bunkering Port' },
  { value: 'ENROUTE_DISCHARGE_PORT', label: 'Enroute Discharge Port' },
  { value: 'AT_DISCHARGE_PORT', label: 'At Discharge Port' },
  { value: 'REDELIVERED', label: 'Re-delivered' },
];
const VESSEL_STATUS_VALUES = VESSEL_STATUSES.map((s) => s.value);

// Voyage / port-call fields a task or daily check can be linked to (features C5, D9).
// "portCall.*" paths refer to the port call the task belongs to; for voyage-level daily
// checks the port type in the path picks the next port call of that type.
const LINKED_FIELDS = [
  { value: 'fixture.cargoFixedAt', label: 'Cargo Fixed date' },
  { value: 'fixture.vesselFixedAt', label: 'Vessel Fixed date' },
  { value: 'delivery.estimated', label: 'Delivery – estimated' },
  { value: 'delivery.actual', label: 'Delivery – actual' },
  { value: 'redelivery.estimated', label: 'Re-delivery – estimated' },
  { value: 'redelivery.actual', label: 'Re-delivery – actual' },
  { value: 'bunker.bookedOn', label: 'Bunker booked on' },
  { value: 'bunker.bunkeringDate', label: 'Bunkering date' },
  { value: 'portCall.planned.eta', label: 'Port call – ETA' },
  { value: 'portCall.planned.etb', label: 'Port call – ETB' },
  { value: 'portCall.planned.etc', label: 'Port call – ETC' },
  { value: 'portCall.planned.ets', label: 'Port call – ETS' },
  { value: 'portCall.actual.ata', label: 'Port call – ATA' },
  { value: 'portCall.actual.norTendered', label: 'Port call – NOR tendered' },
  { value: 'portCall.actual.pob', label: 'Port call – Pilot on board' },
  { value: 'portCall.actual.atb', label: 'Port call – ATB' },
  { value: 'portCall.actual.commenced', label: 'Port call – Operations commenced' },
  { value: 'portCall.actual.completed', label: 'Port call – Operations completed' },
  { value: 'portCall.actual.atd', label: 'Port call – ATD' },
  { value: 'portCall.LOADING.planned.eta', label: 'Load port (current or next) – ETA' },
  { value: 'portCall.LOADING.planned.etc', label: 'Load port (current or next) – ETC' },
  { value: 'portCall.BUNKERING.planned.eta', label: 'Bunkering port (current or next) – ETA' },
  { value: 'portCall.DISCHARGING.planned.eta', label: 'Discharge port (current or next) – ETA' },
  { value: 'portCall.DISCHARGING.planned.etc', label: 'Discharge port (current or next) – ETC' },
];
const LINKED_FIELD_VALUES = LINKED_FIELDS.map((f) => f.value);

module.exports = {
  PORT_TYPES,
  STAGE_SCOPES,
  PRIORITIES,
  REMINDER_PROFILES,
  VOYAGE_TYPES,
  SOURCE_TAGS,
  ANCHOR_BASES,
  ANCHOR_EVENTS,
  ANCHOR_EVENT_VALUES,
  VESSEL_STATUSES,
  VESSEL_STATUS_VALUES,
  LINKED_FIELDS,
  LINKED_FIELD_VALUES,
};
