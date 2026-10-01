import { opsRequest } from "./opsApi";

// Report View and fleet dashboard: /api/ops/voyages/:id/report, /api/ops/dashboard
const OpsReportService = {
  voyageReport: (id) => opsRequest(`/voyages/${id}/report`),
  dashboard: (params) => opsRequest("/dashboard", { params }),
  // Ops Reports (H1–H4)
  tasks: (params) => opsRequest("/reports/tasks", { params }),
  overdue: (params) => opsRequest("/reports/overdue", { params }),
  portCalls: (params) => opsRequest("/reports/port-calls", { params }),
  summary: (id) => opsRequest(`/voyages/${id}/summary`),
};

export default OpsReportService;
