import config from "../config/config";

// Daily Sales & Leads summaries received by the logged-in user: /api/sales-summary
let base = (config.API_BASE_URL || "http://localhost:5000/api").replace(/\/+$/, "");
if (!base.endsWith("/api")) base += "/api";

async function request(path) {
  const res = await fetch(`${base}/sales-summary${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.message) || `Request failed (${res.status})`);
  return data;
}

const SalesSummaryService = {
  list: () => request("/"),
  access: () => request("/access"),
  get: (id) => request(`/${id}`),
};

export default SalesSummaryService;
