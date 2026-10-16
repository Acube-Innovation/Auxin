import axios from "axios";
import { getApiBaseUrl } from "../config/config";

// User Management → Leave Approvers (Admin only): for each employee, the HOD and HR who approve their leave
const _base = getApiBaseUrl();
const API_URL = _base ? `${_base}/api/leave-approvers` : "/api/leave-approvers";

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const message = (err, fallback) => err?.response?.data?.message || fallback;

const call = async (fn, fallback) => {
    try {
        return (await fn()).data;
    } catch (err) {
        throw new Error(message(err, fallback));
    }
};

const LeaveApproverService = {
    list: () => call(() => axios.get(API_URL, { headers: headers() }), "Failed to load leave approvers"),
    options: () => call(() => axios.get(`${API_URL}/options`, { headers: headers() }), "Failed to load employees and logins"),
    // data: { person: 'e:<employeeId>' | 'u:<userId>', hod, hr }
    create: (data) => call(() => axios.post(API_URL, data, { headers: headers() }), "Failed to save"),
    update: (id, data) => call(() => axios.put(`${API_URL}/${id}`, data, { headers: headers() }), "Failed to save"),
    remove: (id) => call(() => axios.delete(`${API_URL}/${id}`, { headers: headers() }), "Failed to delete"),
};

export default LeaveApproverService;
