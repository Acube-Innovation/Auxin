import { opsRequest, OPS_BASE_URL } from "./opsApi";

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

// Voyage tasks: /api/ops/tasks (and ad-hoc tasks under /api/ops/voyages/:id/tasks)
const OpsTaskService = {
  mine: (params) => opsRequest("/tasks/mine", { params }),
  get: (id) => opsRequest(`/tasks/${id}`),
  update: (id, patch) => opsRequest(`/tasks/${id}`, { method: "PATCH", body: patch }),
  timer: (id, action) => opsRequest(`/tasks/${id}/timer`, { method: "POST", body: { action } }), // start | hold | stop
  bulk: (ids, patch) => opsRequest("/tasks/bulk", { method: "POST", body: { ids, patch } }),
  addAdhoc: (voyageId, data) => opsRequest(`/voyages/${voyageId}/tasks`, { method: "POST", body: data }),

  uploadAttachment: async (id, file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${OPS_BASE_URL}/tasks/${id}/attachments`, { method: "POST", headers: auth(), body: form });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.message) || `Upload failed (${res.status})`);
    return data;
  },
  // Attachments are private: fetch with the token, then hand the file to the browser
  downloadAttachment: async (id, att) => {
    const res = await fetch(`${OPS_BASE_URL}/tasks/${id}/attachments/${att._id}`, { headers: auth() });
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = att.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },
  removeAttachment: (id, attId) => opsRequest(`/tasks/${id}/attachments/${attId}`, { method: "DELETE" }),
};

export const TASK_STATUS_LABEL = { NOT_STARTED: "Not started", INITIATED: "Initiated", AWAITING: "Awaiting", DONE: "Done", NA: "N/A" };
export const TASK_STATUSES = Object.keys(TASK_STATUS_LABEL);

export default OpsTaskService;
