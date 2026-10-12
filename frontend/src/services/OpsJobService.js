import { opsRequest } from "./opsApi";

// Scheduled jobs and the email log (admin): /api/ops/jobs
const OpsJobService = {
  list: () => opsRequest("/jobs"),
  run: (name) => opsRequest(`/jobs/${name}/run`, { method: "POST" }),
  emails: (params) => opsRequest("/jobs/emails", { params }),
  email: (id) => opsRequest(`/jobs/emails/${id}`),
};

export default OpsJobService;
