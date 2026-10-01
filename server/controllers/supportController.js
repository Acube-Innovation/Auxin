const nodemailer = require('nodemailer');
const path = require('path');

// Configure Nodemailer Transporter
// Using environment variables for security. 
// Ensure EMAIL_USER and EMAIL_PASS are set in .env
// Check for required environment variables
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("? Missing EMAIL_USER or EMAIL_PASS in .env file");
}

const transporter = nodemailer.createTransport({
    service: 'gmail', // Or your preferred service
    auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS, // Your email password or app-specific password
    },
});

exports.sendSupportEmail = async (req, res) => {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: 'Please fill in all required fields.' });
    }

    try {
        // 1. Send email to Admin/Support Team
        const adminMailOptions = {
            from: `"${name}" <${email}>`, // Sender address
            to: 'connect@ryzenforge.com', // Receiver address
            subject: `New Support Request: ${subject}`, // Subject line
            html: `
        <h3>New Support Request</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
        };

        await transporter.sendMail(adminMailOptions);

        // 2. Send Auto-Reply to User
        const userMailOptions = {
            from: '"RyzenForge Support" <connect@ryzenforge.com>',
            to: email,
            subject: 'Thank you for contacting RyzenForge Support',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
             <img src="cid:auxin_logo" alt="RyzenForge Logo" style="max-width: 150px;" />
          </div>
          <h2 style="color: #333;">Hello ${name},</h2>
          <p>Thank you for reaching out to RyzenForge Support. We have received your message and will get back to you shortly.</p>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="margin-top: 0;">Your Submission Details:</h4>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong></p>
            <p style="font-style: italic;">"${message}"</p>
          </div>

          <p>Best regards,<br/>The RyzenForge Team</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888; text-align: center;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `,
            attachments: [
                {
                    filename: 'auxin_logo.png',
                    path: path.join(__dirname, '../../frontend/src/assets/auxin_logo.png'),
                    cid: 'auxin_logo' // same cid value as in the html img src
                }
            ]
        };

        await transporter.sendMail(userMailOptions);

        res.status(200).json({ message: 'Message sent successfully!' });
    } catch (error) {
        console.error('Error sending support email:', error);
        res.status(500).json({ message: 'Failed to send message.', error: error.message });
    }
};
