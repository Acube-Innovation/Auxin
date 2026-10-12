// Browser copy of the server's ETB / ETC / ETS suggestion rules (server/services/ops/suggestions.js),
// so the form can show suggestions while typing. The server recalculates them on save.
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const plus = (iso, ms) => (iso ? new Date(new Date(iso).getTime() + ms).toISOString() : null);

export const DEFAULT_SETTINGS = { waitHoursCargo: 4.8, waitHoursBunker: 12, defaultOpsDays: 4, defaultBunkerDays: 1, sailBufferHours: 0 };

function operationDays(row, s) {
  if (row.type === "BUNKERING") return s.defaultBunkerDays;
  const qty = Number(row.cargoQty);
  const rate = Number(row.ratePerDay);
  if (qty > 0 && rate > 0) return qty / rate;
  return s.defaultOpsDays;
}

// row: { type, cargoQty, ratePerDay, planned: { eta, etb, etc, ets }, manual: { etb, etc, ets } } with ISO strings
export function suggestTimes(row, settings = DEFAULT_SETTINGS) {
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const p = row.planned || {};
  const m = row.manual || {};
  const wait = (row.type === "BUNKERING" ? s.waitHoursBunker : s.waitHoursCargo) * HOUR;
  const etb = m.etb ? p.etb || null : plus(p.eta, wait);
  const etc = m.etc ? p.etc || null : plus(etb, operationDays(row, s) * DAY);
  const ets = m.ets ? p.ets || null : plus(etc, s.sailBufferHours * HOUR);
  return { eta: p.eta || null, etb, etc, ets };
}
