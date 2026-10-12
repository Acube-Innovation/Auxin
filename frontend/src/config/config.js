// All API calls use this; ensure REACT_APP_API_URL is set for local backend (e.g. http://localhost:5000)
console.log('API BASE URL:', process.env.REACT_APP_API_URL);

/**
 * Returns the base URL for API requests (no trailing /api).
 * Uses same host as the page (localhost or 127.0.0.1) to avoid ERR_CONNECTION_RESET on Windows.
 * On live (auxincrm.cloud), returns '' so all API calls use relative paths (same-origin).
 */
export function getApiBaseUrl() {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined' && window.location.origin === 'https://auxincrm.cloud') {
    return ''; // relative URL - request goes to same origin
  }
  if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
    return 'http://127.0.0.1:5000';
  }
  return 'http://localhost:5000';
}

/**
 * Returns full URL for auth endpoints (e.g. /api/auth/login).
 */
export function getAuthApiUrl(path) {
  const base = getApiBaseUrl();
  return base ? `${base}/api/auth${path}` : `/api/auth${path}`;
}

// Compute the smart API_BASE_URL at module load time so all services
// using config.API_BASE_URL automatically get the right URL.
// On live: '/api'  |  On local: 'http://localhost:5000/api'
const _smartBase = getApiBaseUrl();
const config = {
  API_BASE_URL: _smartBase ? `${_smartBase}/api` : '/api',
};

export default config;
