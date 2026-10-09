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

export const VESSEL_STATUS_LABEL = {
  AWAITING_DELIVERY: "Awaiting Delivery",
  AWAITING_APS_DELIVERY: "Awaiting APS Delivery",
  DELIVERY_TO_LOAD_PORT: "Delivery to Load Port",
  ENROUTE_LOAD_PORT: "Enroute Load Port",
  WAITING_FOR_BERTH: "Waiting for Berth",
  AT_LOAD_PORT: "At Load Port",
  ENROUTE_BUNKERING_PORT: "Enroute Bunkering Port",
  AT_BUNKERING_PORT: "At Bunkering Port",
  ENROUTE_DISCHARGE_PORT: "Enroute Discharge Port",
  AT_DISCHARGE_PORT: "At Discharge Port",
  REDELIVERED: "Re-delivered",
};

// Task time buckets (Development Scope 5.6) with the colour codes of the feature list
export const BUCKETS = [
  { key: "OVERDUE", label: "Overdue", color: "#b42318", bg: "#fee4e2" },
  { key: "TODAY", label: "Due today", color: "#b54708", bg: "#fef0c7" },
  { key: "NEXT_7", label: "Next 7 days", color: "#067647", bg: "#dcfae6" },
  { key: "LATER", label: "Later", color: "#067647", bg: "#ecfdf3" },
  { key: "AWAITING_DATE", label: "Awaiting date", color: "#475467", bg: "#ffffff", border: "#98a2b3" },
  { key: "CLOSED", label: "Done / N/A", color: "#667085", bg: "#f2f4f7" },
];
export const BUCKET_BY_KEY = Object.fromEntries(BUCKETS.map((b) => [b.key, b]));

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

// Parts of an instant in a zone: { date: "05-Jul-2026", time: "11:30" }
function partsIn(iso, timeZone) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: timeZone || "UTC", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.day}-${p.month}-${p.year}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}

// UTC instant -> "05-Jul-2026 11:30 LT (07:30 UTC)" in the port's zone. withUtc=false drops the UTC part.
export function formatInstant(iso, timeZone, { withUtc = true } = {}) {
  if (!iso) return "";
  const local = partsIn(iso, timeZone);
  if (!local) return "";
  if (!withUtc || !timeZone || timeZone === "UTC") return `${local.date} ${local.time}${timeZone === "UTC" ? " UTC" : " LT"}`;
  const utc = partsIn(iso, "UTC");
  const utcText = utc.date === local.date ? utc.time : `${utc.date} ${utc.time}`;
  return `${local.date} ${local.time} LT (${utcText} UTC)`;
}

// UTC instant -> "05-Jul-2026" in a zone
export function formatInstantDate(iso, timeZone) {
  const p = iso ? partsIn(iso, timeZone) : null;
  return p ? p.date : "";
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

// Difference b − a as "+1d 04h" / "−6h" / "0h" (for planned vs actual, C4). Returns null if either is missing.
export function formatDelay(aIso, bIso) {
  if (!aIso || !bIso) return null;
  const mins = Math.round((new Date(bIso) - new Date(aIso)) / 60000);
  if (mins === 0) return { text: "on time", minutes: 0 };
  const abs = Math.abs(mins);
  const d = Math.floor(abs / 1440);
  const h = Math.floor((abs % 1440) / 60);
  const m = abs % 60;
  const parts = d ? `${d}d ${String(h).padStart(2, "0")}h` : h ? `${h}h${m ? ` ${String(m).padStart(2, "0")}m` : ""}` : `${m}m`;
  return { text: `${mins > 0 ? "+" : "−"}${parts}`, minutes: mins };
}

export const DATE_FIELD_LABEL = {
  "planned.eta": "ETA", "planned.etb": "ETB", "planned.etc": "ETC", "planned.ets": "ETS",
  "actual.ata": "ATA", "actual.norTendered": "NOR tendered", "actual.pob": "Pilot on board", "actual.atb": "ATB",
  "actual.commenced": "Operations commenced", "actual.completed": "Operations completed", "actual.atd": "ATD",
  "fixture.cargoFixedAt": "Cargo fixed", "fixture.vesselFixedAt": "Vessel fixed",
  "delivery.estimated": "Delivery (estimated)", "delivery.actual": "Delivery (actual)",
  "redelivery.estimated": "Re-delivery (estimated)", "redelivery.actual": "Re-delivery (actual)",
  "bunker.bookedOn": "Bunker booked on", "bunker.bunkeringDate": "Bunkering date",
};

// ---------------------------------------------------------------- working time (Start / Hold / Stop)
// Planned hours as entered (2, 1.5 → "2 h", "1.5 h")
export function plannedText(hours) {
  if (hours == null || hours === "") return "—";
  return `${Number(hours)} h`;
}

// Worked seconds → "2h 05m"
export function workedText(seconds) {
  const m = Math.floor((seconds || 0) / 60);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

// Seconds worked on a task up to `nowMs`, counting the period running now (time on hold does not count)
export function workedSeconds(task, nowMs = Date.now()) {
  let s = task.workedSeconds || 0;
  if (task.timer?.state === "RUNNING" && task.timer.runningSince) s += Math.max(0, (nowMs - new Date(task.timer.runningSince).getTime()) / 1000);
  return s;
}

export const TIMER_LABEL = { RUNNING: "Running", HELD: "On hold", STOPPED: "Stopped" };
