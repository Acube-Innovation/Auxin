import axios from 'axios';
import config from '../config/config';

const API_URL = config.API_BASE_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

export const createTask = async (clientId, task) => {
  const { data } = await axios.post(`${API_URL}/api/clients/${clientId}/tasks`, task, { headers: getAuthHeaders() });
  return data;
};

export const getTasksByClient = async (clientId) => {
  const { data } = await axios.get(`${API_URL}/api/clients/${clientId}/tasks`, { headers: getAuthHeaders() });
  return data;
};

export const updateTask = async (clientId, taskId, update) => {
  const { data } = await axios.put(`${API_URL}/api/clients/${clientId}/tasks/${taskId}`, update, { headers: getAuthHeaders() });
  return data;
};

export const deleteTask = async (clientId, taskId) => {
  const { data } = await axios.delete(`${API_URL}/api/clients/${clientId}/tasks/${taskId}`, { headers: getAuthHeaders() });
  return data;
};



