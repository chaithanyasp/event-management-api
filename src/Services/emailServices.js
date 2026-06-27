require('dotenv').config();
const nodemailer = require('nodemailer');
const { store } = require('../data/store');

// ─── Transporter ──────────────────────────────────────────────────────────────
// Using Ethereal (fake SMTP) by default. Swap for SendGrid / SES in production.

let _transporter = null;

const getTransporter = async () => {
  if (_transporter) return _transporter;

  if (process.env.EMAIL_USER && process.env.EMAIL_USER !== 'demo@ethereal.email') {
    // Real SMTP credentials provided
    _transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT, 10) || 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  } else {
    // Auto-create a throw-away Ethereal test account
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log(`[Mailer] Using Ethereal test account: ${testAccount.user}`);
  }

  return _transporter;
};

// ─── Core send helper ─────────────────────────────────────────────────────────

const sendMail = async ({ to, subject, html, text }) => {
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Event Platform" <no-reply@eventplatform.dev>',
      to,
      subject,
      text,
      html,
    });

    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log(`[Mailer] Preview: ${preview}`);

    return { success: true, messageId: info.messageId, preview };
  } catch (err) {
    console.error('[Mailer] Send failed:', err.message);
    return { success: false, error: err.message };
  }
};

// ─── Notification Templates ───────────────────────────────────────────────────

/**
 * Fired after successful /register — welcomes the new user.
 * Async, non-blocking: caller does NOT await this.
 */
const sendWelcomeEmail = async (user) => {
  const result = await sendMail({
    to: user.email,
    subject: '🎉 Welcome to Event Platform!',
    text: `Hi ${user.name},\n\nYour account is ready. Enjoy discovering and joining events!\n\nTeam Event Platform`,
    html: `
      <h2>Welcome, ${user.name}!</h2>
      <p>Your <strong>${user.role}</strong> account has been created successfully.</p>
      <p>Start exploring events at <a href="http://localhost:3000/api/events">Event Platform</a>.</p>
      <hr><p style="font-size:12px;color:#888">Event Platform &mdash; no-reply</p>
    `,
  });

  store.logNotification({
    type: 'welcome',
    recipientId: user.id,
    recipientEmail: user.email,
    status: result.success ? 'sent' : 'failed',
    error: result.error || null,
    preview: result.preview || null,
  });
};

/**
 * Fired after successful POST /events/:id/register.
 * Async, non-blocking.
 */
const sendRegistrationConfirmation = async (user, event) => {
  const eventDate = new Date(`${event.date}T${event.time}`).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const result = await sendMail({
    to: user.email,
    subject: `✅ You're registered: ${event.title}`,
    text: `Hi ${user.name},\n\nYou've successfully registered for "${event.title}".\n📅 ${eventDate}\n📍 ${event.location}\n\nSee you there!`,
    html: `
      <h2>Registration Confirmed!</h2>
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>You're officially registered for:</p>
      <table style="border-collapse:collapse;width:100%;max-width:480px">
        <tr><td style="padding:8px;font-weight:bold">Event</td><td style="padding:8px">${event.title}</td></tr>
        <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">Date &amp; Time</td><td style="padding:8px">${eventDate}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Location</td><td style="padding:8px">${event.location}</td></tr>
        <tr style="background:#f9f9f9"><td style="padding:8px;font-weight:bold">Category</td><td style="padding:8px">${event.category}</td></tr>
      </table>
      <p style="margin-top:16px">We look forward to seeing you there!</p>
      <hr><p style="font-size:12px;color:#888">Event Platform &mdash; no-reply</p>
    `,
  });

  store.logNotification({
    type: 'registration_confirmation',
    recipientId: user.id,
    recipientEmail: user.email,
    eventId: event.id,
    eventTitle: event.title,
    status: result.success ? 'sent' : 'failed',
    error: result.error || null,
    preview: result.preview || null,
  });
};

/**
 * Fired when an organizer cancels an event — notifies all attendees.
 * Async, non-blocking.
 */
const sendEventCancellationNotice = async (attendees, event) => {
  const promises = attendees.map(async (user) => {
    const result = await sendMail({
      to: user.email,
      subject: `❌ Event Cancelled: ${event.title}`,
      text: `Hi ${user.name},\n\nWe're sorry to inform you that "${event.title}" (${event.date}) has been cancelled.\n\nWe hope to see you at future events.`,
      html: `
        <h2>Event Cancelled</h2>
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Unfortunately, <strong>${event.title}</strong> scheduled for <strong>${event.date}</strong> has been cancelled by the organizer.</p>
        <p>We're sorry for the inconvenience — check out other upcoming events on the platform.</p>
        <hr><p style="font-size:12px;color:#888">Event Platform &mdash; no-reply</p>
      `,
    });

    store.logNotification({
      type: 'event_cancellation',
      recipientId: user.id,
      recipientEmail: user.email,
      eventId: event.id,
      eventTitle: event.title,
      status: result.success ? 'sent' : 'failed',
      error: result.error || null,
    });

    return result;
  });

  // Fan-out: send all in parallel, collect results
  return Promise.allSettled(promises);
};

module.exports = {
  sendWelcomeEmail,
  sendRegistrationConfirmation,
  sendEventCancellationNotice,
};