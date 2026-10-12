import config from '../config/config';

class DepartmentService {
  constructor() {
    let baseURL = config.API_BASE_URL || 'http://localhost:5000/api';

    if (!baseURL.endsWith('/api')) {
      if (baseURL.endsWith('/')) {
        baseURL += 'api';
      } else {
        baseURL += '/api';
      }
    }

    this.baseURL = `${baseURL}/departments`;
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

  async getDepartments() {
    const response = await fetch(this.baseURL, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${response.status}`);
    }
    const data = await response.json();
    const raw = data && data.departments;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((d) => ({
        _id: d._id,
        name: d.name != null ? String(d.name).trim() : '',
        isDefault: !!d.isDefault,
      }))
      .filter((d) => d.name && d._id);
  }

  async createDepartment(name) {
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

  async deleteDepartment(id) {
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

export default new DepartmentService();
