// Vessel status from the actual times entered (feature C6, Development Scope 5.5).
// Rules, first match wins:
//   1. re-delivery actual entered                                  → REDELIVERED
//   2. a port call with ATA/ATB but no ATD (latest such call)       → WAITING_FOR_BERTH (load/discharge, ATA but no ATB)
//                                                                     else AT_LOAD_PORT / AT_BUNKERING_PORT / AT_DISCHARGE_PORT
//   3. under way (delivered, or a port already reached) and a later port call not yet reached
//                                                                   → ENROUTE_LOAD_PORT / _BUNKERING_PORT / _DISCHARGE_PORT
//   4. under way and every port call sailed                         → stays at the last port's status until re-delivery
//      (assumption: re-delivery normally follows the last discharge port, e.g. DLOSP — to confirm with the client)
//   5. otherwise                                                     → AWAITING_DELIVERY
// A manual override (e.g. "Waiting for Berth", "Awaiting APS Delivery") wins until the next actual is entered.
const AT = { LOADING: 'AT_LOAD_PORT', BUNKERING: 'AT_BUNKERING_PORT', DISCHARGING: 'AT_DISCHARGE_PORT' };
const ENROUTE = { LOADING: 'ENROUTE_LOAD_PORT', BUNKERING: 'ENROUTE_BUNKERING_PORT', DISCHARGING: 'ENROUTE_DISCHARGE_PORT' };

function deriveVesselStatus(voyage, portCalls) {
  if (voyage.redelivery && voyage.redelivery.actual) return 'REDELIVERED';
  const calls = (portCalls || []).filter((pc) => pc.status !== 'CANCELLED').sort((a, b) => a.seq - b.seq);
  const arrived = (pc) => pc.actual && (pc.actual.ata || pc.actual.atb);
  const sailed = (pc) => pc.actual && pc.actual.atd;

  const inPort = calls.filter((pc) => arrived(pc) && !sailed(pc)).pop();
  if (inPort) {
    if (inPort.type !== 'BUNKERING' && inPort.actual.ata && !inPort.actual.atb) return 'WAITING_FOR_BERTH';
    return AT[inPort.type];
  }
  // Under way once delivered, or once any port has been reached (actual delivery may be entered later)
  const underWay = (voyage.delivery && voyage.delivery.actual) || calls.some(arrived);
  if (underWay) {
    const next = calls.find((pc) => !arrived(pc));
    if (next) return ENROUTE[next.type];
    const last = calls[calls.length - 1];
    return last ? AT[last.type] : 'AWAITING_DELIVERY';
  }
  // Not delivered yet but a port has already been reached (e.g. delivery at the load port) is handled above
  return 'AWAITING_DELIVERY';
}

// Status to show: the override while set, else the derived one
function effectiveVesselStatus(voyage, portCalls) {
  const override = voyage.vesselStatusOverride && voyage.vesselStatusOverride.value;
  return override || deriveVesselStatus(voyage, portCalls);
}

module.exports = { deriveVesselStatus, effectiveVesselStatus };
