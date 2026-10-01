// services/CreateEventService.js
import axios from 'axios';
import config from '../config/config';

const API_URL = config.API_BASE_URL;

// Helper function to get authorization headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
};

// Create a new event for a employee
export const createEvent = async (employeeId, eventData) => {
  try {
    const response = await axios.post(
      `${API_URL}/api/employees/${employeeId}/events`,
      eventData,
      {
        headers: getAuthHeaders(),
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error creating event:", error);
    throw error;
  }
};

// Get all events for a employee
export const getEventsByEmployeeId = async (employeeId) => {
  try {
    const response = await axios.get(`${API_URL}/api/employees/${employeeId}/events`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching events:", error);
    throw error;
  }
};

// Update an event for a employee
export const updateEvent = async (employeeId, eventId, eventData) => {
  try {
    const response = await axios.put(
      `${API_URL}/api/employees/${employeeId}/events/${eventId}`,
      eventData,
      {
        headers: getAuthHeaders(),
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error updating event:", error);
    throw error;
  }
};

// Delete event for a employee
export const deleteEvent = async (employeeId, eventId) => {
  try {
    const response = await axios.delete(`${API_URL}/api/employees/${employeeId}/events/${eventId}`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error("Error deleting event:", error);
    throw error;
  }
};

export const getAllEvents = async () => {
  try {
    const response = await axios.get(`${API_URL}/api/employees/events`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching all events:', error);
    throw error;
  }
};
