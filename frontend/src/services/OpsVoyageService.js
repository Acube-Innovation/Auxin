import { opsRequest, OPS_BASE_URL } from "./opsApi";

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

// Voyages and port calls: /api/ops/voyages
const OpsVoyageService = {
  list: (params) => opsRequest("/voyages", { params }),
  get: (id) => opsRequest(`/voyages/${id}`),
  create: (data) => opsRequest("/voyages", { method: "POST", body: data }),
  update: (id, data) => opsRequest(`/voyages/${id}`, { method: "PUT", body: data }),
  remove: (id) => opsRequest(`/voyages/${id}`, { method: "DELETE" }),
  clone: (id) => opsRequest(`/voyages/${id}/clone`, { method: "POST" }),

  previewTasks: (id) => opsRequest(`/voyages/${id}/generate-preview`, { method: "POST" }),
  activate: (id, { excluded = [], adhocTasks = [] } = {}) => opsRequest(`/voyages/${id}/activate`, { method: "POST", body: { excluded, adhocTasks } }),
  setVesselStatus: (id, value) => opsRequest(`/voyages/${id}/vessel-status`, { method: "PUT", body: { value } }),
  getTasks: (id, params) => opsRequest(`/voyages/${id}/tasks`, { params }),
  getRevisions: (id) => opsRequest(`/voyages/${id}/revisions`),
  getActivity: (id, params) => opsRequest(`/voyages/${id}/activity`, { params }),

  // Voyage documents (I2)
  getDocuments: (id) => opsRequest(`/voyages/${id}/documents`),
  uploadDocuments: async (id, files, fields = {}) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    Object.entries(fields).forEach(([k, v]) => v !== undefined && v !== null && v !== "" && form.append(k, v));
    const res = await fetch(`${OPS_BASE_URL}/voyages/${id}/documents`, { method: "POST", headers: auth(), body: form });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.message) || `Upload failed (${res.status})`);
    return data;
  },
  updateDocument: (id, docId, data) => opsRequest(`/voyages/${id}/documents/${docId}`, { method: "PATCH", body: data }),
  deleteDocument: (id, docId) => opsRequest(`/voyages/${id}/documents/${docId}`, { method: "DELETE" }),
  // Files are private: fetch with the token, then save (download) or open in a new tab (view)
  openDocument: async (id, doc, { view = false } = {}) => {
    const res = await fetch(`${OPS_BASE_URL}/voyages/${id}/documents/${doc._id}/download${view ? "?inline=1" : ""}`, { headers: auth() });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const url = URL.createObjectURL(await res.blob());
    if (view) {
      window.open(url, "_blank", "noopener");
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
  getDailyChecks: (id, date) => opsRequest(`/voyages/${id}/daily-checks`, { params: { date } }),
  updateDailyCheck: (id, itemId, data) => opsRequest(`/voyages/${id}/daily-checks/items/${itemId}`, { method: "PATCH", body: data }),

  addPortCall: (id, data) => opsRequest(`/voyages/${id}/port-calls`, { method: "POST", body: data }),
  updatePortCall: (id, pcId, data) => opsRequest(`/voyages/${id}/port-calls/${pcId}`, { method: "PUT", body: data }),
  removePortCall: (id, pcId, reason) => opsRequest(`/voyages/${id}/port-calls/${pcId}`, { method: "DELETE", body: reason ? { reason } : undefined }),
  reorderPortCalls: (id, order) => opsRequest(`/voyages/${id}/port-calls/reorder`, { method: "PUT", body: { order } }),
};

export default OpsVoyageService;
