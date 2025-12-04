import nodemailer from 'nodemailer';
import { getDb } from './database.js';

// Configure transporter
// In production, use environment variables for host, port, secure, auth
let transporter;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
    return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('[Notifications] SMTP credentials missing. Skipping email send.');
        console.log(`[Mock Email] To: ${to}, Subject: ${subject}`);
        return { message: 'Mock email sent (missing credentials)' };
    }

    try {
        const info = await getTransporter().sendMail({
            from: process.env.SMTP_USER,
            to,
            subject,
            text,
            html
        });
        console.log('[Notifications] Email sent:', info.messageId);
        return info;
    } catch (error) {
        console.error('[Notifications] Error sending email:', error);
        throw error;
    }
}

export async function generateAndSendDigest(recipientEmail) {
    const db = getDb();

    // 1. Fetch High Priority Emails from last 24h
    const highPriority = db.prepare(`
        SELECT * FROM email_logs 
        WHERE priority = 'High' 
        AND received_at >= datetime('now', '-1 day')
        ORDER BY received_at DESC
    `).all();

    // 2. Fetch Pending Reminders
    const reminders = db.prepare(`
        SELECT * FROM reminder_queue 
        WHERE status = 'pending'
    `).all();

    // 3. Fetch Missing MoMs
    const missingMoMs = db.prepare(`
        SELECT * FROM mom_tracker 
        WHERE status = 'tracking' AND mom_received = 0
    `).all();

    // 4. Generate HTML
    let html = `<h1>Daily Email Digest</h1>`;

    if (highPriority.length > 0) {
        html += `<h2>🚨 High Priority Emails (${highPriority.length})</h2><ul>`;
        highPriority.forEach(email => {
            html += `<li><strong>${email.subject}</strong> from ${email.sender}<br/>
            <em>${email.category}</em> - <a href="https://mail.google.com/mail/u/0/#inbox/${email.thread_id}">View</a></li>`;
        });
        html += `</ul>`;
    } else {
        html += `<p>No high priority emails today.</p>`;
    }

    if (missingMoMs.length > 0) {
        html += `<h2>📝 Missing MoMs (${missingMoMs.length})</h2><ul>`;
        missingMoMs.forEach(mom => {
            html += `<li>Meeting: <strong>${mom.subject}</strong> (${new Date(mom.meeting_date).toLocaleDateString()})<br/>
            Participants: ${JSON.parse(mom.participants).join(', ')}</li>`;
        });
        html += `</ul>`;
    }

    if (reminders.length > 0) {
        html += `<h2>⏰ Pending Reminders (${reminders.length})</h2><ul>`;
        reminders.forEach(rem => {
            const meta = JSON.parse(rem.metadata || '{}');
            html += `<li>${rem.reminder_type}: ${meta.subject || 'No Subject'}</li>`;
        });
        html += `</ul>`;
    }

    // 5. Send Email
    return sendEmail({
        to: recipientEmail,
        subject: `Daily Digest - ${new Date().toLocaleDateString()}`,
        html
    });
}
