import config from "../config/config";

// Shared request helper for the Vessel Operations services.
// Base URL normalised like ClientService: REACT_APP_API_URL may be given with or without /api.
let base = (config.API_BASE_URL || "http://localhost:5000/api").replace(/\/+$/, "");
if (!base.endsWith("/api")) base += "/api";
export const OPS_BASE_URL = `${base}/ops`;

// Unlike the Phase 1 services, the body is sent as-is: empty values are not stripped,
// so clearing a field in a form really clears it (send null).
export async function opsRequest(path, { method = "GET", body, params } = {}) {
  const qs = params
    ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString()
    : "";
  const response = await fetch(`${OPS_BASE_URL}${path}${qs === "?" ? "" : qs}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }
  if (!response.ok) {
    const error = new Error((data && data.message) || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}
