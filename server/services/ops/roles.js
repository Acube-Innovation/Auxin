// Role groups for the Vessel Operations module (Phase 2 scope, section 9 – pending client confirmation).
// Values are User.role enum values, never Employee.role (free text).
const ADMIN = ['admin'];
const MANAGERS = ['chartering_manager', 'operations_pricing_manager'];
const OPERATORS = ['operations_executive', 'executive_post_fixture'];
const READ_ONLY = ['managing_director', 'director'];

const ALL_OPS = [...ADMIN, ...MANAGERS, ...OPERATORS, ...READ_ONLY];

module.exports = { ADMIN, MANAGERS, OPERATORS, READ_ONLY, ALL_OPS };
