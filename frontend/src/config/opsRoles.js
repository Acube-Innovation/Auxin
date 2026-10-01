// Role groups for Vessel Operations — mirror of server/services/ops/roles.js.
// These only decide what the UI shows; the API enforces the same rules.
export const OPS_ADMIN = ["admin"];
export const OPS_MANAGERS = ["chartering_manager", "operations_pricing_manager"];
export const OPS_OPERATORS = ["operations_executive", "executive_post_fixture"];
export const OPS_READ_ONLY = ["managing_director", "director"];

export const ALL_OPS_ROLES = [...OPS_ADMIN, ...OPS_MANAGERS, ...OPS_OPERATORS, ...OPS_READ_ONLY];
// Ops Masters menu (Menu Structure §5): admin edits, managers view / edit task templates
export const OPS_MASTERS_ROLES = [...OPS_ADMIN, ...OPS_MANAGERS];

export const currentRole = () => localStorage.getItem("role") || "";
export const hasRole = (roles) => roles.includes(currentRole());
