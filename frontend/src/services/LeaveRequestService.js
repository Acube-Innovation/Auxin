import axios from "axios";
import { getApiBaseUrl } from "../config/config";

const _base = getApiBaseUrl(); // '' on live (same-origin), 'http://localhost:5000' locally
const API_URL = _base ? `${_base}/api/leave-requests` : '/api/leave-requests';


const getAuthHeader = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
};

const getLeaveRequests = async (params = {}) => {
    const response = await axios.get(API_URL, {
        headers: getAuthHeader(),
        params
    });
    return response.data;
};

const getLeaveBalance = async () => {
    const response = await axios.get(`${API_URL}/balance`, {
        headers: getAuthHeader()
    });
    return response.data;
};

const createLeaveRequest = async (data) => {
    const response = await axios.post(API_URL, data, {
        headers: getAuthHeader()
    });
    return response.data;
};

const updateLeaveRequest = async (id, data) => {
    const response = await axios.put(`${API_URL}/${id}`, data, {
        headers: getAuthHeader()
    });
    return response.data;
};

const deleteLeaveRequest = async (id) => {
    const response = await axios.delete(`${API_URL}/${id}`, {
        headers: getAuthHeader()
    });
    return response.data;
};

const leaveRequestService = {
    getLeaveRequests,
    getLeaveBalance,
    createLeaveRequest,
    updateLeaveRequest,
    deleteLeaveRequest,
    approveLeaveRequest: async (id, status) => {
        const response = await axios.put(`${API_URL}/${id}`, { status }, {
            headers: getAuthHeader()
        });
        return response.data;
    }
};

export default leaveRequestService;
