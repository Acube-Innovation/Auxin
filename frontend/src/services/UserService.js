import config from "../config/config";

// Normalize API base to end with /api (handles config value with or without /api)
const rawBase = config.API_BASE_URL || '';
let apiBase = rawBase;
if (!apiBase.endsWith('/api')) {
  apiBase = apiBase.replace(/\/+$/, ''); // trim trailing slashes
  apiBase += '/api';
}
const baseUrl = `${apiBase}/auth`;

const getAuthToken = () => localStorage.getItem('token');

// Helper to parse response safely (handles JSON and HTML/text responses)
async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!response.ok) {
    // Try to extract JSON message if possible, otherwise include raw text
    if (contentType.includes('application/json')) {
      try {
        const json = JSON.parse(text);
        const msg = json.message || JSON.stringify(json);
        throw new Error(msg);
      } catch (e) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }
    } else {
      // Likely HTML (index.html) or plain text -> provide clearer error
      throw new Error(`Request failed: ${response.status} ${response.statusText} - ${text.substring(0, 200)}`);
    }
  }

  if (contentType.includes('application/json')) {
    return JSON.parse(text);
  }

  // If not JSON but OK, return raw text
  return text;
}

const getMe = async () => {
  const response = await fetch(`${baseUrl}/me`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });
  return parseResponse(response);
};

const updateMe = async ({ username, phoneNumber, newPassword, emailId }) => {
  const response = await fetch(`${baseUrl}/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify({ username, phoneNumber, newPassword, emailId })
  });
  return parseResponse(response);
};

const uploadProfilePicture = async (file) => {
  const formData = new FormData();
  formData.append('profilePicture', file);
  const response = await fetch(`${baseUrl}/me/profile-picture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: formData
  });
  return parseResponse(response);
};

// User Management methods (Admin only)
const getAllUsers = async () => {
  const response = await fetch(`${baseUrl}/users`, {
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });
  return parseResponse(response);
};

const createUser = async (userData) => {
  const response = await fetch(`${baseUrl}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify(userData)
  });
  return parseResponse(response);
};

const deleteUser = async (userId) => {
  const response = await fetch(`${baseUrl}/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`
    }
  });
  return parseResponse(response);
};

const updateUser = async (userId, userData) => {
  const response = await fetch(`${baseUrl}/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`
    },
    body: JSON.stringify(userData)
  });
  return parseResponse(response);
};

const UserService = { getMe, updateMe, uploadProfilePicture, getAllUsers, createUser, deleteUser, updateUser };
export default UserService;


