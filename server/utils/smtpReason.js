// Plain-language reason for a failed Gmail SMTP login or send (nodemailer error), for logs and scripts/checkLeaveEmail.js
function smtpReason(err) {
    if (!err) return '';
    const code = err.code || '';
    const text = `${err.responseCode || ''} ${err.response || err.message || ''}`;
    if (code === 'EAUTH' || /\b535\b|534|Username and Password not accepted|Application-specific password required/i.test(text)) {
        return 'Gmail refused EMAIL_USER / EMAIL_PASS: the Google password was changed, the App Password was removed, '
            + '2-Step Verification was turned off, or the address is no longer a Google account. Create a new App Password and put it in EMAIL_PASS.';
    }
    if (['ETIMEDOUT', 'ECONNREFUSED', 'ESOCKET', 'ECONNRESET', 'ECONNECTION'].includes(code)) {
        return 'The server cannot reach smtp.gmail.com on port 587 – outgoing mail is blocked by the hosting provider or firewall.';
    }
    if (code === 'EDNS' || code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
        return 'The server cannot look up smtp.gmail.com (DNS problem on the server).';
    }
    if (/\b550\b|\b552\b|\b554\b|limit|quota/i.test(text)) {
        return 'Gmail refused to send: the account has hit its daily sending limit or was blocked for sending.';
    }
    return `${code ? `${code}: ` : ''}${err.message || err}`;
}

module.exports = { smtpReason };
