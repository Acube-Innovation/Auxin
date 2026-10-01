import { opsRequest } from "./opsApi";

// Voyages and port calls: /api/ops/voyages
const OpsVoyageService = {
  list: (params) => opsRequest("/voyages", { params }),
  get: (id) => opsRequest(`/voyages/${id}`),
  create: (data) => opsRequest("/voyages", { method: "POST", body: data }),
  update: (id, data) => opsRequest(`/voyages/${id}`, { method: "PUT", body: data }),
  remove: (id) => opsRequest(`/voyages/${id}`, { method: "DELETE" }),
  clone: (id) => opsRequest(`/voyages/${id}/clone`, { method: "POST" }),

  addPortCall: (id, data) => opsRequest(`/voyages/${id}/port-calls`, { method: "POST", body: data }),
  updatePortCall: (id, pcId, data) => opsRequest(`/voyages/${id}/port-calls/${pcId}`, { method: "PUT", body: data }),
  removePortCall: (id, pcId) => opsRequest(`/voyages/${id}/port-calls/${pcId}`, { method: "DELETE" }),
  reorderPortCalls: (id, order) => opsRequest(`/voyages/${id}/port-calls/reorder`, { method: "PUT", body: { order } }),
};

export default OpsVoyageService;
