// Time helpers for Vessel Operations. Instants are stored as UTC Dates; they are entered and shown
// in the local time of the port (or the office) they belong to.
const { DateTime } = require('luxon');

// Parse an API value into a Date. Accepts null/'' (clears), ISO 8601 strings or epoch ms.
// Throws { status: 400 } with a readable message for anything else.
function parseInstant(value, label) {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    const err = new Error(`${label} is not a valid date/time`);
    err.status = 400;
    throw err;
  }
  return d;
}

// Local wall-clock time in an IANA zone -> UTC Date. localToUtc('2026-07-05T11:30', 'Asia/Muscat')
function localToUtc(localIso, zone) {
  const dt = DateTime.fromISO(localIso, { zone });
  if (!dt.isValid) throw new Error(`Invalid local time ${localIso} (${zone}): ${dt.invalidReason}`);
  return dt.toUTC().toJSDate();
}

// UTC Date -> "05-Jul-2026 11:30" in the given zone
function formatLocal(date, zone) {
  if (!date) return '';
  return DateTime.fromJSDate(date, { zone }).toFormat('dd-LLL-yyyy HH:mm');
}

module.exports = { parseInstant, localToUtc, formatLocal };
