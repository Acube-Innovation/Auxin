import React from "react";
import { Navigate } from "react-router-dom";

// roles (optional): array of User.role values allowed to open the page.
// Without roles, any logged-in user can open it (Phase 1 behaviour).
// This only hides pages; the API enforces the same rules on the server.
const ProtectedRoute = ({ children, roles }) => {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (Array.isArray(roles) && roles.length > 0) {
    const role = localStorage.getItem("role");
    if (!roles.includes(role)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
