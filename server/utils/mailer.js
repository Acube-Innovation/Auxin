const nodemailer = require('nodemailer');

let transporter = null;
let warnedMissingConfig = false;

function isConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
}

// Sends one email. Resolves to { skipped: true } when EMAIL_USER / EMAIL_PASS are not set,
// so callers running without email (e.g. local development) do not fail.
async function sendMail({ to, subject, html, text, attachments, fromName = 'Auxin Task Manager' }) {
  if (!isConfigured()) {
    if (!warnedMissingConfig) {
      console.warn('📧 Email not configured (EMAIL_USER / EMAIL_PASS missing) – emails are skipped');
      warnedMissingConfig = true;
    }
    return { skipped: true };
  }
  if (!to) {
    return { skipped: true, reason: 'no recipient' };
  }
  return getTransporter().sendMail({
    from: `"${fromName}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    text,
    attachments,
  });
}

// Sends the same email to several recipients in parallel; never throws.
async function sendMailToMany(recipients, message) {
  const unique = [...new Set((recipients || []).filter(Boolean))];
  const results = await Promise.allSettled(unique.map((to) => sendMail({ ...message, to })));
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Failed to send email to ${unique[i]}:`, result.reason?.message || result.reason);
    }
  });
  return results;
}

module.exports = { sendMail, sendMailToMany, isConfigured };
