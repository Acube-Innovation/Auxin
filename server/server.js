const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const path = require('path');
const http = require('http');

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('=== ENVIRONMENT VARIABLES ===');
console.log('MONGO_URI:', process.env.MONGO_URI ? 'SET' : 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');
console.log('PORT:', process.env.PORT);
console.log('=== SERVER STARTING ===');

// Import Routes
const employeeRoutes = require('./routes/employeeRoutes');
const employeeDocumentRoutes = require('./routes/employeeDocumentRoutes');
const documentRoutes = require('./routes/documentRoutes');
const taskRoutes = require('./routes/taskRoutes');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const meetingsRoutes = require('./routes/meetings');
const attendanceRoutes = require('./routes/attendanceRoutes');
const supportRoutes = require('./routes/supportRoutes');
const leaveRequestRoutes = require('./routes/leaveRequestRoutes');
const salarySlipRoutes = require('./routes/salarySlipRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const roleRoutes = require('./routes/roleRoutes');
const departmentRoutes = require('./routes/departmentRoutes');


const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ====== SOCKET.IO CONFIGURATION ======
const { Server } = require("socket.io");
// allow configuring frontend origin from env (useful for live VPS deploys)
const FRONTEND_URL = (process.env.FRONTEND_URL || '').trim(); // set this to your live frontend origin (eg https://app.example.com)
let allowedOrigins = [
  "https://auxin-mern-app-front.onrender.com",
  "http://72.60.202.115:5000",
  "https://auxincrm.cloud",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];
if (FRONTEND_URL && !allowedOrigins.includes(FRONTEND_URL)) {
  allowedOrigins.unshift(FRONTEND_URL);
}
const ALLOW_ALL = process.env.ALLOW_ALL_ORIGINS === 'true';
function isOriginAllowed(origin) {
  if (!origin || origin === 'null') return true;
  if (ALLOW_ALL) return true;
  const port = String(process.env.PORT || '5000');
  if (port === '5000') return true;
  if (process.env.NODE_ENV !== 'production') return true;
  if (allowedOrigins.indexOf(origin) !== -1) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  if (/^https?:\/\/\[::1\](:\d+)?$/i.test(origin)) return true;
  return false;
}
console.log('Socket allowed origins:', allowedOrigins, 'ALLOW_ALL:', ALLOW_ALL);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        console.warn('Socket.io blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// add near top of file (after io created) to require Notification model
const Notification = require('./models/Notification');
const User = require('./models/User');

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  // Store user information in socket for later use
  let currentUserId = null;
  let currentUserRole = null;

  // Enhanced user join with role information
  socket.on('join-user', async (userData) => {
    try {
      // Handle both object format and simple userId format for backward compatibility
      if (typeof userData === 'object' && userData !== null) {
        const userId = userData.userId;
        const role = userData.role;
        currentUserId = userId;
        currentUserRole = role;
        if (userId) socket.join(`user-${userId}`);
        if (role) socket.join(`role-${role}`); // Join role-based room for targeted notifications
        console.log(`User ${userId} (${role}) joined rooms: user-${userId}, role-${role}`);
      } else {
        // Legacy format - just userId as string
        currentUserId = userData;
        if (userData) socket.join(`user-${userData}`);
        console.log(`User ${userData} joined room: user-${userData}`);
      }

      // Send confirmation to client
      socket.emit('join-confirmation', { success: true, userId: currentUserId, role: currentUserRole });

      // Deliver pending notifications for this user (by userId or role)
      try {
        if (currentUserId) {
          // find notifications where target is this user OR role matches user's role, and this user has NOT yet been delivered
          const pending = await Notification.find({
            $or: [
              { userId: currentUserId },
              { role: currentUserRole }
            ],
            deliveredTo: { $ne: currentUserId }
          }).sort({ createdAt: 1 }).lean();

          for (const n of pending) {
            // emit to this socket
            socket.emit('notification', n.payload || {
              id: n._id.toString(),
              title: n.title,
              body: n.body,
              meta: n.payload
            });
            // mark deliveredTo
            await Notification.updateOne({ _id: n._id }, { $addToSet: { deliveredTo: currentUserId } });
          }
        }
      } catch (deliverErr) {
        console.error('Error delivering pending notifications on join-user:', deliverErr);
      }
    } catch (error) {
      console.error('Error in join-user event:', error);
      socket.emit('join-confirmation', { success: false, error: error.message });
    }
  });

  // Join by email (clients will emit their email after fetching /api/auth/me)
  socket.on('join-email', async (email) => {
    try {
      if (email && typeof email === 'string') {
        socket.join(`email-${email}`);
        console.log(`Socket ${socket.id} joined email room: email-${email}`);
        socket.emit('join-confirmation', { success: true, email });

        // Deliver pending notifications targeted by email (if we have a linked userId attempt to mark delivered)
        try {
          // Try to resolve user by email to mark deliveredTo if possible
          const user = await User.findOne({ emailId: email }).lean();
          const userId = user?._id ? String(user._id) : currentUserId || null;
          const pending = await Notification.find({
            email: email,
            deliveredTo: { $ne: userId }
          }).sort({ createdAt: 1 }).lean();

          for (const n of pending) {
            socket.emit('notification', n.payload || {
              id: n._id.toString(),
              title: n.title,
              body: n.body,
              meta: n.payload
            });
            if (userId) {
              await Notification.updateOne({ _id: n._id }, { $addToSet: { deliveredTo: userId } });
            }
          }
        } catch (emailDeliverErr) {
          console.error('Error delivering pending notifications on join-email:', emailDeliverErr);
        }
      }
    } catch (err) {
      console.error('Error in join-email:', err);
      socket.emit('join-confirmation', { success: false, error: err.message });
    }
  });

  socket.on('join-task', (taskId) => {
    socket.join(`task-${taskId}`);
    console.log(`Socket ${socket.id} joined task room: task-${taskId}`);
  });

  socket.on('join-client', (clientId) => {
    socket.join(`client-${clientId}`);
    console.log(`Socket ${socket.id} joined client room: client-${clientId}`);
  });

  // Vessel Operations: live refresh of an open voyage workspace
  socket.on('join-voyage', (voyageId) => {
    if (!voyageId) return;
    socket.join(`voyage-${voyageId}`);
    console.log(`Socket ${socket.id} joined voyage room: voyage-${voyageId}`);
  });

  socket.on('leave-voyage', (voyageId) => {
    if (!voyageId) return;
    socket.leave(`voyage-${voyageId}`);
  });

  // Allow client to check connection status
  socket.on('ping', (callback) => {
    if (typeof callback === 'function') {
      callback({
        status: 'connected',
        socketId: socket.id,
        userId: currentUserId,
        role: currentUserRole
      });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ Socket disconnected: ${socket.id}, User: ${currentUserId}, Role: ${currentUserRole}, Reason: ${reason}`);
  });
});

// Expose io to routes via app
app.set('io', io);

// ====== CORS CONFIG ======
// Echo the request Origin explicitly (cb(null, true) can reflect the wrong origin with credentials).
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === 'null') {
      return cb(null, true);
    }
    if (isOriginAllowed(origin)) {
      return cb(null, origin);
    }
    console.warn('HTTP CORS blocked origin:', origin);
    return cb(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ====== MIDDLEWARE ======
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ====== HEALTH CHECK (no DB, so server can respond even if DB is slow) ======
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Server is running' });
});

// ====== API ROUTES ======
// Client remarks: explicit routes registered first so POST/GET always match
const authMiddleware = require('./middleware/authMiddleware');
const ClientRemark = require('./models/ClientRemark');
const Client = require('./models/Client');

app.get('/api/client-remarks/:clientId', authMiddleware, async (req, res) => {
  try {
    const remarks = await ClientRemark.find({ clientId: req.params.clientId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(remarks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching remarks', error: error.message });
  }
});

app.post('/api/client-remarks/:clientId', authMiddleware, async (req, res) => {
  try {
    const text = (req.body?.remark != null ? String(req.body.remark) : req.body?.text != null ? String(req.body.text) : '').trim();
    if (!text) {
      return res.status(400).json({ message: 'Remark text cannot be empty' });
    }
    const client = await Client.findById(req.params.clientId);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    const user = await User.findById(req.user._id);
    const remark = new ClientRemark({
      clientId: req.params.clientId,
      text,
      createdBy: {
        userId: req.user._id,
        username: (user && user.username) || req.user.username || 'Unknown',
        role: (user && user.role) || req.user.role || ''
      }
    });
    await remark.save();
    res.status(201).json(remark);
  } catch (error) {
    res.status(500).json({ message: 'Error adding remark', error: error.message });
  }
});

app.use('/api/salary-slips', salarySlipRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/employeedocuments', employeeDocumentRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api', taskRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/checkins', require('./routes/checkInRoutes'));
app.use('/api/attendance', attendanceRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/leave-requests', leaveRequestRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/departments', departmentRoutes);

app.use('/api/ops', require('./routes/ops'));

// ====== DATABASE CONNECTION ======
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    require('./jobs/ops/scheduler').start(io); // Vessel Operations reminders, digest, escalation, daily checks
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ====== SERVE FRONTEND ======
const frontendPath = path.join(__dirname, '../frontend/build');
app.use(express.static(frontendPath));

// ====== REACT ROUTES CONFIG ======
// Unknown API paths return JSON 404 instead of the React page
app.use('/api', (req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Every other GET is a React route: serve index.html so a page refresh works on any URL
// (Express 5 wildcard syntax). Missing files under /uploads still return 404.
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/uploads/')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ====== START SERVER ======
// HOST=127.0.0.1 keeps a test copy reachable only from the server itself
server.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.io is enabled and listening for connections`);
});

module.exports = { app, server, io };