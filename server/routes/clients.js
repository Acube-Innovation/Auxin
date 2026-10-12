const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const ClientRemark = require('../models/ClientRemark');
const Employee = require('../models/Employee');
const Notification = require('../models/Notification');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { clientUsage } = require('../services/ops/references');
const multer = require('multer');
const path = require('path');
const nodemailer = require("nodemailer");
const { sendEventAssignedTemplate } = require('../services/interaktWhatsAppService');

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/clients'); // save inside /uploads/clients
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // unique filename
  }
});

// File filter (optional, only images allowed)
const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files allowed'), false);
  }
};

const FOLLOWUP_STATUS_ENUM = [
  'Contacted', 'Needs Analysis', 'Demo Scheduled', 'Proposal Sent',
  'Completed', 'Pending', 'Progress', 'Won', 'Lost',
];

/** Empty or invalid followupStatus breaks Mongoose enum; coerce to Pending (matches Client schema default). */
function normalizeFollowupStatusOnPayload(payload) {
  if (!payload || typeof payload !== 'object') return;
  if (!Object.prototype.hasOwnProperty.call(payload, 'followupStatus')) return;
  const s = payload.followupStatus == null ? '' : String(payload.followupStatus).trim();
  if (s === '' || !FOLLOWUP_STATUS_ENUM.includes(s)) {
    payload.followupStatus = 'Pending';
  }
}

// ?? Background email sender (non-blocking)
async function sendEventEmailsInBackground(eventData, assignedBy, client, actionType = 'created') {
  try {
    console.log(`?? Starting email background process for ${actionType}...`);

    // Collect recipients from event data
    const recipients = [];

    // Add client email if available
    if (client.email) {
      recipients.push(client.email);
      console.log(`?? Added client email: ${client.email}`);
    }

    // Add assigned team members
    if (Array.isArray(eventData.assignedTeamMembers) && eventData.assignedTeamMembers.length > 0) {
      console.log(`?? Processing ${eventData.assignedTeamMembers.length} team members`);

      for (const memberId of eventData.assignedTeamMembers) {
        try {
          const member = await Employee.findById(memberId);
          if (member?.emailId) {
            recipients.push(member.emailId);
            console.log(`?? Added team member email: ${member.emailId}`);
          }
        } catch (memberError) {
          console.error(`Error finding employee ${memberId}:`, memberError);
        }
      }
    }

    const uniqueRecipients = [...new Set(recipients)];
    console.log(`?? Final recipient list:`, uniqueRecipients);

    // Send emails in parallel for better performance
    if (uniqueRecipients.length > 0) {
      const emailResults = await Promise.allSettled(
        uniqueRecipients.map(email =>
          sendClientEventEmail(email, eventData, assignedBy, client.clientName || client.companyName, actionType)
        )
      );

      // Log email results
      emailResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`? Email sent to: ${uniqueRecipients[index]}`);
        } else {
          console.error(`? Failed to send email to ${uniqueRecipients[index]}:`, result.reason);
        }
      });
    } else {
      console.log("?? No recipients found for email notification");
    }
  } catch (emailError) {
    console.error("? Background email error:", emailError);
  }
}

// Send WhatsApp template to each assigned team member (one message per member).
async function sendEventWhatsAppInBackground(eventData, assignedBy, client) {
  const assignedUserIds = Array.isArray(eventData.assignedTeamMembers) ? eventData.assignedTeamMembers : [];
  if (assignedUserIds.length === 0) return;
  const clientName = client.clientName || client.companyName || 'Client';
  try {
    for (const userId of assignedUserIds) {
      try {
        const member = await Employee.findById(userId);
        if (!member) {
          console.warn('[WhatsApp] Skipped – no employee found for id:', userId);
          continue;
        }
        if (!member.mobile) {
          console.warn('[WhatsApp] Skipped – no mobile for', member.employeeName, '(id:', userId, ')');
          continue;
        }
        const result = await sendEventAssignedTemplate(
          member.mobile,
          member.employeeName || 'Team Member',
          eventData,
          clientName,
          assignedBy
        );
        if (result.success) {
          console.log(`[WhatsApp] Event template sent to ${member.employeeName} (${member.mobile})`);
        } else {
          console.warn(`[WhatsApp] Failed for ${member.employeeName}:`, result.error);
        }
      } catch (err) {
        console.error(`[WhatsApp] Error sending to member ${userId}:`, err);
      }
    }
  } catch (err) {
    console.error('[WhatsApp] Background send error:', err);
  }
}

// ?? Client Event Email Template
async function sendClientEventEmail(to, eventData, assignedBy, clientName, actionType = 'created') {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Verify transporter configuration
    await transporter.verify();
    console.log(`?? Email transporter verified, sending to: ${to}`);

    const formattedDate = eventData.date
      ? new Date(eventData.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      : "N/A";

    const subjectPrefix = actionType === 'reminder' ? 'Reminder: ' : 'New Client Event: ';
    const subject = `${subjectPrefix}${eventData.eventName} - ${clientName}`;

    const mailOptions = {
      from: `"Auxin Task Manager" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; padding:20px; background:#f9f9f9;">
          <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; padding:20px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
            <h2 style="color:#007bff; margin-bottom:10px;">New Client Event Assigned</h2>
            <p><b>Client:</b> ${clientName}</p>
            <p><b>Event Name:</b> ${eventData.eventName}</p>
            <p><b>Event Type:</b> ${eventData.eventType || "N/A"}</p>
            <p><b>Date:</b> ${formattedDate}</p>
            <p><b>Time:</b> ${eventData.time || "N/A"}</p>
            <p><b>Assigned by:</b> ${assignedBy}</p>
            ${eventData.notes ? `<p><b>Notes:</b> ${eventData.notes}</p>` : ""}
            ${eventData.link ? `<p><b>Link:</b> <a href="${eventData.link}" style="color:#007bff;">${eventData.link}</a></p>` : ""}
            <p style="margin-top:20px; color:#555;">Please check your dashboard for more details.</p>
          </div>
        </div>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}, Message ID: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
}



// Bulk delete clients (Placed before /:id routes to avoid conflict)
router.post('/bulk-delete', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No client IDs provided' });
    }

    console.log(`Bulk deleting clients: ${ids.length} IDs provided`);

    // Vessel Operations: refuse while a voyage / vessel / port uses any of these clients
    const usage = await clientUsage(ids);
    if (usage) {
      return res.status(400).json({ message: `${usage}. Nothing was deleted.` });
    }

    // 1. Delete related Documents
    // We need to require the Document model if not already imported
    const Document = require('../models/Documents');
    const docResult = await Document.deleteMany({ clientId: { $in: ids } });
    console.log(`Deleted ${docResult.deletedCount} related documents`);

    // 2. Delete Clients (Events are embedded in Client, so they are deleted automatically)
    const result = await Client.deleteMany({ _id: { $in: ids } });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'No clients found to delete' });
    }

    res.json({
      message: 'Clients and related data deleted successfully',
      deletedCount: result.deletedCount,
      deletedDocuments: docResult.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting clients:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all clients
// router.get('/', authMiddleware, async (req, res) => {
//   try {
//     const clients = await Client.find().sort({ createdAt: -1 });
//     res.json(clients);
//   } catch (error) {
//     res.status(500).json({ message: 'Error fetching clients', error: error.message });
//   }
// });

// Get all clients
// Get all clients
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id; // from authMiddleware
    const userRole = req.user.role; // assuming you store role like "admin", "sales_executive"
    const { followupStatus, startDate, endDate } = req.query;

    const baseFilter = {};
    if (followupStatus) baseFilter.followupStatus = followupStatus;
    if (startDate || endDate) {
      baseFilter.createdAt = {};
      if (startDate) baseFilter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        baseFilter.createdAt.$lte = end;
      }
    }

    // Fetch assigned projects if user is linked to an employee
    let assignedClientIds = [];
    if (req.user.employeeId) {
      try {
        const employee = await Employee.findById(req.user.employeeId);
        if (employee && employee.assignedProjects && Array.isArray(employee.assignedProjects)) {
          // assignedProjects contains Client ObjectIds
          assignedClientIds = employee.assignedProjects;
        }
      } catch (empErr) {
        console.error('Error fetching employee for client filtering:', empErr);
      }
    }

    let clients;
    if (userRole === 'admin' || userRole === 'hod') {
      clients = await Client.find(baseFilter)
        .populate('createdBy', 'username')
        .populate('assignedTo', 'username')
        .sort({ createdAt: -1 });
    } else if (userRole === 'sales_executive') {
      const orConditions = [
        { createdBy: userId },
        { assignedTo: userId }
      ];

      if (assignedClientIds.length > 0) {
        orConditions.push({ _id: { $in: assignedClientIds } });
      }

      clients = await Client.find({
        ...baseFilter,
        $or: orConditions
      })
        .populate('createdBy', 'username')
        .populate('assignedTo', 'username')
        .sort({ createdAt: -1 });
    } else {
      // Default fallback for other roles if any
      clients = await Client.find({ ...baseFilter, createdBy: userId })
        .populate('createdBy', 'username')
        .populate('assignedTo', 'username')
        .sort({ createdAt: -1 });
    }

    // Build a user lookup map { id -> username } to handle legacy records
    // where createdBy was stored as a plain string (not a valid ObjectId),
    // causing Mongoose populate() to silently return null.
    const allUsers = await User.find({}).select('_id username').lean();
    const userMap = {};
    allUsers.forEach(u => { userMap[String(u._id)] = u.username; });

    // Convert to plain objects and inject resolved usernames
    const enriched = clients.map(c => {
      const obj = c.toObject ? c.toObject() : { ...c };

      // Resolve createdBy → createdByUsername
      if (obj.createdBy && typeof obj.createdBy === 'object' && obj.createdBy.username) {
        obj.createdByUsername = obj.createdBy.username;
      } else {
        const rawId = obj.createdBy ? String(obj.createdBy) : null;
        obj.createdByUsername = rawId ? (userMap[rawId] || 'Unknown') : 'Unknown';
      }

      // Resolve assignedTo → assignedToUsername
      if (obj.assignedTo && typeof obj.assignedTo === 'object' && obj.assignedTo.username) {
        obj.assignedToUsername = obj.assignedTo.username;
      } else {
        const rawId = obj.assignedTo ? String(obj.assignedTo) : null;
        obj.assignedToUsername = rawId ? (userMap[rawId] || 'Unassigned') : 'Unassigned';
      }

      return obj;
    });

    res.json(enriched);
  } catch (err) {
    console.error('GET /clients error:', err);
    res.status(500).json({ message: 'Error fetching clients', error: err.message });
  }
});

// Get all events across all clients (flattened with clientId / clientName).
// Must stay above GET /:id, otherwise "/events" is matched as a client id.
router.get('/events', authMiddleware, async (req, res) => {
  try {
    const clients = await Client.find({}, { companyName: 1, events: 1 }).lean();
    const all = [];
    for (const c of clients) {
      if (Array.isArray(c.events)) {
        for (const e of c.events) {
          all.push({
            clientId: c._id,
            clientName: c.companyName,
            ...e,
          });
        }
      }
    }
    res.json(all);
  } catch (error) {
    console.error('Error fetching all events:', error);
    res.status(500).json({ message: 'Error fetching all events', error: error.message });
  }
});

// Get remarks for a client/lead (latest first)
router.get('/:id/remarks', authMiddleware, async (req, res) => {
  try {
    const remarks = await ClientRemark.find({ clientId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(remarks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching remarks', error: error.message });
  }
});

// Add a remark for a client/lead (validation: text required)
router.post('/:id/remarks', authMiddleware, async (req, res) => {
  try {
    const text = req.body?.text != null ? String(req.body.text).trim() : '';
    if (!text) {
      return res.status(400).json({ message: 'Remark text cannot be empty' });
    }
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    const user = await User.findById(req.user._id);
    const remark = new ClientRemark({
      clientId: req.params.id,
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

// Get single client by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching client', error: error.message });
  }
});

router.post('/', authMiddleware,
  multer({ storage, fileFilter }).single('profilePicture'),
  async (req, res) => {
    try {
      console.log("Incoming body:", req.body);
      console.log("Incoming file:", req.file);

      // Support both JSON body and multipart/form-data with 'data' field.
      let clientData = {};
      if (req.body) {
        if (req.body.data) {
          try {
            clientData = JSON.parse(req.body.data);
          } catch (parseErr) {
            console.warn("Failed to parse req.body.data, falling back to req.body:", parseErr);
            clientData = req.body;
          }
        } else {
          clientData = req.body;
        }
      }

      // Basic validation: companyName is required by schema
      if (!clientData.companyName || clientData.companyName.toString().trim() === "") {
        return res.status(400).json({ message: "companyName is required" });
      }

      // Bulk import can explicitly allow saving duplicate contacts.
      const allowDuplicates =
        clientData.allowDuplicates === true ||
        clientData.allowDuplicates === "true";

      // Check for duplicate email (unless duplicate override is enabled)
      if (!allowDuplicates && clientData.email) {
        const existingEmail = await Client.findOne({
          email: clientData.email.toLowerCase().trim()
        });
        if (existingEmail) {
          return res.status(400).json({
            message: `This email address is already in use.`
          });
        }
      }

      // Check for duplicate phone (both phone and mobile fields), unless override is enabled
      if (!allowDuplicates && (clientData.phone || clientData.mobile)) {
        const phoneQuery = {
          createdBy: req.user.id,
          $or: []
        };

        if (clientData.phone) {
          phoneQuery.$or.push({ phone: clientData.phone.trim() });
        }
        if (clientData.mobile) {
          phoneQuery.$or.push({ mobile: clientData.mobile.trim() });
        }

        if (phoneQuery.$or.length > 0) {
          const existingPhone = await Client.findOne(phoneQuery);
          if (existingPhone) {
            const duplicateField = existingPhone.phone === clientData.phone ? 'phone' : 'mobile';
            return res.status(400).json({
              message: `Client with ${duplicateField} "${clientData[duplicateField]}" already exists`
            });
          }
        }
      }

      // Check if notifications should be disabled
      const disableNotifications = clientData.disableNotifications === true;

      // Add ownership information
      clientData.createdBy = req.user.id;

      // If admin creating ? can assign manually. For everyone else (or if admin didn't assign), assign to self.
      if (req.user.role === 'admin' || req.user.role === 'hod') {
        if (!clientData.assignedTo) {
          clientData.assignedTo = req.user.id;
        }
      } else {
        // Non-admins always assign to self to ensure validity and prevent unauthorized assignment
        clientData.assignedTo = req.user.id;
      }

      if (req.file) {
        clientData.profilePicture = `/uploads/clients/${req.file.filename}`;
      }

      // Internal override flag is not persisted as a document field
      delete clientData.allowDuplicates;

      // Convert date strings to Date objects if they exist
      if (clientData.projectTimelineStart) {
        clientData.projectTimelineStart = new Date(clientData.projectTimelineStart);
      }
      if (clientData.projectTimelineEnd) {
        clientData.projectTimelineEnd = new Date(clientData.projectTimelineEnd);
      }
      if (clientData.followUpDate) {
        clientData.followUpDate = new Date(clientData.followUpDate);
      }

      normalizeFollowupStatusOnPayload(clientData);

      const client = new Client(clientData);
      const savedClient = await client.save();

      // SKIP ALL NOTIFICATIONS if disableNotifications is true
      if (!disableNotifications) {
        // ... your existing notification code ...
      } else {
        console.log('Notifications disabled for client creation');
      }

      res.status(201).json(savedClient);
    } catch (error) {
      console.error("Create client error:", error);
      const message = error?.message || "Error creating client";
      res.status(400).json({ message, error: message });
    }
  }
);

// Update client with file upload support
router.put('/:id', authMiddleware, // keep sales_executive also admin separately if needed
  multer({ storage, fileFilter }).single('profilePicture'),
  async (req, res) => {
    try {
      // Debugging logs
      console.log("Update - Incoming body:", req.body);
      console.log("Update - Incoming file:", req.file);
      console.log("Update - Client ID:", req.params.id);

      let updateData = req.body.data
        ? JSON.parse(req.body.data)
        : req.body;

      const currentClient = await Client.findById(req.params.id);
      if (!currentClient) {
        return res.status(404).json({ message: 'Client not found' });
      }

      // Check for duplicate email only when email value is being changed
      if (updateData.email) {
        const nextEmail = String(updateData.email).toLowerCase().trim();
        const currentEmail = String(currentClient.email || "").toLowerCase().trim();
        if (nextEmail !== currentEmail) {
          const existingEmail = await Client.findOne({
            email: nextEmail,
            _id: { $ne: req.params.id }
          });
          if (existingEmail) {
            return res.status(400).json({
              message: `This email address is already in use.`
            });
          }
        }
      }

      // Add profile picture path if file was uploaded
      if (req.file) {
        updateData.profilePicture = `/uploads/clients/${req.file.filename}`;
        console.log("Update - Profile picture path:", updateData.profilePicture);
      }

      // Convert date strings to Date objects if they exist
      if (updateData.projectTimelineStart) {
        updateData.projectTimelineStart = new Date(updateData.projectTimelineStart);
      }
      if (updateData.projectTimelineEnd) {
        updateData.projectTimelineEnd = new Date(updateData.projectTimelineEnd);
      }
      if (updateData.followUpDate) {
        updateData.followUpDate = new Date(updateData.followUpDate);
      }

      // Convert opportunityValue to number if it exists
      if (updateData.opportunityValue) {
        updateData.opportunityValue = Number(updateData.opportunityValue);
      }

      normalizeFollowupStatusOnPayload(updateData);

      const updatedClient = await Client.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      res.json(updatedClient);
    } catch (error) {
      console.error("Update client error:", error);
      res.status(400).json({
        message: 'Error updating client',
        error: error.message,
        // stack: error.stack, // include stack temporarily
      });
    }
  }
);

// Delete client
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const clientId = req.params.id;

    // Vessel Operations: refuse while a voyage / vessel / port uses this client
    const usage = await clientUsage(clientId);
    if (usage) {
      return res.status(400).json({ message: `${usage}. It cannot be deleted.` });
    }

    // 1. Delete related Documents
    const Document = require('../models/Documents');
    await Document.deleteMany({ clientId: clientId });

    // 2. Delete Client (Events are embedded, so they go with it)
    const deletedClient = await Client.findByIdAndDelete(clientId);

    if (!deletedClient) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json({ message: 'Client and related data deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting client', error: error.message });
  }
});

// **************************************** CreateEvent Related routes *******************
// Add event to a client


router.post('/:id/events', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const eventData = req.body;
    const assignedBy = req.user?.username || "Admin";
    console.log(`?? Adding event to client ${id}`, eventData);

    const client = await Client.findById(id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Add assignedBy to event data
    const eventWithAssignedBy = { ...eventData, assignedBy };
    client.events.push(eventWithAssignedBy);

    // Save immediately without waiting for emails
    await client.save();
    console.log("Event saved to database");

    // Schedule reminders if any
    if (eventWithAssignedBy.reminders && eventWithAssignedBy.reminders.length > 0) {
      const deriveEventDateTime = () => {
        if (!eventWithAssignedBy.date) return null;

        const normalizeDateString = (value) => {
          if (!value) return null;
          if (typeof value === 'string') {
            return value.split('T')[0];
          }
          if (value instanceof Date && !isNaN(value.getTime())) {
            return value.toISOString().split('T')[0];
          }
          return null;
        };

        const baseDateStr = normalizeDateString(eventWithAssignedBy.date);
        if (!baseDateStr) return null;

        if (eventWithAssignedBy.time) {
          return new Date(`${baseDateStr}T${eventWithAssignedBy.time}:00`);
        }
        return new Date(baseDateStr);
      };

      const eventDateTime = deriveEventDateTime();

      eventWithAssignedBy.reminders.forEach(reminderMinutes => {
        if (!eventDateTime || isNaN(eventDateTime.getTime())) return;
        const reminderTime = new Date(eventDateTime.getTime() - reminderMinutes * 60000);
        const delay = reminderTime.getTime() - Date.now();
        if (delay > 0) {
          setTimeout(() => {
            const io = req.app.get('io');
            if (io) {
              const reminderPayload = {
                id: `event-reminder-${client.events[client.events.length - 1]._id}-${reminderMinutes}`,
                type: 'event-reminder',
                title: `Reminder: ${eventWithAssignedBy.eventName}`,
                body: `Event in ${reminderMinutes} minutes`,
                meta: { eventId: client.events[client.events.length - 1]._id, event: eventWithAssignedBy, reminderMinutes },
                url: `/clients/${client._id}/events`,
                timestamp: new Date()
              };
              io.emit('event-reminder', reminderPayload);
              // Emit to assigned members and creator
              const recipients = [...(eventWithAssignedBy.assignedTeamMembers || []), req.user.id].filter((v, i, a) => a.indexOf(v) === i);
              recipients.forEach(userId => {
                io.to(`user-${userId}`).emit('notification', reminderPayload);
                io.to(`user-${userId}`).emit('event-reminder', reminderPayload);
              });

              // Send reminder email
              sendEventEmailsInBackground(eventWithAssignedBy, assignedBy, client, 'reminder')
                .catch(e => console.error("Error sending client event reminder email:", e));
            }
          }, delay);
        }
      });
    }

    // Send response first for better UX
    res.status(201).json({
      message: 'Event added successfully',
      client
    });

    // Emit socket notification to connected clients
    try {
      const io = req.app.get('io');
      if (io) {
        const payload = {
          id: `client-event-${client._id}-${Date.now()}`,
          type: 'client-event',
          title: 'New Client Event',
          body: `${eventData.eventName || 'An event'} was added for ${client.companyName || 'a client'}`,
          meta: { clientId: client._id, eventId: client.events[client.events.length - 1]._id, event: eventWithAssignedBy },
          timestamp: new Date()
        };

        // Broadcast (existing)
        io.emit('notification', payload);
        console.log('Emitted client event notification to all (broadcast)');

        // Targeted emit to sockets that joined this specific client page
        try {
          io.to(`client-${client._id}`).emit('client-event', payload);
          console.log(`Emitted client-event to room client-${client._id}`);
        } catch (roomErr) {
          console.warn(`Failed to emit client-event to room client-${client._id}:`, roomErr);
        }

        // persist broadcast for sales_executive role so offline users get it
        const eventNotice = new Notification({
          title: payload.title,
          body: payload.body,
          payload,
          role: 'sales_executive'
        });
        await eventNotice.save();
      }
    } catch (emitErr) {
      console.error('Error emitting socket notification for client event:', emitErr);
    }

    // Send emails in background (non-blocking)
    sendEventEmailsInBackground(eventData, assignedBy, client)
      .then(() => console.log("Background email process completed"))
      .catch(err => console.error("Background email process failed:", err));

    // Send WhatsApp to each assigned team member (non-blocking)
    sendEventWhatsAppInBackground(eventWithAssignedBy, assignedBy, client)
      .then(() => console.log("Background WhatsApp process completed"))
      .catch(err => console.error("Background WhatsApp process failed:", err));
  } catch (error) {
    console.error("Error adding event:", error);
    res.status(400).json({ message: 'Error adding event', error: error.message });
  }
});

// Get all events for a client
router.get('/:id/events', authMiddleware, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).select('events');
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(client.events);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', error: error.message });
  }
});

// Update an event
router.put('/:id/events/:eventId', authMiddleware, async (req, res) => {
  try {
    const { id, eventId } = req.params;
    const updatedData = req.body;
    const assignedBy = req.user?.username || "Admin";
    console.log(`?? Updating event ${eventId} for client ${id}`, updatedData);

    const client = await Client.findById(id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    // Find event by ID
    const event = client.events.id(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Update event details
    Object.assign(event, updatedData);
    event.updatedAt = new Date();

    // Save immediately
    await client.save();
    console.log("Event updated in database");

    // Send response first
    res.json({
      message: 'Event updated successfully',
      event
    });

    // Send emails in background
    sendEventEmailsInBackground(updatedData, assignedBy, client)
      .then(() => console.log("Background email process completed"))
      .catch(err => console.error("Background email process failed:", err));

    // Send WhatsApp template with updated event data to assigned team members
    const eventPayloadForWhatsApp = {
      eventName: event.eventName || updatedData.eventName || updatedData.title,
      title: event.title || updatedData.title || updatedData.eventName,
      date: event.date || updatedData.date,
      time: event.time || updatedData.time,
      assignedTeamMembers: Array.isArray(event.assignedTeamMembers) ? event.assignedTeamMembers : (updatedData.assignedTeamMembers || []),
      notes: event.notes ?? updatedData.notes,
      link: event.link ?? updatedData.link
    };
    sendEventWhatsAppInBackground(eventPayloadForWhatsApp, assignedBy, client)
      .then(() => console.log("Background WhatsApp (update) process completed"))
      .catch(err => console.error("Background WhatsApp (update) process failed:", err));

    // ? Reschedule Reminders (Add new setTimeouts)
    if (updatedData.reminders && updatedData.reminders.length > 0) {
      const deriveEventDateTime = () => {
        if (!updatedData.date) return null;
        const normalizeDateString = (value) => {
          if (!value) return null;
          if (typeof value === 'string') return value.split('T')[0];
          if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString().split('T')[0];
          return null;
        };
        const baseDateStr = normalizeDateString(updatedData.date);
        if (!baseDateStr) return null;
        if (updatedData.time) return new Date(`${baseDateStr}T${updatedData.time}:00`);
        return new Date(baseDateStr);
      };

      const eventDateTime = deriveEventDateTime();

      updatedData.reminders.forEach(reminderMinutes => {
        if (!eventDateTime || isNaN(eventDateTime.getTime())) return;
        const reminderTime = new Date(eventDateTime.getTime() - reminderMinutes * 60000);
        const delay = reminderTime.getTime() - Date.now();

        if (delay > 0) {
          setTimeout(() => {
            const io = req.app.get('io');
            if (io) {
              const reminderPayload = {
                id: `event-reminder-${eventId}-${reminderMinutes}-${Date.now()}`,
                type: 'event-reminder',
                title: `Reminder: ${updatedData.eventName}`,
                body: `Event in ${reminderMinutes} minutes`,
                meta: { eventId: eventId, event: updatedData, reminderMinutes },
                url: `/clients/${client._id}/events`,
                timestamp: new Date()
              };
              io.emit('event-reminder', reminderPayload);
              // Emit to assigned members and creator
              const recipients = [...(updatedData.assignedTeamMembers || []), req.user.id].filter((v, i, a) => a.indexOf(v) === i);
              recipients.forEach(userId => {
                io.to(`user-${userId}`).emit('notification', reminderPayload);
                io.to(`user-${userId}`).emit('event-reminder', reminderPayload);
              });

              // Send reminder email
              sendEventEmailsInBackground(updatedData, assignedBy, client, 'reminder')
                .catch(e => console.error("Error sending client event reminder email:", e));
            }
          }, delay);
        }
      });
    }

  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ message: 'Error updating event', error: error.message });
  }
});

// Delete an event
router.delete('/:id/events/:eventId', authMiddleware, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    client.events = client.events.filter(e => e._id.toString() !== req.params.eventId);
    await client.save();
    res.json({ message: 'Event deleted successfully', client });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting event', error: error.message });
  }
});

module.exports = router;
