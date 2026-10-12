/**
 * Interakt WhatsApp API – send approved template messages.
 * Used when events/meetings are created; one message per assigned team member.
 *
 * Required in Interakt dashboard:
 * - WhatsApp Business account linked
 * - Template created and APPROVED (name + language must match .env)
 * - API key from Settings > Developer Setting > Secret Key
 * Recipients must exist in Interakt before template send; we call Track User first.
 */

const https = require('https');

const INTERAKT_BASE_URL = process.env.INTERAKT_BASE_URL || 'api.interakt.ai';
const INTERAKT_TRACK_USERS_PATH = '/v1/public/track/users/';
const INTERAKT_SEND_TEMPLATE_PATH = process.env.INTERAKT_SEND_TEMPLATE_PATH || '/v1/public/message/';
const INTERAKT_API_KEY = process.env.INTERAKT_API_KEY || '';
const INTERAKT_TEMPLATE_NAME = process.env.INTERAKT_TEMPLATE_NAME || 'notification';
const INTERAKT_TEMPLATE_LANGUAGE = process.env.INTERAKT_TEMPLATE_LANGUAGE || 'en';
const INTERAKT_DEBUG = process.env.INTERAKT_DEBUG === 'true';

function normalizePhone(mobile) {
  if (!mobile || typeof mobile !== 'string') return '';
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10 && !digits.startsWith('91')) return '91' + digits;
  return digits;
}

/**
 * Create/update user in Interakt (required before sending template).
 * POST /v1/public/track/users/
 */
function trackUser(fullPhoneNumber, traits = {}) {
  if (!INTERAKT_API_KEY || !fullPhoneNumber) return Promise.resolve({ ok: false });
  const body = JSON.stringify({ fullPhoneNumber, traits });
  const url = `https://${INTERAKT_BASE_URL}${INTERAKT_TRACK_USERS_PATH}`;
  if (INTERAKT_DEBUG) console.log('[Interakt] Track user request ->', url, 'body:', body);
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: INTERAKT_BASE_URL,
        path: INTERAKT_TRACK_USERS_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${INTERAKT_API_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          console.log('[Interakt] Track user response:', res.statusCode, data || '(empty)');
          if (!ok) console.warn('[Interakt] Track user FAILED – fix this first. Body:', data);
          resolve({ ok, statusCode: res.statusCode, body: data });
        });
      }
    );
    req.on('error', (err) => {
      console.warn('[Interakt] Track user request error:', err.message);
      resolve({ ok: false, error: err.message });
    });
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
    req.write(body);
    req.end();
  });
}

/**
 * Format time string (e.g. "09:00" or "14:30") to "09:00 AM" / "02:30 PM".
 */
function formatTimeForTemplate(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 'N/A';
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1] ? String(parseInt(parts[1], 10)).padStart(2, '0') : '00';
  if (isNaN(h)) return timeStr;
  if (h === 0) return `12:${m} AM`;
  if (h < 12) return `${h}:${m} AM`;
  if (h === 12) return `12:${m} PM`;
  return `${h - 12}:${m} PM`;
}

/**
 * Format date for template as DD/MM/YYYY to match WhatsApp sample.
 */
function formatDateForTemplate(dateVal) {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Build template body variables to match your approved template:
 * {{1}} Recipient name, {{2}} Event, {{3}} Date, {{4}} Time, {{5}} Assigned By, {{6}} Notes, {{7}} Event Link
 */
function getTemplateBodyValues(opts) {
  const { eventData, clientName, assignedByName, recipientName } = opts;
  const name = eventData.eventName || eventData.title || 'Event';
  return [
    recipientName || 'Team Member',                                    // {{1}}
    name,                                                              // {{2}}
    formatDateForTemplate(eventData.date),                            // {{3}} DD/MM/YYYY
    formatTimeForTemplate(eventData.time),                            // {{4}} e.g. 09:00 AM
    assignedByName || 'Admin',                                         // {{5}}
    eventData.notes && String(eventData.notes).trim() ? String(eventData.notes).trim() : '-',  // {{6}}
    eventData.link && String(eventData.link).trim() ? String(eventData.link).trim() : '-',     // {{7}}
  ];
}

function sendTemplate(toMobile, bodyValues, options = {}) {
  const templateName = options.templateName || INTERAKT_TEMPLATE_NAME;
  const languageCode = options.languageCode || INTERAKT_TEMPLATE_LANGUAGE;
  const fullPhoneNumber = normalizePhone(toMobile);
  const traits = options.traits || {};

  if (!INTERAKT_API_KEY) {
    console.warn('[Interakt] INTERAKT_API_KEY not set; skipping WhatsApp send');
    return Promise.resolve({ success: false, error: 'INTERAKT_API_KEY not set' });
  }
  if (!fullPhoneNumber) {
    console.warn('[Interakt] Invalid or missing phone number');
    return Promise.resolve({ success: false, error: 'Invalid phone number' });
  }

  // 1. Track user first (Interakt requires contact to exist before template send)
  return trackUser(fullPhoneNumber, traits)
    .then((trackResult) => {
      console.log('[Interakt] Sending template to', fullPhoneNumber.replace(/\d(?=\d{4})/g, '*'), '| template:', templateName, '| language:', languageCode);
      // 2. Send template – Interakt expects type "Template", nested template { name, languageCode, bodyValues }
      const payload = {
        fullPhoneNumber,
        type: 'Template',
        template: {
          name: templateName,
          languageCode: languageCode,
          bodyValues: Array.isArray(bodyValues) ? bodyValues : [],
        },
      };
      const body = JSON.stringify(payload);
      if (INTERAKT_DEBUG) console.log('[Interakt] Message request body:', body);

      return new Promise((resolve) => {
        const req = https.request(
          {
            hostname: INTERAKT_BASE_URL,
            path: INTERAKT_SEND_TEMPLATE_PATH,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${INTERAKT_API_KEY}`,
              'Content-Length': Buffer.byteLength(body),
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              let parsed;
              try {
                parsed = data ? JSON.parse(data) : {};
              } catch {
                parsed = { raw: data };
              }
              const ok = res.statusCode >= 200 && res.statusCode < 300;
              console.log('[Interakt] Message response:', res.statusCode, data || '(empty)');
              if (!ok) {
                console.warn('[Interakt] Template send FAILED. Common causes: template name/language mismatch, wrong body variable count, or phone format. Response above has the exact error.');
              }
              resolve(ok ? { success: true, response: parsed } : { success: false, response: parsed, error: data, statusCode: res.statusCode });
            });
          }
        );
        req.on('error', (err) => {
          console.warn('[Interakt] Template request error:', err.message);
          resolve({ success: false, error: err.message });
        });
        req.setTimeout(15000, () => {
          req.destroy();
          resolve({ success: false, error: 'Request timeout' });
        });
        req.write(body);
        req.end();
      });
    });
}

function sendEventAssignedTemplate(toMobile, recipientName, eventData, clientName, assignedByName, options = {}) {
  const bodyValues = getTemplateBodyValues({
    eventData,
    clientName,
    assignedByName,
    recipientName,
  });
  return sendTemplate(toMobile, bodyValues, {
    ...options,
    traits: { name: recipientName || 'Team Member', ...(options.traits || {}) },
  });
}

module.exports = {
  sendTemplate,
  sendEventAssignedTemplate,
  getTemplateBodyValues,
  normalizePhone,
};
