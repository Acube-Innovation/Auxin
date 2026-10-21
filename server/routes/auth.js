const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require('../models/User'); // your Mongoose model
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const Notification = require('../models/Notification');


let otpStore = {}; // TEMP store (better use Redis or DB)


// Login with the email address of the login (User.emailId, any letter case) and password
// Exact email match, ignoring letter case and surrounding spaces
const sameEmail = (email) => new RegExp(`^\\s*${String(email).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
const looksLikeEmail = (s) => /^\S+@\S+\.\S+$/.test(String(s || '').trim());

/**
 * The login(s) that an email address opens: logins with that User.emailId, otherwise the login linked
 * (User.employeeId) to the employee record with that email – logins made before the email was required.
 * Returns { users (at most 2), viaEmployee }.
 */
async function loginsByEmail(email) {
  const users = await User.find({ emailId: sameEmail(email) }).limit(2);
  if (users.length) return { users, viaEmployee: false };
  const Employee = require('../models/Employee');
  const employee = await Employee.findOne({ emailId: sameEmail(email) }).select('_id').lean();
  if (!employee) return { users: [], viaEmployee: false };
  return { users: await User.find({ employeeId: employee._id }).limit(2), viaEmployee: true };
}

// A login found through its employee record and with no email of its own gets that email,
// so that Forgot Password and email notifications work for it from now on
async function saveEmailOnLogin(user, email) {
  if (String(user.emailId || '').trim()) return;
  if (await User.exists({ _id: { $ne: user._id }, emailId: sameEmail(email) })) return;
  await User.updateOne({ _id: user._id }, { $set: { emailId: email } });
  user.emailId = email;
  console.log(`Email ${email} saved on login ${user.username} (taken from the employee record)`);
}

router.post('/login', async (req, res) => {
  const body = req.body || {};
  const email = String(body.email != null ? body.email : body.emailId != null ? body.emailId : '').trim();
  const password = body.password != null ? String(body.password) : '';
  const username = email; // used in the log lines below

  console.log('Login attempt for email:', email);

  try {
    if (!email && !password) {
      return res.status(400).json({ message: 'Enter your email address and password.' });
    }
    if (!email) {
      return res.status(400).json({ message: 'Enter your email address.' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Enter your password.' });
    }

    if (!looksLikeEmail(email)) {
      // Most often a username, which was accepted before login moved to email
      const byName = await User.findOne({ username: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).select('emailId').lean();
      console.log('Login with something that is not an email:', email, byName ? '(a username)' : '');
      if (byName && !String(byName.emailId || '').trim()) {
        return res.status(400).json({ message: 'Login is now by email address, and your login has no email address yet. Please ask Admin to add your email in User Management.' });
      }
      if (byName) {
        return res.status(400).json({ message: 'Login is now by email address, not username. Enter the email address of your login (for example name@company.com).' });
      }
      return res.status(400).json({ message: `"${email}" is not an email address. Enter your email address, for example name@company.com.` });
    }

    const { users: matches, viaEmployee } = await loginsByEmail(email);
    if (matches.length > 1) {
      console.log('Email used by more than one login:', email);
      return res.status(409).json({ message: 'This email address belongs to more than one login. Please ask Admin to correct it in User Management.' });
    }
    const user = matches[0];
    if (!user) {
      console.log('No login with email:', email);
      return res.status(401).json({ message: `No login found for ${email}. Check the spelling, or ask Admin which email address is set on your login.` });
    }

    console.log('User found, checking password...');
    
    const passwordTrimmed = password.trim();
    let passwordOk = false;
    try {
      if (user.password && String(user.password).startsWith('$2')) {
        passwordOk = await bcrypt.compare(passwordTrimmed, user.password);
      } else {
        passwordOk = String(user.password) === passwordTrimmed;
      }
      console.log('Password check result:', passwordOk);
    } catch (bcryptError) {
      console.error('Bcrypt error:', bcryptError);
      return res.status(500).json({ message: 'Server error while checking the password. Please try again.' });
    }

    if (!passwordOk) {
      console.log('Password incorrect for user:', username);
      return res.status(401).json({ message: 'Incorrect password. Try again, or use Forgot Password to set a new one.' });
    }

    if (viaEmployee) await saveEmailOnLogin(user, email);

    console.log('Password correct, generating token...');

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not set');
      return res.status(500).json({ message: 'Login is not available: the server is not set up correctly. Please contact Admin.' });
    }

    const token = jwt.sign(
      { id: String(user._id), username: user.username, emailId: user.emailId || "" },
      process.env.JWT_SECRET,
      { expiresIn: '3h' }
    );

    console.log("Login successful for user:", user.username);

    const userResponse = {
      _id: String(user._id),
      username: String(user.username || ''),
      emailId: String(user.emailId || ''),
      phoneNumber: String(user.phoneNumber || ''),
      role: String(user.role || ''),
      employeeId: user.employeeId ? String(user.employeeId) : null,
      leaveBalance: typeof user.leaveBalance === 'number' ? user.leaveBalance : 21,
      profilePicture: user.profilePicture != null ? String(user.profilePicture) : null,
      createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
      updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : undefined,
    };

    res.status(200).json({
      message: 'Login successful',
      token,
      user: userResponse,
      username: userResponse.username,
    });
  } catch (error) {
    console.error('Login error:', error);
    try {
      res.status(500).json({ message: 'Server error while logging in. Please try again in a moment.' });
    } catch (e) {
      console.error('Failed to send error response:', e);
    }
  }
});

// Helpers - Bulletproof version
function getUserIdFromReq(req) {
  if (!req) return null;
  try {
    const authHeader = (req.headers && req.headers.authorization);
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token === 'null' || token === 'undefined') return null;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded ? String(decoded.id) : null;
    }
  } catch (e) { }

  const body = req.body || {};
  const query = req.query || {};
  const userId = body.userId || query.userId;
  return userId ? String(userId) : null;
}

// Storage for profile pictures
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// Get current user
router.get('/me', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Calculate leave balance dynamically based on monthly accrual
    const LeaveRequest = require('../models/LeaveRequest');
    // Note: calcWorkingDays is defined locally below

    // Official Holidays for 2026
    const OFFICIAL_HOLIDAYS_2026 = new Set([
      '2026-01-01', '2026-01-26', '2026-02-19', '2026-03-03', '2026-03-19',
      '2026-03-21', '2026-04-26', '2026-04-03', '2026-04-14', '2026-05-01',
      '2026-06-26', '2026-08-15', '2026-08-26', '2026-08-28', '2026-09-14',
      '2026-10-02', '2026-10-20', '2026-11-06', '2026-11-10', '2026-11-11',
      '2026-11-24', '2026-12-25'
    ]);

    // Helper function to calculate working days
    const calcWorkingDays = (startDate, endDate) => {
      let workingDays = 0;
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      const currentDate = new Date(start);
      while (currentDate <= end) {
        const day = currentDate.getDay();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dayOfMonth = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayOfMonth}`;

        if (day !== 0 && day !== 6 && !OFFICIAL_HOLIDAYS_2026.has(dateStr)) {
          workingDays++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return workingDays;
    };

    // Get current date and determine financial year (April - March)
    const now = new Date();
    const currentMonth = now.getMonth(); // 0 = Jan, 3 = April
    const currentYear = now.getFullYear();

    // Financial year starts in April (month index 3)
    // If current month is Jan-Mar (0-2), FY started previous year
    // If current month is Apr-Dec (3-11), FY started this year
    let fyStartYear, fyStartDate, fyEndDate;
    if (currentMonth < 3) {
      // Jan-Mar: FY is previous year's April to this year's March
      fyStartYear = currentYear - 1;
    } else {
      // Apr-Dec: FY is this year's April to next year's March
      fyStartYear = currentYear;
    }
    fyStartDate = new Date(fyStartYear, 3, 1); // April 1
    fyEndDate = new Date(fyStartYear + 1, 2, 31); // March 31

    // Calculate months completed in the current financial year
    // From April to current month (inclusive)
    let monthsCompleted;
    if (currentMonth >= 3) {
      // Apr-Dec: months from April (index 3) to current month
      monthsCompleted = currentMonth - 3 + 1; // +1 to include current month
    } else {
      // Jan-Mar: 9 months (Apr-Dec) + months in current year
      monthsCompleted = 9 + currentMonth + 1; // +1 to include current month
    }

    // Monthly accrual rate as per policy: 1.75 days per month
    // User requested YEAR WISE calculation so we give full annual credit upfront
    const entitlement = 21;

    // Get all approved and pending leave requests for this user in the current financial year
    const approvedLeaves = await LeaveRequest.find({
      employee: userId,
      status: { $in: ['Approved', 'Pending', 'HOD Approved'] },
      startDate: { $gte: fyStartDate, $lte: fyEndDate }
    });

    // Calculate total working days taken
    let leaveDaysTaken = 0;
    for (const leave of approvedLeaves) {
      leaveDaysTaken += calcWorkingDays(leave.startDate, leave.endDate);
    }

    // Calculate leave balance: entitlement - days taken
    const calculatedLeaveBalance = Math.max(0, parseFloat((entitlement - leaveDaysTaken).toFixed(2)));

    // Check if admin/HOD has set a manual override for this employee's balance
    const Employee = require('../models/Employee');
    let finalLeaveBalance = calculatedLeaveBalance;
    let hasOverride = false;
    let employeeRecord = null;

    // Try matching by emailId first (most reliable when set)
    if (user.emailId && user.emailId.trim()) {
      const escapedEmail = user.emailId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      employeeRecord = await Employee.findOne({ emailId: new RegExp(`^${escapedEmail}$`, 'i') })
        .select('leaveOverride').lean();
    }

    // Fallback: match by User.employeeId (ObjectId reference to Employee._id)
    if (!employeeRecord && user.employeeId) {
      employeeRecord = await Employee.findById(user.employeeId)
        .select('leaveOverride').lean();
    }

    if (employeeRecord && employeeRecord.leaveOverride && employeeRecord.leaveOverride.balance !== null && employeeRecord.leaveOverride.balance !== undefined) {
      finalLeaveBalance = employeeRecord.leaveOverride.balance;
      hasOverride = true;
    }

    // Return user with calculated leave balance
    const userResponse = user.toObject();
    userResponse.leaveBalance = finalLeaveBalance;
    userResponse.leaveEntitlement = parseFloat(entitlement.toFixed(2));
    userResponse.leaveDaysTaken = leaveDaysTaken;
    userResponse.monthsCompleted = monthsCompleted;
    userResponse.leaveBalanceOverridden = hasOverride;

    res.json(userResponse);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Update current user basic fields (username, phoneNumber) and password
router.put('/me', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const { username, phoneNumber, newPassword, emailId, profilePicture } = req.body;
    const update = {};
    if (username) update.username = username;
    if (phoneNumber !== undefined) update.phoneNumber = phoneNumber;
    if (emailId !== undefined) update.emailId = emailId;
    if (profilePicture !== undefined) update.profilePicture = profilePicture; // allow null to remove
    if (newPassword) {
      // Hash new password
      if (process.env.HASH_PASSWORDS === 'true') {
        update.password = await bcrypt.hash(newPassword, 10);
      } else {
        update.password = newPassword; // fallback if hashing disabled
      }
    }
    const user = await User.findByIdAndUpdate(userId, update, { new: true }).select('-password');
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Upload/update profile picture
router.post('/me/profile-picture', upload.single('profilePicture'), async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const relativePath = `/uploads/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(userId, { profilePicture: relativePath }, { new: true }).select('-password');
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// ************************************ OTP RELATED THINGS *****************************

// OTPs are kept per login, under the email in lower case
const otpKey = (emailId) => String(emailId || '').trim().toLowerCase();

// Send OTP
router.post("/send-otp", async (req, res) => {
  const emailId = String((req.body || {}).emailId || '').trim();

  try {
    if (!emailId) return res.status(400).json({ message: "Enter your email address." });
    if (!looksLikeEmail(emailId)) {
      return res.status(400).json({ message: `"${emailId}" is not an email address. Enter your email address, for example name@company.com.` });
    }
    const { users } = await loginsByEmail(emailId);
    if (users.length > 1) {
      return res.status(409).json({ message: "This email address belongs to more than one login. Please ask Admin to correct it in User Management." });
    }
    const user = users[0];
    if (!user) {
      return res.status(404).json({ message: `No login found for ${emailId}. Check the spelling, or ask Admin which email address is set on your login.` });
    }
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(503).json({ message: "The OTP email cannot be sent because email is not set up on the server. Please ask Admin to reset your password." });
    }

    // const otp = crypto.randomInt(100000, 999999).toString();

    const otp = crypto.randomInt(1000, 10000).toString();

    otpStore[otpKey(emailId)] = { otp, userId: String(user._id) };

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Your Gmail
        pass: process.env.EMAIL_PASS, // App password (not normal password)
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: emailId,
      subject: "Your OTP Code",
      text: `Your OTP is ${otp}`,
    });

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error('Send OTP failed:', err.message);
    res.status(500).json({ message: "The OTP email could not be sent. Please try again in a moment, or ask Admin to reset your password.", error: err.message });
  }
});

// Verify OTP
router.post("/verify-otp", (req, res) => {
  const { emailId, otp } = req.body;
  const stored = otpStore[otpKey(emailId)];
  if (stored && stored.otp === String(otp || '').trim()) {
    return res.json({ valid: true });
  }
  res.status(400).json({ valid: false, message: stored ? "The OTP is incorrect. Check the code in the email and try again." : "No OTP was sent to this email, or it was already used. Please request a new OTP." });
});

// Reset Password
router.post("/reset-password", async (req, res) => {
  const { emailId, otp, newPassword } = req.body;
  try {
    const stored = otpStore[otpKey(emailId)];
    if (!stored || stored.otp !== String(otp || '').trim()) {
      return res.status(400).json({ message: stored ? "The OTP is incorrect. Check the code in the email and try again." : "No OTP was sent to this email, or it was already used. Please request a new OTP." });
    }
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ message: "The new password must be at least 6 characters long." });
    }

    delete otpStore[otpKey(emailId)]; // clear otp after use

    const password = process.env.HASH_PASSWORDS === 'true' ? await bcrypt.hash(String(newPassword), 10) : String(newPassword);
    await User.updateOne({ _id: stored.userId }, { $set: { password } });

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "The password could not be changed because of a server error. Please try again.", error: err.message });
  }
});

// ************************************ USER MANAGEMENT ROUTES (ADMIN ONLY) *****************************

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findById(userId);
    if (!user || (user.role !== 'admin' && user.role !== 'hod')) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.user = user;
    next();
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Get all users (Admin only)
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Create new user (Admin only)
router.post('/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, emailId, phoneNumber, role, employeeId } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Email is required: it is what the person logs in with
    if (!emailId || !String(emailId).trim()) {
      return res.status(400).json({ message: 'Email is required (it is used to log in)' });
    }
    if (!/\S+@\S+\.\S+/.test(emailId)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Check if email already exists (any letter case)
    if (await User.findOne({ emailId: sameEmail(emailId) })) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash password if hashing is enabled
    let hashedPassword = password;
    if (process.env.HASH_PASSWORDS === 'true') {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const user = new User({
      username,
      password: hashedPassword,
      emailId: emailId || '',
      phoneNumber: phoneNumber || '',
      role: role || 'sales_executive',
      employeeId: employeeId || null
    });

    await user.save();

    // Send welcome email with credentials (plain password as requested)
    if (user.emailId) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });
        const mailHtml = `
          <div style="font-family: Arial, sans-serif; padding:20px;">
            <h2>Welcome to Auxin</h2>
            <p>Your account has been created by an administrator.</p>
            <p><strong>Username:</strong> ${username}</p>
            <p><strong>Password:</strong> ${password}</p>
            <p>Please login at <a href="${process.env.FRONTEND_URL || 'https://your-app.example.com'}">the website</a> and change your password after first login.</p>
          </div>
        `;
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.emailId,
          subject: 'Your new account details',
          html: mailHtml
        });
        console.log(`Sent new-user email to ${user.emailId}`);
      } catch (mailErr) {
        console.error('Failed to send new-user email:', mailErr);
      }
    }

    // Emit browser notification and persist it so user receives it in-app or on next login
    try {
      const io = req.app.get('io');
      const payload = {
        id: `user-created-${user._id}-${Date.now()}`,
        type: 'user-created',
        title: 'Your account has been created',
        body: `Username: ${username}. Use the provided password to login.`,
        meta: { userId: user._id, username, emailId: user.emailId },
        timestamp: new Date()
      };
      if (io) {
        // Emit to email room and user-id room (user likely not connected yet)
        if (user.emailId) io.to(`email-${user.emailId}`).emit('notification', payload);
        io.to(`user-${user._id}`).emit('notification', payload);
      }
      await Notification.create({ title: payload.title, body: payload.body, payload, userId: user._id, email: user.emailId });
    } catch (notifErr) {
      console.error('Failed to emit/persist new-user notification:', notifErr);
    }

    // Return user without password
    const userResponse = await User.findById(user._id).select('-password');
    res.status(201).json(userResponse);
  } catch (e) {
    if (e.code === 11000) {
      res.status(400).json({ message: 'Username or email already exists' });
    } else {
      res.status(500).json({ message: e.message });
    }
  }
});

// Update user (Admin only)
router.put('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, password, emailId, phoneNumber, role, employeeId } = req.body;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check username uniqueness if changed
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      user.username = username;
    }

    // Email is required (used to log in) and must not belong to another login
    if (!String(emailId || user.emailId || '').trim()) {
      return res.status(400).json({ message: 'Email is required (it is used to log in)' });
    }
    if (emailId && !/\S+@\S+\.\S+/.test(emailId)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    if (emailId && emailId !== user.emailId) {
      const existingEmail = await User.findOne({ _id: { $ne: user._id }, emailId: sameEmail(emailId) });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      user.emailId = emailId;
    }

    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (role) user.role = role;
    if (employeeId !== undefined) user.employeeId = employeeId;

    let passwordUpdated = false;
    // Update password if provided
    if (password && password.trim() !== '') {
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }
      if (process.env.HASH_PASSWORDS === 'true') {
        user.password = await bcrypt.hash(password, 10);
      } else {
        user.password = password;
      }
      passwordUpdated = true;
    }

    await user.save();

    // Send email with updated credentials if password was changed or if it's a general update demand
    // The user requested: "after update updated credential goes to email that email id"
    // We will send email if password is updated OR if other critical info changed, but primarily for credentials.
    // If password is NOT updated, we should probably not send it in plain text if it's hashed. 
    // However, the request implies sending credentials. If we don't have the plain password (because it was not updated), we cannot send it if it's hashed.
    // So we will only send the email if the password was updated OR if we are using plain text passwords.

    if (user.emailId && passwordUpdated) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });

        const mailHtml = `
            <div style="font-family: Arial, sans-serif; padding:20px;">
              <h2>Account Details Updated</h2>
              <p>Your account details have been updated by an administrator.</p>
              <p><strong>Username:</strong> ${user.username}</p>
              <p><strong>New Password:</strong> ${password}</p> 
              <p>Please login at <a href="${process.env.FRONTEND_URL || 'https://your-app.example.com'}">the website</a>.</p>
            </div>
          `;

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.emailId,
          subject: 'Your account details have been updated',
          html: mailHtml
        });
        console.log(`Sent update email to ${user.emailId}`);
      } catch (mailErr) {
        console.error('Failed to send update email:', mailErr);
      }
    }


    // Return user without password
    const updatedUser = await User.findById(userId).select('-password');
    res.json(updatedUser);
  } catch (e) {
    if (e.code === 11000) {
      res.status(400).json({ message: 'Username or email already exists' });
    } else {
      res.status(500).json({ message: e.message });
    }
  }
});

// Delete user (Admin only)
router.delete('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent admin from deleting themselves
    const currentUserId = getUserIdFromReq(req);
    if (userId === currentUserId) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;