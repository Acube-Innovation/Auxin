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


router.post('/login', async (req, res) => {
  const { username, password } = req.body;


  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // Plain-text password check fallback if passwords are not hashed yet
    let passwordOk = false;
    if (user.password && user.password.startsWith('$2')) {
      passwordOk = await bcrypt.compare(password, user.password);
    } else {
      passwordOk = user.password === password;
    }
    if (!passwordOk) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '3h' }
    );

    console.log("Found user:", user);
    console.log("User username:", user.username);
    res.status(200).json({
      message: 'Login successful',
      token,
      user,
      username: user.username,

    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Helpers
function getUserIdFromReq(req) {
  try {
    if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded.id;
    }
  } catch (e) { }
  return req.body.userId || req.query.userId;
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
    res.json(user);
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

// Send OTP
router.post("/send-otp", async (req, res) => {
  const { emailId } = req.body;


  try {
    const user = await User.findOne({ emailId: emailId });
    if (!user) return res.status(404).json({ message: "User not found" });

    // const otp = crypto.randomInt(100000, 999999).toString();

    const otp = crypto.randomInt(1000, 10000).toString();

    otpStore[emailId] = otp;

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
    res.status(500).json({ message: "Error sending OTP", error: err.message });
  }
});

// Verify OTP
router.post("/verify-otp", (req, res) => {
  const { emailId, otp } = req.body;
  if (otpStore[emailId] && otpStore[emailId] === otp) {
    return res.json({ valid: true });
  }
  res.status(400).json({ valid: false, message: "Invalid OTP" });
});

// Reset Password
router.post("/reset-password", async (req, res) => {
  const { emailId, otp, newPassword } = req.body;
  try {
    if (!otpStore[emailId] || otpStore[emailId] !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    delete otpStore[emailId]; // clear otp after use

    // const hashed = await bcrypt.hash(newPassword, 10);

    await User.findOneAndUpdate({ emailId: emailId }, { password: newPassword });

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error resetting password", error: err.message });
  }
});

// ************************************ USER MANAGEMENT ROUTES (ADMIN ONLY) *****************************

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
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

    if (emailId && !/\S+@\S+\.\S+/.test(emailId)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Check if email already exists (if provided)
    if (emailId) {
      const existingEmail = await User.findOne({ emailId });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already exists' });
      }
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

    // Check email uniqueness if changed
    if (emailId && emailId !== user.emailId) {
      const existingEmail = await User.findOne({ emailId });
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