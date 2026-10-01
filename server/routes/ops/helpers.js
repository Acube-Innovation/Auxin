// Small helpers shared by the /api/ops routers.

// Copy only the allowed keys that are present in the body.
function pick(body, keys) {
  const out = {};
  for (const k of keys) {
    if (body && Object.prototype.hasOwnProperty.call(body, k)) out[k] = body[k];
  }
  return out;
}

// Turn Mongoose / Mongo errors into a 400 with a readable message; anything else is a 500.
function sendError(res, err, fallback = 'Something went wrong') {
  if (err && err.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'value';
    // Case-insensitive (collation) indexes report an internal sort key instead of the value
    const collated = /collation/i.test(err.message || '');
    const value = !collated && err.keyValue ? err.keyValue[field] : '';
    return res.status(400).json({ message: `A record with this ${field}${value ? ` "${value}"` : ''} already exists` });
  }
  if (err && err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((e) => {
        if (e.kind === 'required') return `${e.path} is required`;
        if (e.kind === 'enum') return `"${e.value}" is not an allowed value for ${e.path}`;
        return e.message;
      })
      .join('; ');
    return res.status(400).json({ message });
  }
  if (err && err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid ${err.path}: ${err.value}` });
  }
  if (err && err.status) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error(fallback, err);
  return res.status(500).json({ message: fallback, error: err?.message });
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { pick, sendError, escapeRegex, httpError };
