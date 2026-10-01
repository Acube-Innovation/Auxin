import config from "../config/config";

// API_BASE_URL already includes /api; append /documents
const baseUrl = `${config.API_BASE_URL}/api/employeedocuments`;

const listByEmployee = async (employeeId) => {
  const response = await fetch(`${baseUrl}/${employeeId}`);
  if (!response.ok) throw new Error("Failed to fetch documents");
  return response.json();
};

const uploadForEmployee = async (employeeId, file, { uploadedBy, userRole, type } = {}) => {
  const formData = new FormData();
  formData.append("file", file);
  if (uploadedBy) formData.append("uploadedBy", uploadedBy);
  if (userRole) formData.append("userRole", userRole);
  if (type) formData.append("type", type);

  const response = await fetch(`${baseUrl}/${employeeId}`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error("Failed to upload document");
  return response.json();
};

const remove = async (docId) => {
  const response = await fetch(`${baseUrl}/${docId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete document");
  return response.json();
};

const DocumentsService = { listByEmployee, uploadForEmployee, remove };
export default DocumentsService;


