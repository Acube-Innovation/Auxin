// Shared helpers for the CRM dashboard widgets

// Lead status values used by the Add / Edit client forms, in pipeline order
export const OPEN_STAGES = ["New", "Attempted To Contact", "Contacted", "Contact In Future", "Qualified", "Quoted", "Negotiation"];
export const CLOSED_STAGES = ["Won", "Lost Lead", "Junk Lead"];
export const NO_STAGE = "none"; // URL value for clients without a lead status

const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar day of a stored date as "YYYY-MM-DD". Date-only fields (follow-up date, event date)
// are saved as UTC midnight, so those keep their UTC day; anything else uses the local day.
export function dayKey(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d)) return null;
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) return d.toISOString().slice(0, 10);
  return localKey(d);
}

export function localKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Whole days from today to the given day key (negative = in the past)
export function daysFromToday(key) {
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  const [ty, tm, td] = localKey().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / DAY_MS);
}

export function formatDay(key) {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// "09:30" -> "9:30 AM"
export function formatTime(time) {
  if (!time) return "All day";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  if (isNaN(hour)) return time;
  return `${hour % 12 || 12}:${(m || "00").slice(0, 2)} ${hour >= 12 ? "PM" : "AM"}`;
}

export function formatMoney(n) {
  return `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
}

// Change in records created this month vs last month, as a whole percentage (null = no basis to compare)
export function monthOverMonth(items) {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  let cur = 0;
  let prev = 0;
  items.forEach((c) => {
    if (!c.createdAt) return;
    const d = new Date(c.createdAt);
    if (d >= thisMonth) cur++;
    else if (d >= lastMonth) prev++;
  });
  if (prev === 0) return { cur, prev, pct: null };
  return { cur, prev, pct: Math.round(((cur - prev) / prev) * 100) };
}

export function absoluteLink(link) {
  if (!link) return "";
  return link.startsWith("http") ? link : `https://${link}`;
}

// ₹1.2Cr / ₹4.5L / ₹12.9K style for tiles and axis ticks (Indian units)
export function compactMoney(n) {
  const v = Math.abs(n || 0);
  const sign = n < 0 ? "-" : "";
  if (v >= 1e7) return `${sign}₹${trim(v / 1e7)}Cr`;
  if (v >= 1e5) return `${sign}₹${trim(v / 1e5)}L`;
  if (v >= 1e3) return `${sign}₹${trim(v / 1e3)}K`;
  return `${sign}₹${Math.round(v)}`;
}

export function compactNumber(n) {
  const v = Math.abs(n || 0);
  if (v >= 1e5) return `${trim(n / 1e5)}L`;
  if (v >= 1e3) return `${trim(n / 1e3)}K`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function trim(x) {
  return x >= 100 ? String(Math.round(x)) : x.toFixed(1).replace(/\.0$/, "");
}

// Start of each of the last `count` months, oldest first
export function lastMonths(count = 12) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1), label: start.toLocaleDateString("en-US", { month: "short" }), year: start.getFullYear() };
  });
}

// Per-month totals of `valueOf(record)` (default: count) for records created in that month
export function monthlySeries(records, months, valueOf = () => 1) {
  return months.map(({ start, end }) => records.reduce((sum, r) => {
    if (!r.createdAt) return sum;
    const d = new Date(r.createdAt);
    return d >= start && d < end ? sum + valueOf(r) : sum;
  }, 0));
}

// Rounded axis maximum and tick step for 0..max
export function niceScale(max, ticks = 4) {
  if (max <= 0) return { max: ticks, step: 1 };
  const raw = max / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  return { max: step * ticks, step };
}

export function initials(name) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// Open clients / leads by follow-up date: overdue, today, next 7 days (won / lost / junk left out)
export function followUpBuckets(clients) {
  const g = { Overdue: [], Today: [], "Next 7 days": [] };
  clients.forEach((c) => {
    if (CLOSED_STAGES.includes(c.currentStatus)) return;
    const key = dayKey(c.followUpDate);
    const days = daysFromToday(key);
    if (days === null || days > 7) return;
    const row = { client: c, key, days };
    if (days < 0) g.Overdue.push(row);
    else if (days === 0) g.Today.push(row);
    else g["Next 7 days"].push(row);
  });
  Object.values(g).forEach((rows) => rows.sort((a, b) => a.days - b.days || (a.client.companyName || "").localeCompare(b.client.companyName || "")));
  return g;
}

// Id of a user reference: the list API returns { _id, username } for admin / hod and a plain id otherwise
export function refId(ref) {
  return ref && typeof ref === "object" ? String(ref._id || "") : String(ref || "");
}

// Counts by day / week (Sunday–Saturday) / month / year / employee (creator), newest or largest first
export const BREAKDOWNS = [
  { value: "total", label: "Total" },
  { value: "daily", label: "Daily-wise", header: "Date" },
  { value: "weekly", label: "Weekly-wise", header: "Week" },
  { value: "month", label: "Month-wise", header: "Month" },
  { value: "yearly", label: "Yearly-wise", header: "Year" },
  { value: "employee", label: "Employee-wise", header: "Employee" },
];

export function breakdown(records, type) {
  const map = {};
  const add = (key, label) => {
    map[key] = map[key] || { label, count: 0 };
    map[key].count++;
  };
  records.forEach((c) => {
    if (type === "employee") {
      const name = (c.createdBy && typeof c.createdBy === "object" ? c.createdBy.username : null) || c.createdByUsername || "Unknown";
      add(name, name);
      return;
    }
    if (!c.createdAt) return;
    const d = new Date(c.createdAt);
    const pad = (n) => String(n).padStart(2, "0");
    if (type === "daily") {
      add(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }));
    } else if (type === "weekly") {
      const sun = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
      const sat = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + 6);
      const f = (x) => x.toLocaleDateString("en-US", { day: "numeric", month: "short" });
      add(`${sun.getFullYear()}-${pad(sun.getMonth() + 1)}-${pad(sun.getDate())}`, `${f(sun)} - ${f(sat)}, ${sat.getFullYear()}`);
    } else if (type === "month") {
      add(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`, d.toLocaleDateString("en-US", { month: "short", year: "numeric" }));
    } else if (type === "yearly") {
      add(String(d.getFullYear()), String(d.getFullYear()));
    }
  });
  const rows = Object.entries(map);
  if (type === "employee") rows.sort((a, b) => b[1].count - a[1].count);
  else rows.sort((a, b) => b[0].localeCompare(a[0]));
  return rows.map(([, v]) => v);
}
