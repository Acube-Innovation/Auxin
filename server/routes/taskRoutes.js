const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Task = require('../models/Task');
const Employee = require('../models/Employee');
const Client = require('../models/Client');
const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');

// 📧 Background email sender for tasks (non-blocking)
async function sendTaskEmailsInBackground(taskData, assignedBy, clientId) {
  try {
    console.log("📧 ===== STARTING TASK EMAIL PROCESS =====");
    console.log("📧 Task Data:", JSON.stringify(taskData, null, 2));
    console.log("📧 Assigned By:", assignedBy);
    console.log("📧 Client ID:", clientId);
    
    // Check if email credentials are available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error("❌ EMAIL CREDENTIALS MISSING - Check EMAIL_USER and EMAIL_PASS environment variables");
      return;
    }
    console.log("✅ Email credentials found");

    // Collect recipients from assigned employees
    const recipients = [];

    // Add assigned employees emails
    if (Array.isArray(taskData.assignedEmployees) && taskData.assignedEmployees.length > 0) {
      console.log(`📧 Processing ${taskData.assignedEmployees.length} assigned employees`);
      
      for (const employeeId of taskData.assignedEmployees) {
        try {
          console.log(`📧 Looking up employee: ${employeeId}`);
          const employee = await Employee.findById(employeeId);
          if (employee) {
            console.log(`📧 Found employee: ${employee.employeeName} (${employee.emailId})`);
            if (employee.emailId) {
              recipients.push(employee.emailId);
              console.log(`✅ Added employee email: ${employee.emailId}`);
            } else {
              console.log(`❌ Employee ${employee.employeeName} has no email address`);
            }
          } else {
            console.log(`❌ Employee not found with ID: ${employeeId}`);
          }
        } catch (employeeError) {
          console.error(`❌ Error finding employee ${employeeId}:`, employeeError);
        }
      }
    } else {
      console.log("📧 No assigned employees found in task data");
    }

    const uniqueRecipients = [...new Set(recipients)];
    console.log(`📧 Final recipient list:`, uniqueRecipients);

    // Get client details for email
    let client = null;
    try {
      console.log(`📧 Fetching client details for: ${clientId}`);
      client = await Client.findById(clientId);
      if (client) {
        console.log(`✅ Client found:`, client.clientName || client.companyName);
      } else {
        console.log(`❌ Client not found with ID: ${clientId}`);
      }
    } catch (clientError) {
      console.error('❌ Error fetching client details:', clientError);
    }

    // Send emails only if we have recipients and client
    if (uniqueRecipients.length > 0 && client) {
      console.log(`📧 Ready to send ${uniqueRecipients.length} emails`);
      
      const emailResults = await Promise.allSettled(
        uniqueRecipients.map(email => 
          sendTaskAssignmentEmail(email, taskData, assignedBy, client)
        )
      );
      
      // Log email results
      emailResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`✅ Email successfully sent to: ${uniqueRecipients[index]}`);
        } else {
          console.error(`❌ Failed to send email to ${uniqueRecipients[index]}:`, result.reason);
        }
      });
    } else {
      console.log("📧 No emails sent - missing recipients or client details");
      if (uniqueRecipients.length === 0) console.log("📧 Reason: No valid recipients");
      if (!client) console.log("📧 Reason: Client not found");
    }
    
    console.log("📧 ===== TASK EMAIL PROCESS COMPLETED =====");
  } catch (emailError) {
    console.error("❌ Background task email error:", emailError);
  }
}

// 📧 Task Assignment Email Template
async function sendTaskAssignmentEmail(to, taskData, assignedBy, client) {
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
    console.log(`📧 Task email transporter verified, sending to: ${to}`);

    const formattedDate = taskData.date
      ? new Date(taskData.date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "N/A";

    const clientName = client.clientName || client.companyName || "Unknown Client";
    
    // Get priority color and text
    const priorityInfo = {
      high: { color: "#dc3545", text: "High Priority" },
      medium: { color: "#ffc107", text: "Medium Priority" },
      low: { color: "#28a745", text: "Low Priority" }
    };
    
    const priority = priorityInfo[taskData.priority] || { color: "#6c757d", text: taskData.priority || "Normal" };

    const mailOptions = {
      from: `"Auxin Task Manager" <${process.env.EMAIL_USER}>`,
      to,
      subject: `New Task Assigned: ${taskData.title} - ${clientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding:20px; background:#f9f9f9;">
          <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; padding:20px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
            <h2 style="color:#007bff; margin-bottom:10px;">New Task Assigned</h2>
            
            <div style="background:${priority.color}15; border-left:4px solid ${priority.color}; padding:10px; margin:10px 0;">
              <strong style="color:${priority.color};">${priority.text}</strong>
            </div>
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0; border-bottom:1px solid #eee;"><strong>Task:</strong></td>
                <td style="padding:8px 0; border-bottom:1px solid #eee;">${taskData.title}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; border-bottom:1px solid #eee;"><strong>Client:</strong></td>
                <td style="padding:8px 0; border-bottom:1px solid #eee;">${clientName}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; border-bottom:1px solid #eee;"><strong>Project:</strong></td>
                <td style="padding:8px 0; border-bottom:1px solid #eee;">${taskData.project || "N/A"}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; border-bottom:1px solid #eee;"><strong>Due Date:</strong></td>
                <td style="padding:8px 0; border-bottom:1px solid #eee;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; border-bottom:1px solid #eee;"><strong>Status:</strong></td>
                <td style="padding:8px 0; border-bottom:1px solid #eee;">
                  <span style="padding:4px 8px; background:#e9ecef; border-radius:4px; font-size:12px;">
                    ${taskData.status || "Pending"}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0; border-bottom:1px solid #eee;"><strong>Assigned by:</strong></td>
                <td style="padding:8px 0; border-bottom:1px solid #eee;">${assignedBy}</td>
              </tr>
              ${taskData.notes ? `
              <tr>
                <td style="padding:8px 0; border-bottom:1px solid #eee;"><strong>Notes:</strong></td>
                <td style="padding:8px 0; border-bottom:1px solid #eee;">${taskData.notes}</td>
              </tr>
              ` : ""}
              ${taskData.link ? `
              <tr>
                <td style="padding:8px 0;"><strong>Link:</strong></td>
                <td style="padding:8px 0;">
                  <a href="${taskData.link}" style="color:#007bff; text-decoration:none;">${taskData.link}</a>
                </td>
              </tr>
              ` : ""}
            </table>
            
            <div style="margin-top:20px; padding:15px; background:#f8f9fa; border-radius:5px;">
              <p style="margin:0; color:#495057; font-size:14px;">
                Please check your task dashboard for more details and updates.
              </p>
            </div>
          </div>
        </div>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`Task email sent successfully to ${to}, Message ID: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error(`Failed to send task email to ${to}:`, error);
    throw error;
  }
}

// Create task for a client (with email notifications)
router.post('/clients/:clientId/tasks', authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const {
      title,
      project,
      priority,
      date,
      assignedEmployees,
      notes,
      link,
      color,
      status,
    } = req.body;

    const assignedBy = req.user?.username || "Admin";

    if (!title || !date) {
      return res.status(400).json({ message: 'title and date are required' });
    }

    console.log(`🔄 Creating task for client ${clientId}`, {
      title,
      assignedEmployees,
      assignedBy
    });

    const task = new Task({
      clientId,
      title,
      project,
      priority,
      date,
      assignedEmployees: Array.isArray(assignedEmployees) ? assignedEmployees : [],
      notes,
      link,
      color,
      status,
      reminders: Array.isArray(req.body.reminders) ? req.body.reminders : [],
    });

    const saved = await task.save();
    console.log("Task saved to database");

    // Schedule reminders if any
    if (saved.reminders && saved.reminders.length > 0) {
      const taskDateTime = saved.date;
      saved.reminders.forEach(reminderMinutes => {
        const reminderTime = new Date(taskDateTime.getTime() - reminderMinutes * 60000);
        const delay = reminderTime.getTime() - Date.now();
        if (delay > 0) {
          setTimeout(() => {
            const io = req.app.get('io');
            if (io) {
              const reminderPayload = {
                id: `task-reminder-${saved._id}-${reminderMinutes}`,
                type: 'task-reminder',
                title: `Reminder: ${saved.title}`,
                body: `Task due in ${reminderMinutes} minutes`,
                meta: { taskId: saved._id, task: saved, reminderMinutes },
                url: `/tasks/${saved._id}`,
                timestamp: new Date()
              };
              io.emit('task-reminder', reminderPayload);
              // Emit to assigned employees and creator
              const recipients = [...(saved.assignedEmployees || []), req.user.id].filter((v, i, a) => a.indexOf(v) === i);
              recipients.forEach(userId => {
                io.to(`user-${userId}`).emit('notification', reminderPayload);
                io.to(`user-${userId}`).emit('task-reminder', reminderPayload);
              });
            }
          }, delay);
        }
      });
    }

    // Send response first for better UX
    res.status(201).json(saved);

    // Emit browser notifications to connected clients via socket.io
    try {
      const io = req.app.get('io');
      if (io) {
        // Send to all assigned employees' rooms
        if (Array.isArray(assignedEmployees) && assignedEmployees.length > 0) {
          for (const employeeId of assignedEmployees) {
            // Try to resolve the employee doc so we can notify by email or linked user id as well
            try {
              const emp = await Employee.findById(employeeId).lean();
              const payload = {
                id: `task-${saved._id}-${Date.now()}`,
                type: 'task',
                title: 'New Task Assigned',
                body: `Task "${title}" has been assigned to you.`,
                message: `Task "${title}" has been assigned to you.`,
                targetEmployeeId: employeeId,
                taskId: saved._id,
                url: `/tasks/${saved._id}`,
                meta: { clientId, taskId: saved._id },
                timestamp: new Date()
              };

              // Emit to employee-id room (compat)
              io.to(`user-${employeeId}`).emit('notification', payload);
              console.log(`Sent task notification to employee room: user-${employeeId}`);

              // Persist notification for this employee (userId if linked, else employeeId stored in userId slot may be null)
              const linkedUserId = emp?.user || emp?.userId || emp?.linkedUserId || null;
              const notificationDoc = new Notification({
                title: payload.title,
                body: payload.body,
                payload,
                userId: linkedUserId || null,
                email: emp?.emailId || null
              });
              await notificationDoc.save();

              // If linkedUserId is connected, mark deliveredTo immediately
              if (linkedUserId && io.sockets.adapter.rooms.get(`user-${linkedUserId}`)) {
                await Notification.updateOne({ _id: notificationDoc._id }, { $addToSet: { deliveredTo: linkedUserId } });
              }
            } catch (empErr) {
              console.warn(`Could not resolve employee ${employeeId} for notification mapping:`, empErr);
              // fallback emit and persist with employeeId in payload
              const payload = {
                id: `task-${saved._id}-${Date.now()}`,
                type: 'task',
                title: 'New Task Assigned',
                body: `Task "${title}" has been assigned to you.`,
                targetEmployeeId: employeeId,
                taskId: saved._id,
                url: `/tasks/${saved._id}`,
                meta: { clientId, taskId: saved._id },
                timestamp: new Date()
              };
              io.to(`user-${employeeId}`).emit('notification', payload);
              const notificationDoc = new Notification({
                title: payload.title,
                body: payload.body,
                payload,
                userId: null
              });
              await notificationDoc.save();
            }
          }
        }
        
        // Also send to admin channel (persist role notification)
        const adminPayload = {
          id: `task-admin-${saved._id}-${Date.now()}`,
          type: 'task',
          title: 'New Task Created',
          body: `Task "${title}" assigned to ${Array.isArray(assignedEmployees) ? assignedEmployees.length : 0} people`,
          taskId: saved._id,
          url: `/tasks/${saved._id}`,
          meta: { clientId, taskId: saved._id },
          timestamp: new Date()
        };
        io.to('role-admin').emit('notification', adminPayload);
        console.log('Sent task notification to role-admin');
        // persist for role
        const adminNotice = new Notification({ title: adminPayload.title, body: adminPayload.body, payload: adminPayload, role: 'admin' });
        await adminNotice.save();

        // Also send to sales_executive channel (persist role notification)
        const salesPayload = {
          id: `task-sales-${saved._id}-${Date.now()}`,
          type: 'task',
          title: 'New Task Created',
          body: `Task "${title}" has been created`,
          taskId: saved._id,
          url: `/tasks/${saved._id}`,
          meta: { clientId, taskId: saved._id },
          timestamp: new Date()
        };
        io.to('role-sales_executive').emit('notification', salesPayload);
        console.log('Sent task notification to role-sales_executive');
        const salesNotice = new Notification({ title: salesPayload.title, body: salesPayload.body, payload: salesPayload, role: 'sales_executive' });
        await salesNotice.save();
      }
    } catch (emitErr) {
      console.error('Error emitting socket notification for task:', emitErr);
    }

    // Send emails in background (non-blocking)
    sendTaskEmailsInBackground(
      { 
        title, 
        project, 
        priority, 
        date, 
        assignedEmployees, 
        notes, 
        link, 
        status 
      }, 
      assignedBy, 
      clientId
    )
      .then(() => console.log("Background task email process completed"))
      .catch(err => console.error("Background task email process failed:", err));

  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ message: 'Error creating task', error: error.message });
  }
});

// Update a task (with email notifications for assignment changes)
router.put('/clients/:clientId/tasks/:taskId', authMiddleware, async (req, res) => {
  try {
    const { clientId, taskId } = req.params;
    const update = req.body || {};
    const assignedBy = req.user?.username || "Admin";

    console.log(`🔄 Updating task ${taskId} for client ${clientId}`, update);

    const updated = await Task.findOneAndUpdate(
      { _id: taskId, clientId },
      update,
      { new: true }
    );
    
    if (!updated) {
      return res.status(404).json({ message: 'Task not found' });
    }

    console.log("Task updated in database");

    // Send response first
    res.json(updated);

    // Send emails in background only if assigned employees changed
    if (update.assignedEmployees && Array.isArray(update.assignedEmployees)) {
      sendTaskEmailsInBackground(
        { 
          title: updated.title,
          project: updated.project,
          priority: updated.priority,
          date: updated.date,
          assignedEmployees: update.assignedEmployees,
          notes: updated.notes,
          link: updated.link,
          status: updated.status
        }, 
        assignedBy, 
        clientId
      )
        .then(() => console.log("Background task update email process completed"))
        .catch(err => console.error("Background task update email process failed:", err));
    }

  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ message: 'Error updating task', error: error.message });
  }
});

// List tasks for a client
router.get('/clients/:clientId/tasks', authMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const tasks = await Task.find({ clientId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tasks', error: error.message });
  }
});

// Delete a task
router.delete('/clients/:clientId/tasks/:taskId', authMiddleware, async (req, res) => {
  try {
    const { clientId, taskId } = req.params;
    const deleted = await Task.findOneAndDelete({ _id: taskId, clientId });
    if (!deleted) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting task', error: error.message });
  }
});

module.exports = router;


