// Who can see and change which voyage (Development Scope section 9 — mapping to be confirmed by the client).
//   admin, managers ............ see and edit every voyage
//   managing_director, director  see every voyage, read-only
//   operators .................. see and edit voyages where their linked Employee is an operator
//                                (later also voyages where they are assigned a task — step 5)
const { ADMIN, MANAGERS, OPERATORS, READ_ONLY } = require('./roles');

const isIn = (user, group) => Boolean(user && group.includes(user.role));
const employeeIdOf = (user) => (user && user.employeeId ? String(user.employeeId._id || user.employeeId) : null);

function seesAll(user) {
  return isIn(user, ADMIN) || isIn(user, MANAGERS) || isIn(user, READ_ONLY);
}

// Mongo filter limiting a Voyage query to what the user may see
function voyageFilter(user) {
  if (seesAll(user)) return {};
  if (isIn(user, OPERATORS)) {
    const emp = employeeIdOf(user);
    return emp ? { operators: emp } : { _id: null }; // not linked to an employee → nothing
  }
  return { _id: null };
}

function isAssigned(user, voyage) {
  const emp = employeeIdOf(user);
  return Boolean(emp && (voyage.operators || []).some((o) => String(o._id || o) === emp));
}

function canView(user, voyage) {
  return seesAll(user) || (isIn(user, OPERATORS) && isAssigned(user, voyage));
}

function canEdit(user, voyage) {
  if (isIn(user, ADMIN) || isIn(user, MANAGERS)) return true;
  return isIn(user, OPERATORS) && isAssigned(user, voyage);
}

function canCreate(user) {
  return isIn(user, ADMIN) || isIn(user, MANAGERS) || isIn(user, OPERATORS);
}

function canDelete(user, voyage) {
  return (isIn(user, ADMIN) || isIn(user, MANAGERS)) && voyage.status === 'DRAFT';
}

// Flags sent to the UI with each voyage
function permissionsFor(user, voyage) {
  return { canEdit: canEdit(user, voyage), canDelete: canDelete(user, voyage), canCopy: canCreate(user) };
}

module.exports = { voyageFilter, canView, canEdit, canCreate, canDelete, permissionsFor, employeeIdOf, seesAll };
