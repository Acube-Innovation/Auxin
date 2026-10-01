// ETB / ETC / ETS suggestions for a port call (feature B7, Development Scope 5.7).
//   ETB = ETA + waiting time (4.8 h at load/discharge ports, 12 h at bunkering ports)
//   ETC = ETB + cargo quantity ÷ daily rate (4 days when either is missing); bunkering calls ETB + 1 day
//   ETS = ETC + sailing buffer (0 h)
// A value the user typed (manual.<field> = true) is never overwritten; later suggestions build on it.
const config = require('./config');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const plus = (date, ms) => (date ? new Date(new Date(date).getTime() + ms) : null);

function operationDays(pc) {
  if (pc.type === 'BUNKERING') return config.DEFAULT_BUNKER_DAYS;
  if (pc.cargoQty > 0 && pc.ratePerDay > 0) return pc.cargoQty / pc.ratePerDay;
  return config.DEFAULT_OPS_DAYS;
}

// Returns the suggested planned times for a port call (does not modify it)
function suggest(pc) {
  const planned = pc.planned || {};
  const manual = pc.manual || {};
  const wait = (pc.type === 'BUNKERING' ? config.WAIT_HOURS_BUNKER : config.WAIT_HOURS_CARGO) * HOUR;
  const etb = manual.etb ? planned.etb || null : plus(planned.eta, wait);
  const etc = manual.etc ? planned.etc || null : plus(etb, operationDays(pc) * DAY);
  const ets = manual.ets ? planned.ets || null : plus(etc, config.SAIL_BUFFER_HOURS * HOUR);
  return { eta: planned.eta || null, etb, etc, ets };
}

// Apply suggestions to a port-call document / plain object in place. Returns true if anything changed.
function applySuggestions(pc) {
  const next = suggest(pc);
  let changed = false;
  pc.planned = pc.planned || {};
  for (const k of ['etb', 'etc', 'ets']) {
    const before = pc.planned[k] ? new Date(pc.planned[k]).getTime() : null;
    const after = next[k] ? next[k].getTime() : null;
    if (before !== after) {
      pc.planned[k] = next[k];
      changed = true;
    }
  }
  return changed;
}

// Which fields of a request count as typed by the user: a value given for etb/etc/ets marks it manual,
// clearing it (null / '') hands it back to the suggestions.
function manualFlagsFromInput(input, current) {
  const flags = { ...(current || { etb: false, etc: false, ets: false }) };
  const planned = (input && input.planned) || {};
  for (const k of ['etb', 'etc', 'ets']) {
    if (Object.prototype.hasOwnProperty.call(planned, k)) flags[k] = planned[k] !== null && planned[k] !== '';
  }
  if (input && input.manual) for (const k of ['etb', 'etc', 'ets']) if (k in input.manual) flags[k] = Boolean(input.manual[k]);
  return flags;
}

module.exports = { suggest, applySuggestions, manualFlagsFromInput, operationDays };
