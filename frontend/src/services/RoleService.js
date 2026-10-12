import config from '../config/config';

class RoleService {
  constructor() {
    let baseURL = config.API_BASE_URL || 'http://localhost:5000/api';

    if (!baseURL.endsWith('/api')) {
      if (baseURL.endsWith('/')) {
        baseURL += 'api';
      } else {
        baseURL += '/api';
      }
    }

    this.baseURL = `${baseURL}/roles`;
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

  async getRoles() {
    const response = await fetch(this.baseURL, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    const data = await response.json();
    const raw = data && data.roles;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((r) => ({
        _id: r._id,
        name: r.name != null ? String(r.name).trim() : '',
      }))
      .filter((r) => r.name && r._id);
  }

  async createRole(name) {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    return data;
  }

  async deleteRole(id) {
    const response = await fetch(`${this.baseURL}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }
    return data;
  }
}

export default new RoleService();
