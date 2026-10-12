/**
 * Office holidays 2026 (OFFICE HOLIDAYS IN 2026 — same list as company PDF).
 * Used for Holidays tab table and date-picker disabled dates.
 */
export const OFFICE_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-02-19', name: 'Chhatrapati Shivaji Maharaj Jayanti' },
  { date: '2026-03-03', name: 'Holi' },
  { date: '2026-03-19', name: 'Gudi Padwa' },
  { date: '2026-03-21', name: 'Ramzan Id' },
  { date: '2026-03-26', name: 'Ram Navmi' },
  { date: '2026-03-31', name: 'Mahavir Jayanti' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-14', name: 'Dr. Babasaheb Ambedkar Jayanti' },
  { date: '2026-05-01', name: 'Maharashtra Day' },
  { date: '2026-06-26', name: 'Muharram / Bakri-Eid' },
  { date: '2026-08-15', name: 'Independence Day / Parsi New Year' },
  { date: '2026-08-26', name: 'Eid-e-Milad' },
  { date: '2026-08-28', name: 'Raksha Bandhan' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi' },
  { date: '2026-10-02', name: 'Mahatma Gandhi Jayanti' },
  { date: '2026-10-20', name: 'Dasara' },
  { date: '2026-11-06', name: 'Diwali — Laxmi Pujan' },
  { date: '2026-11-10', name: 'Diwali — Padva' },
  { date: '2026-11-11', name: 'Diwali — Bhaubij' },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti' },
  { date: '2026-12-25', name: 'Christmas' },
];

/** YYYY-MM-DD strings for date picker and leave calculations */
export const OFFICIAL_HOLIDAYS_2026 = OFFICE_HOLIDAYS_2026.map((h) => h.date);
