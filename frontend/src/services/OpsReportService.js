import { opsRequest } from "./opsApi";

// Report View and fleet dashboard: /api/ops/voyages/:id/report, /api/ops/dashboard
const OpsReportService = {
  voyageReport: (id) => opsRequest(`/voyages/${id}/report`),
  dashboard: (params) => opsRequest("/dashboard", { params }),
};

export default OpsReportService;
