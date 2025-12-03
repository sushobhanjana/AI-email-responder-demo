import { trackMeeting, getMissingMoMs, queueReminder, updateMeeting, getDb } from './database.js';

export async function processMoM(email, analysis) {
    // 1. If it's a meeting (and not just a MoM itself), track it
    if (analysis.is_meeting && !analysis.is_mom) {
        // Use email ID as meeting ID for now (assuming 1 email = 1 meeting event)
        // In a real app, we'd parse the calendar invite ID
        const meetingId = email.id;

        // Default meeting date to now if not parsed (should be parsed from body/headers in future)
        const meetingDate = email.internalDate ? new Date(parseInt(email.internalDate)).toISOString() : new Date().toISOString();

        trackMeeting({
            meeting_id: meetingId,
            email_id: email.id,
            subject: email.subject,
            meeting_date: meetingDate,
            participants: [email.from, ...(email.to || [])]
        });
        console.log(`[MoM Tracker] Tracking meeting: ${email.subject}`);
    }

    // 2. If it IS a MoM, mark the meeting as complete
    if (analysis.is_mom) {
        console.log(`[MoM Tracker] Received MoM: ${email.subject}`);

        // Attempt to find the meeting this MoM belongs to.
        // Strategy: Look for meetings with similar subjects or same thread_id
        // For this demo, we'll use thread_id matching if available, or just log it.

        if (email.threadId) {
            const stmt = getDb().prepare(`
                UPDATE mom_tracker
                SET mom_received = 1, mom_email_id = ?, status = 'completed'
                WHERE email_id IN (SELECT email_id FROM email_logs WHERE thread_id = ?)
            `);
            const info = stmt.run(email.id, email.threadId);
            if (info.changes > 0) {
                console.log(`[MoM Tracker] Matched MoM to ${info.changes} meeting(s) via thread_id`);
            }
        }
    }
}

export function checkAndQueueReminders() {
    const missing = getMissingMoMs();
    const queued = [];

    for (const meeting of missing) {
        // Queue a reminder
        queueReminder({
            email_id: meeting.email_id,
            reminder_type: 'mom_alert',
            scheduled_time: new Date().toISOString(), // Send immediately
            metadata: {
                subject: meeting.subject,
                meeting_date: meeting.meeting_date,
                participants: JSON.parse(meeting.participants || '[]')
            }
        });

        // Update status so we don't queue it again immediately
        // (In a real app, we'd set a 'next_reminder' time)
        updateMeeting(meeting.meeting_id, { reminder_sent: 1 });

        queued.push(meeting);
    }

    return queued;
}
