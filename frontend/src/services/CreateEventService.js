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

// Create a new event for a client
export const createEvent = async (clientId, eventData) => {
  try {
    const response = await axios.post(
      `${API_URL}/api/clients/${clientId}/events`,
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

// Get all events for a client
export const getEventsByClientId = async (clientId) => {
  try {
    const response = await axios.get(`${API_URL}/api/clients/${clientId}/events`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching events:", error);
    throw error;
  }
};

// Update an event for a client
export const updateEvent = async (clientId, eventId, eventData) => {
  try {
    const response = await axios.put(
      `${API_URL}/api/clients/${clientId}/events/${eventId}`,
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

// Delete event for a client
export const deleteEvent = async (clientId, eventId) => {
  try {
    const response = await axios.delete(`${API_URL}/api/clients/${clientId}/events/${eventId}`, {
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
    const response = await axios.get(`${API_URL}/api/clients/events`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching all events:', error);
    throw error;
  }
};
