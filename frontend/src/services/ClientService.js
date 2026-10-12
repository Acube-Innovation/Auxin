import config from '../config/config';

class ClientService {
  constructor() {
    let baseURL = config.API_BASE_URL || 'http://localhost:5000/api';

    if (!baseURL.endsWith('/api')) {
      if (baseURL.endsWith('/')) {
        baseURL += 'api';
      } else {
        baseURL += '/api';
      }
    }

    this.apiRoot = baseURL;
    this.baseURL = `${baseURL}/clients`;
  }

  getAuthToken() {
    return localStorage.getItem('token');
  }

  getAuthHeaders() {
    const token = this.getAuthToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  getAuthHeadersMultipart() {
    const token = this.getAuthToken();
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  async getClients() {
    const response = await fetch(this.baseURL, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async getClient(id) {
    const response = await fetch(`${this.baseURL}/${id}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async createClient(data) {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async createClientWithFile(data, profileImage) {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    if (profileImage) {
      formData.append('profilePicture', profileImage);
    }
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: this.getAuthHeadersMultipart(),
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async updateClient(id, data) {
    const response = await fetch(`${this.baseURL}/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async updateClientWithFile(id, data, profileImage) {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    if (profileImage) {
      formData.append('profilePicture', profileImage);
    }
    const response = await fetch(`${this.baseURL}/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeadersMultipart(),
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async deleteClient(id) {
    const response = await fetch(`${this.baseURL}/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async bulkDeleteClients(ids) {
    const response = await fetch(`${this.baseURL}/bulk-delete`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async getClientRemarks(clientId) {
    const response = await fetch(`${this.apiRoot}/client-remarks/${clientId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async addClientRemark(clientId, text) {
    const response = await fetch(`${this.apiRoot}/client-remarks/${clientId}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }

  async deleteClientEvent(clientId, eventId) {
    const response = await fetch(`${this.baseURL}/${clientId}/events/${eventId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    return response.json();
  }
}

const clientService = new ClientService();
export default clientService;
