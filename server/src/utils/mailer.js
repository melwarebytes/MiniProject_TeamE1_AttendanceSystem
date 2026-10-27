const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send an email notification (fails gracefully in development/test if SMTP is not configured)
 */
async function sendEmail({ to, subject, text, html }) {
  if (!transporter) {
    logger.info(`[Mailer Stub] Email to: ${to} | Subject: "${subject}"\nBody: ${text}`);
    return { success: true, stubbed: true };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"SAMS Attendance" <no-reply@sams.pes.edu>',
      to,
      subject,
      text,
      html: html || `<p>${text}</p>`,
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`Failed to send email to ${to}:`, error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendEmail,
};
