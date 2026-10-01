// HTML for Vessel Operations emails. Inline styles only (email clients ignore <style> blocks).
const { APP_URL } = require('./config');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d) => {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return '—';
  const [y, m, day] = d.split('-');
  return `${day}-${MONTHS[Number(m) - 1]}-${y}`;
};
const link = (path) => `${APP_URL}${path}`;

const KIND_TEXT = {
  'D-1': { text: 'Due tomorrow', color: '#067647' },
  D0: { text: 'Due today', color: '#b54708' },
  OD: { text: 'Overdue', color: '#b42318' },
};

function layout(title, intro, body, button) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#101828;max-width:760px">
  <div style="background:#0b3a6f;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0;font-size:17px;font-weight:bold">Auxin · Vessel Operations</div>
  <div style="border:1px solid #d0d5dd;border-top:none;padding:18px;border-radius:0 0 8px 8px">
    <h2 style="margin:0 0 6px;font-size:18px;color:#0b3a6f">${esc(title)}</h2>
    <p style="margin:0 0 14px;color:#475467">${intro}</p>
    ${body}
    ${button ? `<p style="margin:18px 0 0"><a href="${esc(button.url)}" style="background:#1570ef;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;display:inline-block">${esc(button.label)}</a></p>` : ''}
    <p style="margin:18px 0 0;font-size:12px;color:#98a2b3">Dates are office dates. This email was sent automatically by Auxin.</p>
  </div></div>`;
}

const th = (t) => `<th style="text-align:left;padding:6px 8px;background:#f2f4f7;font-size:12px;color:#475467;border-bottom:1px solid #eaecf0">${t}</th>`;
const td = (t, extra = '') => `<td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #eaecf0;${extra}">${t}</td>`;

function voyageHeading(v) {
  return `<div style="margin:16px 0 6px;font-weight:bold;color:#0b3a6f">${esc(v.vesselName)} · <a href="${esc(link(`/operations/voyages/${v.voyageId}?tab=tasks`))}" style="color:#1570ef">${esc(v.voyageNo)}</a>${v.vesselStatus ? ` <span style="font-weight:normal;color:#667085">· ${esc(v.vesselStatus)}</span>` : ''}</div>`;
}

function taskTable(tasks, { showKind = true, showAssignees = false } = {}) {
  return `<table style="border-collapse:collapse;width:100%">
  <tr>${th('Task')}${th('Due')}${showKind ? th('') : ''}${showAssignees ? th('Assigned to') : ''}${th('Priority')}</tr>
  ${tasks.map((t) => `<tr>
    ${td(`<a href="${esc(link(`/operations/voyages/${t.voyageId}?tab=tasks&task=${t.taskId}`))}" style="color:#101828;text-decoration:none">${esc(t.name)}</a>${t.code ? ` <span style="color:#98a2b3">${esc(t.code)}</span>` : ''}`)}
    ${td(fmtDate(t.dueDate), 'white-space:nowrap')}
    ${showKind ? td(t.kind ? `<b style="color:${KIND_TEXT[t.kind].color}">${KIND_TEXT[t.kind].text}${t.kind === 'OD' ? ` · ${t.overdueDays} day(s)` : ''}</b>` : (t.overdueDays ? `<b style="color:#b42318">${t.overdueDays} day(s) overdue</b>` : ''), 'white-space:nowrap') : ''}
    ${showAssignees ? td(esc(t.assignees || '—')) : ''}
    ${td(esc(t.priority))}
  </tr>`).join('')}
  </table>`;
}

// voyages: [{ voyageId, voyageNo, vesselName, vesselStatus, tasks: [...] }]
function reminderEmail(name, voyages, counts) {
  const parts = [counts.OD && `${counts.OD} overdue`, counts.D0 && `${counts.D0} due today`, counts['D-1'] && `${counts['D-1']} due tomorrow`].filter(Boolean);
  const subject = `Vessel ops reminder: ${parts.join(', ')}`;
  const body = voyages.map((v) => voyageHeading(v) + taskTable(v.tasks)).join('');
  return { subject, html: layout('Task reminder', `Hello ${esc(name)}, these tasks assigned to you need attention:`, body, { label: 'Open My Tasks', url: link('/operations/my-tasks') }) };
}

// voyages: [{ ..., overdue: [], today: [], checks: { open: [names], done, total } | null }]
function digestEmail(name, today, voyages, totals) {
  const subject = `Morning summary ${fmtDate(today)}: ${totals.overdue} overdue, ${totals.today} due today, ${totals.checksOpen} checks`;
  const body = voyages.map((v) => {
    const sections = [];
    if (v.overdue.length) sections.push(`<div style="margin:6px 0 2px;color:#b42318;font-weight:bold;font-size:13px">Overdue (${v.overdue.length})</div>${taskTable(v.overdue, { showKind: true })}`);
    if (v.today.length) sections.push(`<div style="margin:6px 0 2px;color:#b54708;font-weight:bold;font-size:13px">Due today (${v.today.length})</div>${taskTable(v.today, { showKind: false })}`);
    if (v.checks) {
      sections.push(`<div style="margin:6px 0 2px;color:#0b3a6f;font-weight:bold;font-size:13px">Today's checks — ${v.checks.done} / ${v.checks.total} done</div>
        <ul style="margin:2px 0 0;padding-left:18px;font-size:13px">${v.checks.open.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        <a href="${esc(link(`/operations/voyages/${v.voyageId}?tab=checks`))}" style="font-size:12px;color:#1570ef">Open the checklist</a>`);
    }
    if (!v.overdue.length && !v.today.length) sections.unshift('<div style="font-size:13px;color:#067647">No tasks due today or overdue.</div>');
    return voyageHeading(v) + sections.join('');
  }).join('');
  return { subject, html: layout(`Good morning, ${name}`, `Your vessels for ${esc(fmtDate(today))}: <b>${totals.overdue}</b> overdue, <b>${totals.today}</b> due today, <b>${totals.checksOpen}</b> daily checks to do.`, body, { label: 'Open My Tasks', url: link('/operations/my-tasks') }) };
}

function escalationEmail(name, voyages, total, rule) {
  const subject = `Escalation: ${total} task${total === 1 ? '' : 's'} overdue beyond the limit`;
  const body = voyages.map((v) => voyageHeading(v) + taskTable(v.tasks, { showKind: true, showAssignees: true })).join('');
  return { subject, html: layout('Overdue tasks escalated', `Hello ${esc(name)}, these tasks are now overdue beyond the limit (${esc(rule)}):`, body, { label: 'Open the voyages', url: link('/operations/voyages') }) };
}

function etaChangeEmail(name, voyage, byName, moved, soonCount) {
  const subject = `${voyage.voyageNo}: dates changed by ${byName} — ${moved.length} of your tasks moved`;
  const body = `<table style="border-collapse:collapse;width:100%"><tr>${th('Task')}${th('Was due')}${th('Now due')}</tr>
    ${moved.map((m) => `<tr>${td(esc(m.name))}${td(fmtDate(m.from))}${td(`<b${m.soon ? ' style="color:#b42318"' : ''}>${m.to ? fmtDate(m.to) : 'awaiting date'}${m.soon ? ' · due soon' : ''}</b>`)}</tr>`).join('')}</table>`;
  return { subject, html: layout(`${voyage.voyageNo} · ${voyage.vesselName}`, `Hello ${esc(name)}, ${esc(byName)} changed key dates of this voyage. ${soonCount ? `<b style="color:#b42318">${soonCount} of your tasks are now due within 48 hours or overdue.</b>` : ''}`, voyageHeading(voyage) + body, { label: 'Open the voyage', url: link(`/operations/voyages/${voyage.voyageId}?tab=tasks`) }) };
}

module.exports = { reminderEmail, digestEmail, escalationEmail, etaChangeEmail, fmtDate, link };
