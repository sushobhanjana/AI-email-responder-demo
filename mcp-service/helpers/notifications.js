import nodemailer from 'nodemailer';
import { getDb, getSetting } from './database.js';
import { sendWhatsAppMessage } from './whatsapp.js';

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
    const channel = getSetting('NOTIFICATION_CHANNEL') || process.env.NOTIFICATION_CHANNEL || 'EMAIL';
    const results = {};

    // 1. Send via Email
    if (channel === 'EMAIL' || channel === 'BOTH') {
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.log('[Notifications] SMTP credentials missing. Skipping email send.');
            console.log(`[Mock Email] To: ${to}, Subject: ${subject}`);
            results.email = { message: 'Mock email sent (missing credentials)' };
        } else {
            try {
                const info = await getTransporter().sendMail({
                    from: process.env.SMTP_USER,
                    to,
                    subject,
                    text,
                    html
                });
                console.log('[Notifications] Email sent:', info.messageId);
                results.email = info;
            } catch (error) {
                console.error('[Notifications] Error sending email:', error);
                // Don't throw if we also want to try WhatsApp, unless it's the only channel
                if (channel === 'EMAIL') throw error;
            }
        }
    }

    // 2. Send via WhatsApp
    if (channel === 'WHATSAPP' || channel === 'BOTH') {
        // If custom text is provided, use it as is. Otherwise, formatted from subject + html.
        const whatsappMessage = text || `*${subject}*\n\n${html.replace(/<[^>]*>?/gm, '')}`;

        // Use configured recipient phone or fallback to a default
        let recipientPhone = getSetting('WHATSAPP_RECIPIENT_PHONE') || process.env.WHATSAPP_RECIPIENT_PHONE;

        console.log(`[Notifications] NOTIFICATION_CHANNEL from DB: ${getSetting('NOTIFICATION_CHANNEL')}`);
        console.log(`[Notifications] Selected Channel: ${channel}`);
        console.log(`[Notifications] Recipient Phone from DB: ${getSetting('WHATSAPP_RECIPIENT_PHONE')}`);

        if (!recipientPhone) {
            console.log('[Notifications] Recipient phone not found in DB or ENV. Falling back to default.');
            recipientPhone = '+919932116301';
        }
        console.log(`[Notifications] Final Recipient Phone: ${recipientPhone}`);
        try {
            const waResult = await sendWhatsAppMessage(recipientPhone, whatsappMessage);
            results.whatsapp = waResult;
            console.log(`[Notifications] WhatsApp send result: Success (SID: ${waResult.sid})`);
        } catch (error) {
            console.error('[Notifications] WhatsApp send failed:', error.message || error);
            // Don't throw if we also sent email
            if (channel === 'WHATSAPP') throw error;
        }
    }

    return results;
}

export async function generateAndSendDigest(recipientEmail) {
    const db = getDb();

    // 1. Fetch High Priority Emails from last 24h
    const highPriority = db.prepare(`
        SELECT * FROM email_logs 
        WHERE priority = 'High' 
        AND created_at >= datetime('now', '-1 day')
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

    // 4. Generate Content
    const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    let html = `<h1>Daily Email Digest</h1><p><em>${dateStr}</em></p>`;
    let text = `*📅 DAILY EMAIL DIGEST*\n_${dateStr}_\n`;

    if (highPriority.length > 0) {
        html += `<h2>🚨 High Priority Emails (${highPriority.length})</h2><ul>`;
        text += `\n*🚨 HIGH PRIORITY (${highPriority.length})*\n`;

        highPriority.forEach(email => {
            html += `<li><strong>${email.subject}</strong> from ${email.sender}<br/>
            <em>${email.category}</em> - <a href="https://mail.google.com/mail/u/0/#inbox/${email.thread_id}">View</a></li>`;

            text += `• *Subject*: ${email.subject}\n`;
            text += `  From: ${email.sender} | Category: ${email.category}\n`;
        });
        html += `</ul>`;
    } else {
        html += `<p>No high priority emails today.</p>`;
        text += `\n_No high priority emails today._\n`;
    }

    if (missingMoMs.length > 0) {
        html += `<h2>📝 Missing MoMs (${missingMoMs.length})</h2><ul>`;
        text += `\n*📝 MISSING MoMs (${missingMoMs.length})*\n`;

        missingMoMs.forEach(mom => {
            const mDate = new Date(mom.meeting_date).toLocaleDateString();
            html += `<li>Meeting: <strong>${mom.subject}</strong> (${mDate})<br/>
            Participants: ${JSON.parse(mom.participants).join(', ')}</li>`;

            text += `• ${mom.subject} (${mDate})\n`;
        });
        html += `</ul>`;
    }

    if (reminders.length > 0) {
        html += `<h2>⏰ Pending Reminders (${reminders.length})</h2><ul>`;
        text += `\n*⏰ REMINDERS (${reminders.length})*\n`;

        reminders.forEach(rem => {
            const meta = JSON.parse(rem.metadata || '{}');
            html += `<li>${rem.reminder_type}: ${meta.subject || 'No Subject'}</li>`;

            text += `• ${rem.reminder_type}: ${meta.subject || 'No Subject'}\n`;
        });
        html += `</ul>`;
    }

    // 5. Send Notification
    return sendEmail({
        to: recipientEmail,
        subject: `Daily Digest - ${new Date().toLocaleDateString()}`,
        html,
        text
    });
}

export async function sendSingleAlert(emailData, recipientEmail) {
    const { subject, category, priority, reason, thread_id, sender } = emailData;

    let emoji = '⚠️';
    if (priority === 'High') emoji = '🚨';
    if (emailData.is_urgent) emoji = '⚡';

    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #d32f2f;">${emoji} ${priority} Alert: ${subject}</h2>
            <p><strong>From:</strong> ${sender}</p>
            <p><strong>Category:</strong> ${category}</p>
            <div style="background: #fff3e0; padding: 15px; border-radius: 4px; margin: 15px 0;">
                <strong>Analysis Reason:</strong><br/>
                ${reason}
            </div>
            <p>
                <a href="https://mail.google.com/mail/u/0/#inbox/${thread_id}" 
                   style="background: #1976d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                   View in Gmail
                </a>
            </p>
        </div>
    `;

    return sendEmail({
        to: recipientEmail,
        subject: `${emoji} ${priority}: ${subject}`,
        html
    });
}
