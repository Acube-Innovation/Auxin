// ETA-change alert to the other people concerned (F3 beyond the pop-up of the person making the change):
// each assignee of a task whose due date moved gets one bell entry, and an email when any of their
// tasks is now due within 48 hours (or overdue). The person who made the change is not notified.
const Voyage = require('../../models/ops/Voyage');
const VoyageTask = require('../../models/ops/VoyageTask');
const notifier = require('./notifier');
const templates = require('./emailTemplates');

const idOf = (v) => (v ? String(v._id || v) : null);

async function notifyDatesChanged(voyageId, result, byUser) {
  if (!result || !result.movedTasks || !result.movedTasks.length) return { people: 0 };
  const voyage = await Voyage.findById(voyageId).populate('vessel', 'name').lean();
  if (!voyage || voyage.status !== 'ACTIVE') return { people: 0 };
  const soon = new Set((result.dueSoon || []).map((m) => idOf(m.id)));
  const tasks = await VoyageTask.find({ _id: { $in: result.movedTasks.map((m) => m.id) } }).select('assignedTo').lean();
  const assignees = new Map(tasks.map((t) => [idOf(t), (t.assignedTo || []).map(idOf)]));
  const me = byUser && byUser.employeeId ? idOf(byUser.employeeId) : null;

  const per = new Map();
  for (const m of result.movedTasks) {
    for (const e of assignees.get(idOf(m.id)) || []) {
      if (e === me) continue;
      if (!per.has(e)) per.set(e, []);
      per.get(e).push({ ...m, soon: soon.has(idOf(m.id)) });
    }
  }
  const people = await notifier.employeesWithUsers([...per.keys()]);
  const info = { voyageId: idOf(voyage), voyageNo: voyage.voyageNo, vesselName: voyage.vessel ? voyage.vessel.name : '' };
  const byName = (byUser && byUser.username) || 'Someone';
  for (const [empId, moved] of per) {
    const p = people.get(empId);
    if (!p) continue;
    // Skip the editor's own login even if not linked through employeeId
    const users = p.users.filter((u) => !byUser || idOf(u) !== idOf(byUser));
    const soonCount = moved.filter((m) => m.soon).length;
    await notifier.bell(users, {
      id: `ops-eta:${info.voyageId}:${Date.now()}`,
      type: 'ops-eta-change',
      title: `${voyage.voyageNo}: dates changed by ${byName}`,
      body: `${moved.length} of your task${moved.length === 1 ? '' : 's'} moved${soonCount ? ` · ${soonCount} now due within 48 h` : ''}`,
      url: `/operations/voyages/${info.voyageId}?tab=tasks`,
    });
    if (soonCount) {
      const { subject, html } = templates.etaChangeEmail(p.employee.employeeName, info, byName, moved, soonCount);
      await notifier.email({ to: p.employee.emailId, toName: p.employee.employeeName, subject, html, kind: 'ETA_CHANGE' });
    }
  }
  return { people: per.size };
}

// Fire and forget from request handlers
function datesChanged(voyageId, result, byUser) {
  notifyDatesChanged(voyageId, result, byUser).catch((err) => console.error('ETA-change alert failed:', err.message));
}

module.exports = { notifyDatesChanged, datesChanged };
