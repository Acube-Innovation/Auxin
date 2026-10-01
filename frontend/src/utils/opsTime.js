import { DateTime } from "luxon";

// Conversions between UTC instants (stored) and wall-clock values in a port's / the office's time zone (entered).

// UTC ISO -> "2026-07-05T11:30" for <input type="datetime-local"> in `zone`
export function toLocalInput(iso, zone) {
  if (!iso) return "";
  const dt = DateTime.fromISO(iso, { zone: "utc" }).setZone(zone || "UTC");
  return dt.isValid ? dt.toFormat("yyyy-LL-dd'T'HH:mm") : "";
}

// "2026-07-05T11:30" in `zone` -> UTC ISO (or null when empty / invalid)
export function fromLocalInput(local, zone) {
  if (!local) return null;
  const dt = DateTime.fromISO(local, { zone: zone || "UTC" });
  return dt.isValid ? dt.toUTC().toISO() : null;
}

// UTC ISO -> "2026-07-05" (calendar date in `zone`) for <input type="date">
export function toDateInput(iso, zone) {
  if (!iso) return "";
  const dt = DateTime.fromISO(iso, { zone: "utc" }).setZone(zone || "UTC");
  return dt.isValid ? dt.toISODate() : "";
}

// "2026-07-05" -> UTC ISO of midnight in `zone`
export function fromDateInput(date, zone) {
  if (!date) return null;
  const dt = DateTime.fromISO(date, { zone: zone || "UTC" }).startOf("day");
  return dt.isValid ? dt.toUTC().toISO() : null;
}

// "07:30 UTC" or "04-Jul 22:00 UTC" when the UTC date differs from the local one
export function utcHint(iso, zone) {
  if (!iso) return "";
  const utc = DateTime.fromISO(iso, { zone: "utc" });
  const local = utc.setZone(zone || "UTC");
  if (!utc.isValid) return "";
  return utc.toISODate() === local.toISODate() ? `${utc.toFormat("HH:mm")} UTC` : `${utc.toFormat("dd-LLL HH:mm")} UTC`;
}

// Short zone name with offset, e.g. "Asia/Muscat (UTC+04:00)"
export function zoneLabel(zone) {
  if (!zone) return "";
  const dt = DateTime.now().setZone(zone);
  return dt.isValid ? `${zone} (UTC${dt.toFormat("ZZ")})` : zone;
}
