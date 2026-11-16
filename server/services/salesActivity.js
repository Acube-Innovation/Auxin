// Records changes made in Sales & Leads for the daily summary to the sales HOD (jobs/salesSummary.js).
// record() never throws and never delays the response: a failed log line must not fail the user's save.
const SalesActivity = require('../models/SalesActivity');

// Client / lead fields shown in the summary when they change (others are counted as "other fields")
const CLIENT_FIELDS = {
  companyName: 'Company', leadType: 'Lead / Client', clientType: 'Client type', category: 'Category',
  primaryContactName: 'Contact', designation: 'Designation', email: 'Email', phone: 'Phone', mobile: 'Mobile',
  country: 'Country', address: 'Address', website: 'Website', industryType: 'Industry', cargoType: 'Cargo type',
  relationshipStatus: 'Relationship', accountManager: 'Account manager', assignedTo: 'Assigned to',
  followupStatus: 'Follow-up status', followUpDate: 'Follow-up date', opportunityValue: 'Opportunity value',
  leadSource: 'Lead source', contractType: 'Contract type', tradingRoutes: 'Trading routes', notes: 'Notes',
  projectName: 'Project', typicalCargoes: 'Typical cargoes', incoterms: 'Incoterms',
};
const SKIP = new Set(['_id', '__v', 'events', 'createdAt', 'updatedAt', 'createdBy', 'profilePicture', 'currentStatus']);
const TASK_STATUS = { backlog: 'Backlog', todo: 'To do', inprogress: 'In progress', done: 'Done' };

const text = (v) => {
  if (v == null || v === '') return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.map(text).join(', ');
  return String(v).trim();
};
const short = (s, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Field-by-field differences between two plain objects. Returns { changes, stageChange }.
function clientDiff(before, after) {
  const changes = [];
  let other = 0;
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    if (SKIP.has(k)) continue;
    const a = text(before && before[k]);
    const b = text(after && after[k]);
    if (a === b) continue;
    if (k === 'assignedTo') changes.push({ field: 'Assigned to (changed)', from: '', to: '' });
    else if (CLIENT_FIELDS[k]) changes.push({ field: CLIENT_FIELDS[k], from: short(a), to: short(b) });
    else other++;
  }
  if (other) changes.push({ field: `${other} other field${other === 1 ? '' : 's'}`, from: '', to: '' });
  const s1 = text(before && before.currentStatus);
  const s2 = text(after && after.currentStatus);
  return { changes, stageChange: s1 !== s2 ? { from: s1, to: s2 } : undefined };
}

function taskDiff(before, after) {
  const changes = [];
  const add = (field, a, b, map) => {
    const x = map ? map[a] || text(a) : text(a);
    const y = map ? map[b] || text(b) : text(b);
    if (x !== y) changes.push({ field, from: short(x), to: short(y) });
  };
  add('Title', before.title, after.title);
  add('Status', before.status, after.status, TASK_STATUS);
  add('Priority', before.priority, after.priority);
  add('Date', before.date, after.date);
  add('Notes', before.notes, after.notes);
  if (text((before.assignedEmployees || []).map(String).sort()) !== text((after.assignedEmployees || []).map(String).sort())) {
    changes.push({ field: 'Assigned people', from: '', to: '' });
  }
  return changes;
}

const plain = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc || {});

function meetingDiff(before, after) {
  const changes = [];
  for (const [field, k] of [['Title', 'title'], ['Date', 'date'], ['Time', 'time'], ['Notes', 'notes'], ['Link', 'link']]) {
    const x = text(before[k]);
    const y = text(after[k]);
    if (x !== y) changes.push({ field, from: short(x), to: short(y) });
  }
  if (text((before.assignedTeamMembers || []).map(String).sort()) !== text((after.assignedTeamMembers || []).map(String).sort())) {
    changes.push({ field: 'Team members', from: '', to: '' });
  }
  return changes;
}

// entry: { entity, action, client? | clientId?, title?, changes?, stageChange? }
function record(user, entry) {
  if (!user || !user._id) return;
  if (!entry.client && entry.clientId) {
    const Client = require('../models/Client');
    Client.findById(entry.clientId).select('companyName leadType').lean()
      .then((c) => record(user, { ...entry, clientId: undefined, client: c || undefined }))
      .catch(() => record(user, { ...entry, clientId: undefined }));
    return;
  }
  const client = entry.client ? plain(entry.client) : null;
  const row = {
    actor: user._id,
    actorName: user.username || '',
    entity: entry.entity,
    action: entry.action,
    clientId: client ? client._id : null,
    clientName: client ? client.companyName || '' : '',
    leadType: client ? client.leadType || '' : '',
    title: short(text(entry.title), 120),
    changes: entry.changes || [],
    stageChange: entry.stageChange,
  };
  SalesActivity.create(row).catch((err) => console.error('[sales-activity] could not record:', err.message));
}

module.exports = { record, clientDiff, taskDiff, meetingDiff, plain, TASK_STATUS };
