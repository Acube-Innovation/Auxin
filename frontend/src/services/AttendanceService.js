import config from '../config/config';

class AttendanceService {
  constructor() {
    let baseURL = config.API_BASE_URL || 'http://localhost:5000/api';
    if (!baseURL.endsWith('/api')) {
      baseURL = baseURL.endsWith('/') ? baseURL + 'api' : baseURL + '/api';
    }
    this.baseURL = `${baseURL}/attendance`;
  }

  getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async setAttendance(employeeId, date, status, note) {
    const resp = await fetch(`${this.baseURL}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ employeeId, date, status, note })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${resp.status}`);
    }
    return await resp.json();
  }

  async getByEmployee(employeeId, start, end) {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const resp = await fetch(`${this.baseURL}/employee/${employeeId}?${params.toString()}`, {
      headers: this.getAuthHeaders()
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${resp.status}`);
    }
    return await resp.json();
  }

  async getByRange(start, end) {
    const params = new URLSearchParams({ start, end });
    const resp = await fetch(`${this.baseURL}/range?${params.toString()}`, {
      headers: this.getAuthHeaders()
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${resp.status}`);
    }
    return await resp.json();
  }

  async getMonthlySummary(year) {
    const resp = await fetch(`${this.baseURL}/summary/monthly?year=${year}`, {
      headers: this.getAuthHeaders()
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${resp.status}`);
    }
    return await resp.json();
  }

  async getYearlySummary() {
    const resp = await fetch(`${this.baseURL}/summary/yearly`, {
      headers: this.getAuthHeaders()
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${resp.status}`);
    }
    return await resp.json();
  }
}

export default new AttendanceService();