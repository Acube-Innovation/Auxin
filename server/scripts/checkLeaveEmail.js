// Check of the leave emails: the email settings, a Gmail login with them, and who is emailed for each person's
// new leave request. Changes nothing. With --send ADDRESS it also sends one test email to that address.
// Usage (in the server folder): node scripts/checkLeaveEmail.js [--send name@company.com]
require('dotenv').config();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const LeaveApprover = require('../models/LeaveApprover');
const { present } = require('../utils/leaveApproverView');
const { smtpReason } = require('../utils/smtpReason');

const sendTo = process.argv.includes('--send') ? process.argv[process.argv.indexOf('--send') + 1] : null;
const mask = (e) => String(e).replace(/^(.).*?@/, '$1***@');
const emailOf = (u) => (u && u.emailId && String(u.emailId).trim()) || '';

(async () => {
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = process.env.EMAIL_PASS || '';
  console.log('1. Email settings (server/.env)');
  console.log(`   EMAIL_USER: ${user ? mask(user) : 'NOT SET'}`);
  console.log(`   EMAIL_PASS: ${pass ? `set (${pass.replace(/\s/g, '').length} characters; a Gmail App Password has 16)` : 'NOT SET'}`);
  console.log('   Sent through: smtp.gmail.com port 587 (Gmail / Google Workspace)');
  if (!user || !pass) {
    console.log('   ✗ Leave emails are switched off: set EMAIL_USER and EMAIL_PASS, then restart the backend.');
  } else {
    if (!/@(gmail|googlemail)\.com$/i.test(user)) {
      console.log(`   ! ${user.split('@')[1]} is not gmail.com: it works only while that domain's mail is on Google Workspace.`);
    }
    const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user, pass }, tls: { rejectUnauthorized: false } });
    console.log('\n2. Gmail login with these settings');
    try {
      await transporter.verify();
      console.log('   ✓ Gmail accepted the login.');
      if (sendTo) {
        const info = await transporter.sendMail({ from: `"Auxin Leave" <${user}>`, to: sendTo, subject: 'Auxin CRM – leave email test', text: 'Test email from the Auxin CRM server (scripts/checkLeaveEmail.js).' });
        console.log(`   ✓ Test email accepted by Gmail for ${sendTo} (${info.response}). If it does not arrive, check Junk / Quarantine of that mailbox.`);
      }
    } catch (e) {
      console.log(`   ✗ ${smtpReason(e)}`);
      console.log(`     (${e.code || ''} ${e.response || e.message})`);
    }
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('\n3. Who is emailed when someone applies for leave (their HOD, or HR when no HOD; and every Admin login)');
  const admins = await User.find({ role: 'admin' }).select('username emailId').lean();
  admins.forEach((a) => console.log(`   Admin ${a.username}: ${emailOf(a) || 'NO EMAIL – gets no leave emails'}`));
  const rows = (await present(await LeaveApprover.find().lean())).sort((a, b) => a.name.localeCompare(b.name));
  for (const r of rows) {
    const first = r.hod || r.hr;
    console.log(`   ${r.name}: ${first ? `${r.hod ? 'HOD' : 'HR'} ${first.username} <${emailOf(first) || 'NO EMAIL'}>` : 'no HOD or HR – Admin only'}`
      + `; after HOD approval: ${r.hr ? `HR ${r.hr.username} <${emailOf(r.hr) || 'NO EMAIL'}>` : 'Admin only'}`);
  }
  console.log('\nThe backend log shows each email: "[Leave] Sent new leave request to …" or "[Leave] Failed to send … – <reason>".');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
