// Test systems only: with EMAIL_ALLOW_ONLY=a@x.com,@mydomain.com in server/.env, every email the server
// sends (any nodemailer transport, wherever it is created) goes only to those addresses / domains; other
// recipients are dropped and logged. Without the setting this does nothing. Loaded first in server.js.
const nodemailer = require('nodemailer');

const allow = (process.env.EMAIL_ALLOW_ONLY || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

function allowed(addr) {
  const m = String(addr).match(/<([^>]+)>/);
  const a = (m ? m[1] : String(addr)).trim().toLowerCase();
  return allow.some((x) => (x.startsWith('@') ? a.endsWith(x) : a === x));
}

const list = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => (typeof x === 'object' && x ? x.address : x)).map((x) => String(x || '').trim()).filter(Boolean);

if (allow.length) {
  const create = nodemailer.createTransport.bind(nodemailer);
  nodemailer.createTransport = (...args) => {
    const t = create(...args);
    const send = t.sendMail.bind(t);
    t.sendMail = (msg, cb) => {
      const kept = {};
      const dropped = [];
      for (const f of ['to', 'cc', 'bcc']) {
        const all = list(msg[f]);
        kept[f] = all.filter(allowed);
        dropped.push(...all.filter((x) => !allowed(x)));
      }
      if (dropped.length) console.log(`📧 EMAIL_ALLOW_ONLY: not sent to ${dropped.join(', ')}`);
      if (!kept.to.length && !kept.cc.length && !kept.bcc.length) {
        const info = { skipped: true, reason: 'not in EMAIL_ALLOW_ONLY', accepted: [], rejected: dropped };
        if (cb) { cb(null, info); return undefined; }
        return Promise.resolve(info);
      }
      return send({ ...msg, to: kept.to.join(', ') || undefined, cc: kept.cc.join(', ') || undefined, bcc: kept.bcc.join(', ') || undefined }, cb);
    };
    return t;
  };
  console.log(`📧 EMAIL_ALLOW_ONLY is set: emails go only to ${allow.join(', ')}`);
}
