// Who can see and change which voyage (Development Scope section 9 — mapping to be confirmed by the client).
//   admin, managers ............ see and edit every voyage
//   managing_director, director  see every voyage, read-only
//   operators .................. see and edit voyages where their linked Employee is an operator
//                                or is assigned at least one task of the voyage
const { ADMIN, MANAGERS, OPERATORS, READ_ONLY } = require('./roles');

const isIn = (user, group) => Boolean(user && group.includes(user.role));
const employeeIdOf = (user) => (user && user.employeeId ? String(user.employeeId._id || user.employeeId) : null);
const VoyageTask = () => require('../../models/ops/VoyageTask');

function seesAll(user) {
  return isIn(user, ADMIN) || isIn(user, MANAGERS) || isIn(user, READ_ONLY);
}

// Voyages where the user's employee has a task (operators only)
async function taskVoyageIds(user) {
  const emp = employeeIdOf(user);
  if (!emp) return [];
  return VoyageTask().distinct('voyage', { assignedTo: emp });
}

// Mongo filter limiting a Voyage query to what the user may see
async function voyageFilter(user) {
  if (seesAll(user)) return {};
  if (isIn(user, OPERATORS)) {
    const emp = employeeIdOf(user);
    if (!emp) return { _id: null }; // not linked to an employee → nothing
    const viaTasks = await taskVoyageIds(user);
    return viaTasks.length ? { $or: [{ operators: emp }, { _id: { $in: viaTasks } }] } : { operators: emp };
  }
  return { _id: null };
}

const operatesVoyage = (user, voyage) => {
  const emp = employeeIdOf(user);
  return Boolean(emp && (voyage.operators || []).some((o) => String(o._id || o) === emp));
};

// "Assigned" = operator of the voyage, or assignee of one of its tasks
async function isAssigned(user, voyage) {
  if (operatesVoyage(user, voyage)) return true;
  const emp = employeeIdOf(user);
  return Boolean(emp && (await VoyageTask().exists({ voyage: voyage._id, assignedTo: emp })));
}

async function canView(user, voyage) {
  return seesAll(user) || (isIn(user, OPERATORS) && isAssigned(user, voyage));
}

async function canEdit(user, voyage) {
  if (isIn(user, ADMIN) || isIn(user, MANAGERS)) return true;
  return isIn(user, OPERATORS) && isAssigned(user, voyage);
}

function canCreate(user) {
  return isIn(user, ADMIN) || isIn(user, MANAGERS) || isIn(user, OPERATORS);
}

function canDelete(user, voyage) {
  return (isIn(user, ADMIN) || isIn(user, MANAGERS)) && voyage.status === 'DRAFT';
}

// Flags sent to the UI with each voyage. `assigned` may be passed when already known (lists).
async function permissionsFor(user, voyage, assigned) {
  const edit = isIn(user, ADMIN) || isIn(user, MANAGERS) || (isIn(user, OPERATORS) && (assigned !== undefined ? assigned : await isAssigned(user, voyage)));
  return { canEdit: edit, canDelete: canDelete(user, voyage), canCopy: canCreate(user) };
}

module.exports = { voyageFilter, canView, canEdit, canCreate, canDelete, permissionsFor, employeeIdOf, seesAll, isIn };
