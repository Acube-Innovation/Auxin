import { opsRequest } from "./opsApi";

// Vessel Operations masters: /api/ops/{meta, vessels, ports, stages, task-templates, daily-check-templates}
const OpsMasterService = {
  getMeta: () => opsRequest("/meta"),

  // Clients for pickers (charterers, owners, brokers, agents, suppliers)
  lookupClients: (type, search) => opsRequest("/lookups/clients", { params: { type, search } }),

  getVessels: (params) => opsRequest("/vessels", { params }),
  createVessel: (data) => opsRequest("/vessels", { method: "POST", body: data }),
  updateVessel: (id, data) => opsRequest(`/vessels/${id}`, { method: "PUT", body: data }),
  deleteVessel: (id) => opsRequest(`/vessels/${id}`, { method: "DELETE" }),

  getPorts: (params) => opsRequest("/ports", { params }),
  createPort: (data) => opsRequest("/ports", { method: "POST", body: data }),
  updatePort: (id, data) => opsRequest(`/ports/${id}`, { method: "PUT", body: data }),
  deletePort: (id) => opsRequest(`/ports/${id}`, { method: "DELETE" }),

  getStages: () => opsRequest("/stages"),
  createStage: (data) => opsRequest("/stages", { method: "POST", body: data }),
  updateStage: (id, data) => opsRequest(`/stages/${id}`, { method: "PUT", body: data }),
  reorderStages: (ids) => opsRequest("/stages/reorder", { method: "PUT", body: { ids } }),
  deleteStage: (id) => opsRequest(`/stages/${id}`, { method: "DELETE" }),

  getTaskTemplates: (params) => opsRequest("/task-templates", { params }),
  createTaskTemplate: (data) => opsRequest("/task-templates", { method: "POST", body: data }),
  updateTaskTemplate: (id, data) => opsRequest(`/task-templates/${id}`, { method: "PUT", body: data }),
  reorderTaskTemplates: (ids) => opsRequest("/task-templates/reorder", { method: "PUT", body: { ids } }),

  getDailyCheckSets: () => opsRequest("/daily-check-templates"),
  saveDailyCheckSet: (vesselStatus, items) =>
    opsRequest(`/daily-check-templates/${vesselStatus}`, { method: "PUT", body: { items } }),
};

export default OpsMasterService;
