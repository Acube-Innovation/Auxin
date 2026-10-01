const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const nodemailer = require("nodemailer");
const Notification = require('../models/Notification');
const Attendance = require('../models/Attendance');
const fs = require('fs'); // Add this import

const DEFAULT_TASK_REMINDERS = [1, 15, 60, 180, 1440];

const normalizeReminderList = (reminders) => {
  if (!Array.isArray(reminders)) return [...DEFAULT_TASK_REMINDERS];
  const sanitized = reminders
    .map((minutes) => Number(minutes))
    .filter((minutes) => Number.isFinite(minutes) && minutes >= 0);
  return sanitized.length > 0 ? sanitized : [...DEFAULT_TASK_REMINDERS];
};

const deriveEventDateTime = (dateValue, timeValue) => {
  if (!dateValue) return null;

  const normalizeDateString = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      // if ISO string, split at T to ensure date-only portion
      return value.split('T')[0];
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value.toISOString().split('T')[0];
    }
    return null;
  };

  const baseDateStr = normalizeDateString(dateValue);
  if (!baseDateStr) return null;

  if (timeValue) {
    return new Date(`${baseDateStr}T${timeValue}:00`);
  }
  return new Date(baseDateStr);
};

// Storage config for employee profile photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/employees'); // save inside /uploads/employees
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // unique filename
  }
});

// File filter (only images allowed)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files allowed'), false);
  }
};

// ========== CREATE UPLOAD MIDDLEWARE ==========
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
// =============================================

// ?? Email sending helper
async function sendTaskAssignedEmail(to, eventData, assignedBy, employeeName, actionType = 'created') {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const formattedDate = eventData.date
    ? new Date(eventData.date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    : "N/A";

  const subjectPrefix = actionType === 'reminder' ? 'Reminder: ' : 'New Task Assigned: ';
  const titlePrefix = actionType === 'reminder' ? 'Task Reminder' : 'New Task Assigned';

  const mailOptions = {
    from: `"Auxin Task Manager" <${process.env.EMAIL_USER}>`,
    to,
    subject: `${subjectPrefix}${eventData.eventName} - ${employeeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding:20px; background:#f9f9f9;">
        <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; padding:20px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
          <h2 style="color:#007bff; margin-bottom:10px;">${titlePrefix}</h2>
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

  await transporter.sendMail(mailOptions);
}

// Helper for background emails
async function sendTaskEmailsInBackground(employee, eventData, assignedBy, actionType = 'created') {
  try {
    const recipients = [];
    if (employee.emailId) recipients.push(employee.emailId);

    if (Array.isArray(eventData.assignedTeamMembers)) {
      for (const memberId of eventData.assignedTeamMembers) {
        try {
          const member = await Employee.findById(memberId).limit(1).lean(); // optimized
          if (member?.emailId) recipients.push(member.emailId);
        } catch (e) {
          console.warn(`Failed to lookup team member ${memberId}:`, e);
        }
      }
    }
    const uniqueRecipients = [...new Set(recipients)];

    const emailPromises = uniqueRecipients.map(email =>
      sendTaskAssignedEmail(email, eventData, assignedBy, employee.employeeName || 'Employee', actionType).catch(err => {
        console.error(`Failed to send task email to ${email}:`, err);
      })
    );
    await Promise.allSettled(emailPromises);
  } catch (err) {
    console.error("Background email error:", err);
  }
}


// ====== STATIC ROUTES (No parameters) ======

// Get all employees
router.get('/', authMiddleware, async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employees', error: error.message });
  }
});

// Get all events across all employees - MUST COME BEFORE PARAMETERIZED ROUTES
router.get('/events', authMiddleware, async (req, res) => {
  try {
    const employees = await Employee.find({}, { employeeName: 1, events: 1 }).lean();
    const allEvents = [];
    for (const employee of employees) {
      if (Array.isArray(employee.events)) {
        for (const event of employee.events) {
          allEvents.push({
            employeeId: employee._id,
            employeeName: employee.employeeName,
            ...event,
          });
        }
      }
    }

    // Get the IO instance if available
    const io = req.app.get('io');

    // If socket.io is configured, emit a notification about events fetch
    // if (io) {
    //   io.to('role-admin').emit('notification', {
    //     id: `events-fetch-${Date.now()}`,
    //     type: 'system',
    //     title: 'Events Data Accessed',
    //     message: `All events data was accessed by ${req.user?.username || 'a user'}`,
    //     timestamp: new Date()
    //   });
    // }

    res.json(allEvents);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching all events', error: error.message });
  }
});

// Create new employee with profile photo support
router.post('/', authMiddleware, upload.single('profilePhoto'), async (req, res) => {
  try {
    console.log("Incoming employee body:", req.body);
    console.log("Incoming employee file:", req.file);

    let employeeData = req.body.data
      ? JSON.parse(req.body.data)
      : {};

    // Defensive: strip any incoming id fields to avoid duplicate _id insertion
    delete employeeData._id;
    delete employeeData.id;
    delete employeeData.__v;

    // Check for duplicate email BEFORE creating
    if (employeeData.emailId) {
      const existingEmployee = await Employee.findOne({
        emailId: employeeData.emailId.toLowerCase().trim()
      });

      if (existingEmployee) {
        return res.status(400).json({
          message: `Employee with email "${employeeData.emailId}" already exists`
        });
      }
    }

    // Check for duplicate employeeId (optional but good practice)
    if (employeeData.employeeId) {
      const existingEmployeeById = await Employee.findOne({
        employeeId: employeeData.employeeId
      });

      if (existingEmployeeById) {
        return res.status(400).json({
          message: `Employee with ID "${employeeData.employeeId}" already exists`
        });
      }
    }

    if (req.file) {
      employeeData.profilePhoto = `/uploads/employees/${req.file.filename}`;
    }

    const employee = new Employee(employeeData);
    const savedEmployee = await employee.save();

    // Emit lightweight event so frontends can update lists in real-time
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('employee-created', savedEmployee);
        if (savedEmployee.emailId) io.to(`email-${savedEmployee.emailId}`).emit('employee-created', savedEmployee);
        io.to('role-admin').emit('employee-created', savedEmployee);
      }
    } catch (emitErr) {
      console.warn('Failed to emit employee-created task:', emitErr);
    }

    res.status(201).json(savedEmployee);
  } catch (error) {
    console.error("Create employee error:", error);

    // Handle duplicate key error specifically
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      return res.status(400).json({
        message: `Employee with ${field} "${value}" already exists`,
        error: `Duplicate ${field}`
      });
    }

    res.status(400).json({
      message: "Error creating employee",
      error: error.message,
    });
  }
});
// Update employee
router.put('/:id', authMiddleware, upload.single('profilePhoto'), async (req, res) => {
  try {
    console.log('🔧 UPDATE EMPLOYEE - START');
    console.log('Employee ID:', req.params.id);
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);

    let updateData = {};
    if (req.body.data) {
      try {
        updateData = JSON.parse(req.body.data);
        console.log('Parsed updateData:', updateData);
        console.log('assignedProjects:', updateData.assignedProjects);
        console.log('Type of assignedProjects:', typeof updateData.assignedProjects);

        // Ensure assignedProjects is an array
        if (updateData.assignedProjects && !Array.isArray(updateData.assignedProjects)) {
          console.error('assignedProjects is not an array:', updateData.assignedProjects);
          return res.status(400).json({
            message: 'assignedProjects must be an array'
          });
        }
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr);
        return res.status(400).json({ message: 'Invalid JSON data' });
      }
    } else {
      updateData = req.body;
    }

    // Check for duplicate email (only if email is being updated)
    if (updateData.emailId) {
      const existingEmployee = await Employee.findOne({
        emailId: updateData.emailId.toLowerCase().trim(),
        _id: { $ne: req.params.id } // Exclude current employee
      });

      if (existingEmployee) {
        return res.status(400).json({
          message: `Another employee with email "${updateData.emailId}" already exists`
        });
      }
    }

    // Handle profile photo
    if (req.file) {
      // Delete old photo if exists
      const currentEmployee = await Employee.findById(req.params.id);
      if (currentEmployee && currentEmployee.profilePhoto) {
        const oldPhotoPath = path.join(__dirname, '..', currentEmployee.profilePhoto);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }
      updateData.profilePhoto = `/uploads/employees/${req.file.filename}`;
    }

    // Update employee
    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedEmployee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    console.log('✅ Employee updated successfully:', updatedEmployee._id);
    res.json({
      message: 'Employee updated successfully',
      employee: updatedEmployee
    });

  } catch (error) {
    console.error('❌ Error updating employee:', error);

    // Handle duplicate key error specifically
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      return res.status(400).json({
        message: `Another employee with ${field} "${value}" already exists`,
        error: `Duplicate ${field}`
      });
    }

    res.status(500).json({
      message: 'Error updating employee',
      error: error.message,
      details: error.toString()
    });
  }
});

// Bulk delete employees
router.post('/bulk-delete', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No employee IDs provided' });
    }

    console.log(`Bulk deleting employees: ${ids.length} IDs provided`);

    // 1. Delete related EmployeeDocuments
    const EmployeeDocument = require('../models/EmployeeDocuments');
    const docResult = await EmployeeDocument.deleteMany({ employeeId: { $in: ids } });
    console.log(`Deleted ${docResult.deletedCount} related employee documents`);

    // 2. Delete Employees
    const result = await Employee.deleteMany({ _id: { $in: ids } });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'No employees found to delete' });
    }

    res.json({
      message: 'Employees and related data deleted successfully',
      deletedCount: result.deletedCount,
      deletedDocuments: docResult.deletedCount
    });
  } catch (error) {
    console.error('Error bulk deleting employees:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ====== PARAMETERIZED ROUTES (With :id or other parameters) ======

// Get single employee by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employee', error: error.message });
  }
});



// Delete single employee
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Delete related EmployeeDocuments
    const EmployeeDocument = require('../models/EmployeeDocuments');
    await EmployeeDocument.deleteMany({ employeeId: id });

    // 2. Delete Employee
    const result = await Employee.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ message: 'Error deleting employee', error: error.message });
  }
});

// Remove project from employee
router.delete('/:id/projects', authMiddleware, async (req, res) => {
  try {
    const { project } = req.body;

    if (!project) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.assignedProjects = employee.assignedProjects.filter(
      p => p !== project
    );

    await employee.save();

    res.json({
      message: 'Project removed successfully',
      employee
    });
  } catch (error) {
    res.status(500).json({ message: 'Error removing project', error: error.message });
  }
});

// Get employees by role
router.get('/role/:role', authMiddleware, async (req, res) => {
  try {
    const employees = await Employee.find({
      role: req.params.role
    }).sort({ employeeName: 1 });

    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employees by role', error: error.message });
  }
});

// Search employees by name or ID
router.get('/search/:query', authMiddleware, async (req, res) => {
  try {
    const query = req.params.query;
    const employees = await Employee.find({
      $or: [
        { employeeName: { $regex: query, $options: 'i' } },
        { employeeId: { $regex: query, $options: 'i' } }
      ]
    }).sort({ employeeName: 1 });

    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: 'Error searching employees', error: error.message });
  }
});

// ====== NESTED PARAMETERIZED ROUTES (With multiple parameters) ======

// Add event to an employee
router.post('/:id/events', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const eventData = req.body || {};
    const assignedBy = req.user?.username || "Admin"; // logged-in user from token

    // Basic validation (don't allow empty events that will cause downstream issues)
    if (!eventData || !eventData.eventName) {
      return res.status(400).json({ message: "eventName is required" });
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Add assignedBy inside event data and set timestamps
    const eventWithAssignedBy = {
      ...eventData,
      assignedBy,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    eventWithAssignedBy.reminders = normalizeReminderList(eventWithAssignedBy.reminders);

    // Push and save
    employee.events.push(eventWithAssignedBy);
    await employee.save();

    // Get the saved event (the last pushed)
    const savedEvent = employee.events[employee.events.length - 1];
    const savedEventSnapshot = typeof savedEvent.toObject === 'function'
      ? savedEvent.toObject({ depopulate: true })
      : JSON.parse(JSON.stringify(savedEvent));

    // Respond immediately with the persisted event and employee snapshot
    res.status(201).json({
      message: 'Task added successfully',
      event: savedEvent,
      employeeId: employee._id
    });

    // Background tasks: send emails, emit socket notifications, persist Notification
    (async () => {
      try {
        // Collect recipients (employee + team members)
        // Send emails in background
        await sendTaskEmailsInBackground(employee, eventWithAssignedBy, assignedBy);

        // Build a single notification payload with stable id
        const payload = {
          id: `employee-event-${employee._id}-${savedEvent._id}`,
          type: 'employee-event',
          title: `New Task for ${employee.employeeName || 'Employee'}`,
          body: `${eventWithAssignedBy.eventName} was added`,
          meta: { employeeId: employee._id, eventId: savedEvent._id, event: eventWithAssignedBy },
          url: `/teammanagement_salesleads/${employee._id}`,
          timestamp: new Date()
        };

        // Emit notification and entity event
        try {
          const io = req.app.get('io');
          if (io) {
            // Generic notification channel (bell/native notifications)
            io.emit('notification', payload);
            // Domain event with saved event so UI lists can append the actual object
            io.emit('employee-event', { ...payload, event: savedEvent });
            // targeted rooms
            io.to(`user-${employee._id}`).emit('notification', payload);
            io.to(`user-${employee._id}`).emit('employee-event', { ...payload, event: savedEvent });
            if (employee.emailId) {
              io.to(`email-${employee.emailId}`).emit('notification', payload);
              io.to(`email-${employee.emailId}`).emit('employee-event', { ...payload, event: savedEvent });
            }
          }
        } catch (emitErr) {
          console.error('Failed to emit socket notifications for employee event:', emitErr);
        }

        // Persist a Notification document for offline delivery (safe best-effort)
        try {
          await Notification.create({
            title: payload.title,
            body: payload.body,
            payload,
            email: employee.emailId || null
          });
        } catch (noteErr) {
          console.error('Failed to persist notification for employee task:', noteErr);
        }
      } catch (bgErr) {
        console.error('Background processing error for employee task:', bgErr);
      }
    })();

    // Schedule reminders for the assigned task/event
    if (savedEventSnapshot.reminders && savedEventSnapshot.reminders.length > 0) {
      const eventDateTime = deriveEventDateTime(savedEventSnapshot.date, savedEventSnapshot.time);

      savedEventSnapshot.reminders.forEach((reminderMinutes) => {
        if (!eventDateTime || isNaN(eventDateTime.getTime())) return;
        const reminderTime = new Date(eventDateTime.getTime() - reminderMinutes * 60000);
        const delay = reminderTime.getTime() - Date.now();
        if (delay <= 0) return;

        setTimeout(() => {
          const io = req.app.get('io');
          if (!io) return;

          const reminderPayload = {
            id: `task-reminder-${savedEventSnapshot._id}-${reminderMinutes}`,
            type: 'task-reminder',
            title: `Reminder: ${savedEventSnapshot.eventName || 'Task'}`,
            body: `Task in ${reminderMinutes} minutes`,
            meta: {
              employeeId: employee._id,
              eventId: savedEventSnapshot._id,
              event: savedEventSnapshot,
              reminderMinutes,
            },
            url: `/teammanagement_salesleads/${employee._id}`,
            timestamp: new Date(),
          };

          io.emit('task-reminder', reminderPayload);

          const recipientUserIds = new Set();
          if (req.user?.id) recipientUserIds.add(String(req.user.id));
          if (employee?._id) recipientUserIds.add(String(employee._id));
          (savedEventSnapshot.assignedTeamMembers || []).forEach((memberId) => {
            if (memberId) recipientUserIds.add(String(memberId));
          });

          recipientUserIds.forEach((userId) => {
            io.to(`user-${userId}`).emit('notification', reminderPayload);
            io.to(`user-${userId}`).emit('task-reminder', reminderPayload);
          });

          // Send reminder email
          sendTaskEmailsInBackground(employee, savedEventSnapshot, assignedBy, 'reminder')
            .catch(e => console.error("Error sending task reminder email:", e));
        }, delay);
      });
    }

  } catch (error) {
    console.error("Error adding event:", error);
    // Provide helpful error message while avoiding leaking internals
    res.status(400).json({ message: 'Error adding task', error: error.message });
  }
});

// Get all events for an employee
router.get('/:id/events', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).select('events');
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(employee.events);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching events', error: error.message });
  }
});

// Update an event
// Update an event
router.put('/:id/events/:eventId', authMiddleware, async (req, res) => {
  try {
    const { id, eventId } = req.params;
    const updatedData = req.body;
    const assignedBy = req.user?.username || "Admin";

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Find event by ID
    const event = employee.events.id(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Update event details
    Object.assign(event, updatedData);
    event.updatedAt = new Date();

    await employee.save();

    // Send update notification emails in background
    sendTaskEmailsInBackground(employee, updatedData, assignedBy, 'updated')
      .catch(err => console.error("Email error:", err));

    // Browser notification + persist
    try {
      const io = req.app.get('io');
      if (io) {
        const payload = {
          id: `employee-event-update-${employee._id}-${Date.now()}`,
          type: 'employee-event-update',
          title: `Task updated for ${employee.employeeName || 'Employee'}`,
          body: `${updatedData.eventName || 'An event'} was updated`,
          meta: { employeeId: employee._id, eventId, event: updatedData },
          timestamp: new Date()
        };
        io.to(`user-${employee._id}`).emit('notification', payload);
        if (employee.emailId) io.to(`email-${employee.emailId}`).emit('notification', payload);

        // Targeted emit to assigned members
        if (Array.isArray(updatedData.assignedTeamMembers)) {
          updatedData.assignedTeamMembers.forEach(memberId => {
            io.to(`user-${memberId}`).emit('notification', payload);
          });
        }

        await Notification.create({
          title: payload.title,
          body: payload.body,
          payload,
          userId: null,
          email: employee.emailId || null
        });
      }
    } catch (notifyErr) {
      console.error('Error emitting/persisting notification for employee event update:', notifyErr);
    }

    // ? Reschedule Reminders (Add new setTimeouts)
    if (updatedData.reminders && updatedData.reminders.length > 0) {
      const deriveEventDateTime = (d, t) => {
        if (!d) return null;
        let dateStr = typeof d === 'string' ? d.split('T')[0] : d.toISOString().split('T')[0];
        if (t) return new Date(`${dateStr}T${t}:00`);
        return new Date(dateStr);
      };

      const eventDateTime = deriveEventDateTime(updatedData.date, updatedData.time);

      updatedData.reminders.forEach((reminderMinutes) => {
        if (!eventDateTime || isNaN(eventDateTime.getTime())) return;
        const reminderTime = new Date(eventDateTime.getTime() - reminderMinutes * 60000);
        const delay = reminderTime.getTime() - Date.now();

        if (delay > 0) {
          setTimeout(() => {
            const io = req.app.get('io');
            if (!io) return;

            const reminderPayload = {
              id: `task-reminder-${eventId}-${reminderMinutes}-${Date.now()}`,
              type: 'task-reminder',
              title: `Reminder: ${updatedData.eventName || 'Task'}`,
              body: `Task in ${reminderMinutes} minutes`,
              meta: {
                employeeId: employee._id,
                eventId: eventId,
                event: updatedData,
                reminderMinutes,
              },
              url: `/teammanagement_salesleads/${employee._id}`,
              timestamp: new Date(),
            };

            io.emit('task-reminder', reminderPayload);

            const recipientUserIds = new Set();
            if (req.user?.id) recipientUserIds.add(String(req.user.id));
            if (employee?._id) recipientUserIds.add(String(employee._id));
            (updatedData.assignedTeamMembers || []).forEach((memberId) => {
              if (memberId) recipientUserIds.add(String(memberId));
            });

            recipientUserIds.forEach((userId) => {
              io.to(`user-${userId}`).emit('notification', reminderPayload);
              io.to(`user-${userId}`).emit('task-reminder', reminderPayload);
            });

            // Send reminder email
            sendTaskEmailsInBackground(employee, updatedData, assignedBy, 'reminder')
              .catch(e => console.error("Error sending task reminder email:", e));

          }, delay);
        }
      });
    }

    res.json({
      message: 'Task updated and email(s) sent successfully',
      event,
    });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ message: 'Error updating task', error: error.message });
  }
});

// Update meeting (with email notifications)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const update = req.body;
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    // Store old meeting data for comparison
    const oldMeetingData = meeting.toObject();

    // Clear existing reminders before updating
    if (global.scheduledMeetingReminders && global.scheduledMeetingReminders[meeting._id]) {
      console.log(`?? Clearing existing reminders for meeting ${meeting._id}`);
      global.scheduledMeetingReminders[meeting._id].forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      delete global.scheduledMeetingReminders[meeting._id];
    }

    Object.assign(meeting, {
      title: update.title ?? meeting.title,
      type: update.type ?? meeting.type,
      date: update.date ? new Date(update.date) : meeting.date,
      time: update.time ?? meeting.time,
      clientId: update.clientId ?? meeting.clientId,
      assignedTeamMembers: Array.isArray(update.assignedTeamMembers) ? update.assignedTeamMembers : meeting.assignedTeamMembers,
      notes: update.notes ?? meeting.notes,
      link: update.link ?? meeting.link,
      color: update.color ?? meeting.color,
      reminders: Array.isArray(update.reminders) ? update.reminders : meeting.reminders
    });

    const saved = await meeting.save();
    const assignedBy = req.user?.username || "Admin";

    res.json(saved);

    // Send email notifications in background
    sendMeetingEmailsInBackground(saved, 'updated', assignedBy)
      .then(() => console.log("Meeting update email process completed"))
      .catch(err => console.error("Meeting update email process failed:", err));

    // ? RESCHEDULE REMINDERS WITH NEW TIME
    if (saved.reminders && saved.reminders.length > 0) {
      const meetingDateTime = saved.time ?
        new Date(`${saved.date.toISOString().split('T')[0]}T${saved.time}:00`) :
        saved.date;

      // Initialize global tracking if not exists
      if (!global.scheduledMeetingReminders) {
        global.scheduledMeetingReminders = {};
      }
      global.scheduledMeetingReminders[saved._id] = [];

      saved.reminders.forEach(reminderMinutes => {
        const reminderTime = new Date(meetingDateTime.getTime() - reminderMinutes * 60000);
        const delay = reminderTime.getTime() - Date.now();

        if (delay > 0) {
          const timeoutId = setTimeout(() => {
            try {
              const io = req.app.get('io');
              if (io) {
                // Send reminder email
                sendMeetingReminderEmail(saved, reminderMinutes, assignedBy)
                  .then(() => console.log(`Meeting reminder email sent for ${reminderMinutes} minutes before`))
                  .catch(err => console.error('Meeting reminder email failed:', err));

                const reminderPayload = {
                  id: `meeting-reminder-${saved._id}-${reminderMinutes}`,
                  type: 'meeting-reminder',
                  title: `Reminder: ${saved.title}`,
                  body: `Meeting in ${reminderMinutes} minutes`,
                  meta: {
                    meetingId: saved._id,
                    meeting: saved,
                    reminderMinutes,
                    clientId: saved.clientId
                  },
                  url: `/meetings/${saved._id}`,
                  timestamp: new Date()
                };

                // Emit to all
                io.emit('meeting-reminder', reminderPayload);

                // Emit to assigned members and creator
                const recipients = [
                  ...(saved.assignedTeamMembers || []),
                  saved.createdBy
                ].filter((v, i, a) => a.indexOf(v) === i);

                recipients.forEach(userId => {
                  io.to(`user-${userId}`).emit('notification', reminderPayload);
                  io.to(`user-${userId}`).emit('meeting-reminder', reminderPayload);
                });
              }
            } catch (error) {
              console.error('Error in meeting reminder timeout:', error);
            }

            // Clean up after firing
            if (global.scheduledMeetingReminders && global.scheduledMeetingReminders[saved._id]) {
              const index = global.scheduledMeetingReminders[saved._id].indexOf(timeoutId);
              if (index > -1) {
                global.scheduledMeetingReminders[saved._id].splice(index, 1);
              }
            }
          }, delay);

          global.scheduledMeetingReminders[saved._id].push(timeoutId);
          console.log(`?? Scheduled reminder for meeting ${saved._id}: ${reminderMinutes} minutes before (delay: ${delay}ms)`);
        }
      });
    }

    // Socket notification for the update
    try {
      const io = req.app.get('io');
      const payload = {
        id: `meeting-updated-${saved._id}`,
        type: 'meeting-updated',
        title: `Meeting updated: ${saved.title}`,
        body: `${saved.title} updated`,
        meta: { meetingId: saved._id, meeting: saved },
        url: `/meetings/${saved._id}`,
        timestamp: new Date()
      };
      if (io) {
        io.emit('notification', payload);
        io.emit('meeting-updated', saved);
        if (saved.clientId) io.to(`client-${saved.clientId}`).emit('meeting-updated', payload);
        for (const memberId of saved.assignedTeamMembers || []) {
          io.to(`user-${memberId}`).emit('notification', payload);
          io.to(`user-${memberId}`).emit('meeting-updated', payload);
        }
      }
      await Notification.create({ title: payload.title, body: payload.body, payload, role: null, userId: null });
    } catch (emitErr) {
      console.error('Meeting update emit/persist error:', emitErr);
    }
  } catch (err) {
    console.error('Update meeting error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Delete an event
router.delete('/:id/events/:eventId', authMiddleware, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.events = employee.events.filter(e => e._id.toString() !== req.params.eventId);
    await employee.save();

    res.json({ message: 'Task deleted successfully', employee });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting task', error: error.message });
  }
});

module.exports = router;