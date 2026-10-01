import config from '../config/config';

const base = (config.API_BASE_URL || '').replace(/\/api\/?$/,'') + '/api/meetings';
const clientsEventsUrl = (config.API_BASE_URL || '').replace(/\/api\/?$/,'') + '/api/clients/events';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function createMeeting(payload) {
  const resp = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw await resp.json().catch(()=>new Error(resp.statusText));
  return resp.json();
}

async function updateMeeting(id, payload) {
  const resp = await fetch(`${base}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw await resp.json().catch(()=>new Error(resp.statusText));
  return resp.json();
}

// new: delete meeting
async function deleteMeeting(id) {
  const resp = await fetch(`${base}/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() }
  });
  if (!resp.ok) {
    const err = await resp.json().catch(()=>({ message: resp.statusText }));
    throw new Error(err.message || `HTTP ${resp.status}`);
  }
  return resp.json();
}

async function getMeetings(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const resp = await fetch(`${base}${qs ? `?${qs}` : ''}`, { headers: authHeaders() });
  if (!resp.ok) throw new Error('Failed to fetch meetings');
  return resp.json();
}

// New: fetch aggregated client events (used by calendar)
// exported as a named function for compatibility with existing imports
export async function getAllEvents() {
  try {
    const resp = await fetch(clientsEventsUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...authHeaders() }
    });
    const text = await resp.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }

    if (!resp.ok) {
      const msg = data && data.message ? data.message : (typeof data === 'string' ? data : `HTTP ${resp.status}`);
      const err = new Error(msg);
      err.response = data;
      throw err;
    }

    if (!Array.isArray(data)) return Array.isArray(data?.events) ? data.events : [];
    return data;
  } catch (error) {
    console.error('MeetingService.getAllEvents error:', error);
    throw error;
  }
}

export default { createMeeting, updateMeeting, getMeetings, getAllEvents, deleteMeeting };
