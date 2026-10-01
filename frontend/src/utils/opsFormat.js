// Formatting helpers for Vessel Operations screens.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 'YYYY-MM-DD' -> '05-Jul-2026' (no time-zone conversion: the value is a calendar date)
export function formatLocalDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${String(d).padStart(2, "0")}-${MONTHS[m - 1]}-${y}`;
}

// Add whole days to a 'YYYY-MM-DD' calendar date (UTC arithmetic, so no DST/zone drift)
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(days || 0)));
  return dt.toISOString().slice(0, 10);
}

// Short names for due-date anchor events, used in rule text such as "Arrival − 5 days"
export const ANCHOR_SHORT = {
  CARGO_FIXED: "Cargo Fixed",
  VESSEL_FIXED: "Vessel Fixed",
  DELIVERY: "Delivery",
  REDELIVERY: "Re-delivery",
  BUNKER_BOOKED: "Bunker booked",
  BUNKERING_DATE: "Bunkering date",
  ARRIVAL: "Arrival",
  BERTHING: "Berthing",
  OPS_COMPLETED: "Completion (ETC)",
  SAILING: "Sailing",
};

export const PORT_TYPE_LABEL = { LOADING: "Load port", DISCHARGING: "Discharge port", BUNKERING: "Bunkering port" };

// "Arrival − 5 days", "On Delivery", "Cargo Fixed + 1 day", "Delivery + 15 days, then every 15 days until Re-delivery"
export function ruleText(anchorEvent, offsetDays, recurrence) {
  const name = ANCHOR_SHORT[anchorEvent] || anchorEvent || "?";
  const n = Number(offsetDays || 0);
  let text;
  if (n === 0) text = `On ${name}`;
  else text = `${name} ${n > 0 ? "+" : "−"} ${Math.abs(n)} day${Math.abs(n) === 1 ? "" : "s"}`;
  if (recurrence && recurrence.everyDays) {
    text += `, then every ${recurrence.everyDays} days`;
    if (recurrence.until) text += ` until ${ANCHOR_SHORT[recurrence.until] || recurrence.until}`;
  }
  return text;
}

// Current local time and UTC offset in an IANA zone, e.g. { time: "14:05", offset: "UTC+04:00" }
export function zoneNow(timeZone) {
  try {
    const now = new Date();
    const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(now);
    const raw = parts.find((p) => p.type === "timeZoneName")?.value || "GMT";
    const offset = raw === "GMT" ? "UTC+00:00" : raw.replace("GMT", "UTC");
    return { time, offset };
  } catch (e) {
    return { time: "", offset: "" };
  }
}

// All IANA zone names the browser knows (falls back to a short list on very old browsers)
export function allTimeZones() {
  try {
    if (typeof Intl.supportedValuesOf === "function") return Intl.supportedValuesOf("timeZone");
  } catch (e) {
    /* ignore */
  }
  return ["UTC", "Asia/Kolkata", "Asia/Dubai", "Asia/Muscat", "Asia/Singapore", "Africa/Djibouti", "Europe/London"];
}
