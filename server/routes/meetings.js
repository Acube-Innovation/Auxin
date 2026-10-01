const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Meeting = require('../models/Meeting');
const Notification = require('../models/Notification');
const Employee = require('../models/Employee');
const Client = require('../models/Client');
const nodemailer = require('nodemailer');

// Email notification functions for meetings
async function sendMeetingEmailsInBackground(meetingData, actionType, assignedBy) {
  try {
    console.log(`?? Starting meeting email background process for ${actionType}...`);

    const recipients = new Set();

    // Add assigned team members
    if (Array.isArray(meetingData.assignedTeamMembers) && meetingData.assignedTeamMembers.length > 0) {
      console.log(`?? Processing ${meetingData.assignedTeamMembers.length} team members`);

      for (const memberId of meetingData.assignedTeamMembers) {
        try {
          const member = await Employee.findById(memberId);
          if (member?.emailId) {
            recipients.add(member.emailId);
            console.log(`?? Added team member email: ${member.emailId}`);
          }
        } catch (memberError) {
          console.error(`Error finding employee ${memberId}:`, memberError);
        }
      }
    }

    // Add client email if clientId is provided
    if (meetingData.clientId) {
      try {
        const client = await Client.findById(meetingData.clientId);
        if (client?.email) {
          recipients.add(client.email);
          console.log(`?? Added client email: ${client.email}`);
        }
      } catch (clientError) {
        console.error(`Error finding client ${meetingData.clientId}:`, clientError);
      }
    }

    // Add creator email if available
    if (meetingData.createdBy) {
      try {
        const creator = await Employee.findById(meetingData.createdBy);
        if (creator?.emailId) {
          recipients.add(creator.emailId);
          console.log(`?? Added creator email: ${creator.emailId}`);
        }
      } catch (creatorError) {
        console.error(`Error finding creator ${meetingData.createdBy}:`, creatorError);
      }
    }

    const uniqueRecipients = [...recipients];
    console.log(`?? Final recipient list for meeting ${actionType}:`, uniqueRecipients);

    // Send emails in parallel
    if (uniqueRecipients.length > 0) {
      const emailResults = await Promise.allSettled(
        uniqueRecipients.map(email =>
          sendMeetingEmail(email, meetingData, actionType, assignedBy)
        )
      );

      // Log email results
      emailResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`? Meeting ${actionType} email sent to: ${uniqueRecipients[index]}`);
        } else {
          console.error(`? Failed to send meeting ${actionType} email to ${uniqueRecipients[index]}:`, result.reason);
        }
      });
    } else {
      console.log(`?? No recipients found for meeting ${actionType} notification`);
    }
  } catch (emailError) {
    console.error(`? Background meeting email error for ${actionType}:`, emailError);
  }
}

// Meeting Email Template
async function sendMeetingEmail(to, meetingData, actionType, assignedBy) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.verify();
    console.log(`?? Meeting email transporter verified, sending to: ${to}`);

    const formattedDate = meetingData.date
      ? new Date(meetingData.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      : "N/A";

    let actionText;
    if (actionType === 'created') actionText = 'scheduled';
    else if (actionType === 'updated') actionText = 'updated';
    else if (actionType === 'reminder') actionText = 'reminder';
    else actionText = actionType;

    const subject = actionType === 'reminder'
      ? `Reminder: ${meetingData.title}`
      : `Meeting ${actionText}: ${meetingData.title}`;

    // Get client name if available
    let clientName = "N/A";
    if (meetingData.clientId) {
      try {
        const client = await Client.findById(meetingData.clientId);
        clientName = client?.companyName || client?.clientName || "N/A";
      } catch (err) {
        console.error("Error fetching client name:", err);
      }
    }

    const mailOptions = {
      from: `"Auxin Task Manager" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; padding:20px; background:#f9f9f9;">
          <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; padding:20px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
            <h2 style="color:#007bff; margin-bottom:10px;">Meeting ${actionText.toUpperCase()}</h2>
            <p><b>Meeting Title:</b> ${meetingData.title}</p>
            <p><b>Meeting Type:</b> ${meetingData.type || "General Meeting"}</p>
            <p><b>Date:</b> ${formattedDate}</p>
            <p><b>Time:</b> ${meetingData.time || "N/A"}</p>
            <p><b>Client:</b> ${clientName}</p>
            <p><b>${actionType === 'created' ? 'Scheduled by' : 'Updated by'}:</b> ${assignedBy}</p>
            ${meetingData.notes ? `<p><b>Notes:</b> ${meetingData.notes}</p>` : ""}
            ${meetingData.link ? `<p><b>Meeting Link:</b> <a href="${meetingData.link.startsWith('http') ? meetingData.link : `https://${meetingData.link}`}" style="color:#007bff;">${meetingData.link}</a></p>` : ""}
            <p style="margin-top:20px; color:#555;">Please check your dashboard for more details and updates.</p>
            <div style="margin-top:15px; padding:10px; background:#f8f9fa; border-radius:4px;">
              <small style="color:#6c757d;">This is an automated notification from Auxin Task Manager.</small>
            </div>
          </div>
        </div>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`Meeting ${actionType} email sent successfully to ${to}, Message ID: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error(`Failed to send meeting ${actionType} email to ${to}:`, error);
    throw error;
  }
}

// Create meeting (with email notifications)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const data = req.body;
    if (!data.title || !data.date) return res.status(400).json({ message: 'title and date are required' });

    const meeting = new Meeting({
      title: data.title,
      type: data.type || 'meeting',
      date: new Date(data.date),
      time: data.time || '',
      clientId: data.clientId || null,
      assignedTeamMembers: Array.isArray(data.assignedTeamMembers) ? data.assignedTeamMembers : [],
      notes: data.notes || '',
      link: data.link || '',
      color: data.color || '#FF9500',
      reminders: Array.isArray(data.reminders) ? data.reminders : [],
      createdBy: req.user.id
    });

    const saved = await meeting.save();
    const assignedBy = req.user?.username || "Admin";

    // Schedule reminders
    if (saved.reminders && saved.reminders.length > 0) {
      const meetingDateTime = saved.time ? new Date(`${saved.date.toISOString().split('T')[0]}T${saved.time}:00`) : saved.date;
      saved.reminders.forEach(reminderMinutes => {
        const reminderTime = new Date(meetingDateTime.getTime() - reminderMinutes * 60000);
        const delay = reminderTime.getTime() - Date.now();
        if (delay > 0) {
          setTimeout(() => {
            const io = req.app.get('io');
            if (io) {
              const reminderPayload = {
                id: `meeting-reminder-${saved._id}-${reminderMinutes}`,
                type: 'meeting-reminder',
                title: `Reminder: ${saved.title}`,
                body: `Meeting in ${reminderMinutes} minutes`,
                meta: { meetingId: saved._id, meeting: saved, reminderMinutes },
                url: `/meetings/${saved._id}`,
                timestamp: new Date()
              };
              io.emit('meeting-reminder', reminderPayload);
              // Emit to assigned members and creator
              const recipients = [...(saved.assignedTeamMembers || []), saved.createdBy].filter((v, i, a) => a.indexOf(v) === i);
              recipients.forEach(userId => {
                io.to(`user-${userId}`).emit('notification', reminderPayload);
                io.to(`user-${userId}`).emit('meeting-reminder', reminderPayload);
              });

              // Helper to find assignedBy name is tricky here as we only have ID in createdBy usually, 
              // but we can pass a generic string or try to use saved data if populated (it's not).
              // For now, we'll pass "system" or reuse the assignments.
              sendMeetingEmailsInBackground(saved, 'reminder', "System Reminder")
                .catch(e => console.error("Error sending reminder email:", e));
            }
          }, delay);
        }
      });
    }

    // Respond early
    res.status(201).json(saved);

    // Send email notifications in background
    sendMeetingEmailsInBackground(saved, 'created', assignedBy)
      .then(() => console.log("Meeting creation email process completed"))
      .catch(err => console.error("Meeting creation email process failed:", err));

    // Build notification payload and emit (background)
    try {
      const io = req.app.get('io');
      const payload = {
        id: `meeting-${saved._id}`,
        type: 'meeting-created',
        title: `New Meeting: ${saved.title}`,
        body: `${saved.title} scheduled on ${saved.date.toISOString().split('T')[0]}`,
        meta: { meetingId: saved._id, meeting: saved },
        url: `/meetings/${saved._id}`,
        timestamp: new Date()
      };
      if (io) {
        io.emit('notification', payload);
        io.emit('meeting-created', saved);
        // targeted emits
        if (saved.clientId) io.to(`client-${saved.clientId}`).emit('meeting-created', payload);
        for (const memberId of saved.assignedTeamMembers || []) {
          io.to(`user-${memberId}`).emit('notification', payload);
          io.to(`user-${memberId}`).emit('meeting-created', payload);
        }
      }

      // persist notification
      await Notification.create({ title: payload.title, body: payload.body, payload, role: null, userId: null });
    } catch (emitErr) {
      console.error('Meeting emit/persist error:', emitErr);
    }
  } catch (err) {
    console.error('Create meeting error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Update meeting (with email notifications)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const update = req.body;
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

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

    // Schedule reminders for updated meeting
    if (saved.reminders && saved.reminders.length > 0) {
      console.log(`Scheduling reminders for updated meeting: ${saved.title}`);
      const meetingDateTime = saved.time
        ? new Date(`${saved.date.toISOString().split('T')[0]}T${saved.time}:00`)
        : new Date(saved.date);

      const io = req.app.get('io'); // Hoist io

      saved.reminders.forEach(reminderMinutes => {
        const reminderTime = new Date(meetingDateTime.getTime() - reminderMinutes * 60000);
        const delay = reminderTime.getTime() - Date.now();

        if (delay > 0) {
          console.log(`Setting timeout for ${reminderMinutes}m reminder in ${delay}ms`);
          setTimeout(() => {
            if (io) {
              const reminderPayload = {
                id: `meeting-reminder-${saved._id}-${reminderMinutes}`,
                type: 'meeting-reminder',
                title: `Reminder: ${saved.title}`,
                body: `Meeting in ${reminderMinutes} minutes`,
                meta: { meetingId: saved._id, meeting: saved, reminderMinutes },
                url: `/meetings/${saved._id}`,
                timestamp: new Date()
              };

              console.log(`Firing reminder for updated meeting ${saved._id} (${reminderMinutes}m)`);
              io.emit('meeting-reminder', reminderPayload);

              const recipients = [...(saved.assignedTeamMembers || []), saved.createdBy]
                .filter(Boolean)
                .filter((v, i, a) => a.indexOf(v) === i);

              recipients.forEach(userId => {
                io.to(`user-${userId}`).emit('notification', reminderPayload);
                io.to(`user-${userId}`).emit('meeting-reminder', reminderPayload);
              });

              sendMeetingEmailsInBackground(saved, 'reminder', "System Reminder")
                .catch(e => console.error("Error sending reminder email:", e));
            }
          }, delay);
        }
      });
    }

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

// Get all meetings (supports optional date range query)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const filter = {};
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.date.$lte = new Date(req.query.endDate);
    }
    const meetings = await Meeting.find(filter).sort({ date: 1 }).lean();
    res.json(meetings);
  } catch (err) {
    console.error('Get meetings error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get single meeting
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const m = await Meeting.findById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Meeting not found' });
    res.json(m);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// Delete meeting
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const deleted = await Meeting.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Meeting not found' });
    // emit delete
    try {
      const io = req.app.get('io');
      const payload = { id: `meeting-deleted-${deleted._id}`, type: 'meeting-deleted', title: 'Meeting removed', body: deleted.title, meta: { meetingId: deleted._id } };
      if (io) {
        io.emit('notification', payload);
        io.emit('meeting-deleted', payload);
      }
    } catch (e) { console.warn('emit delete err', e); }
    res.json({ message: 'Meeting deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;