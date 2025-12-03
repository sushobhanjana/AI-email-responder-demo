import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../emails.db');
const SCHEMA_PATH = path.join(__dirname, '../schema.sql');

let db;

export function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        // Enable WAL mode for better concurrency
        db.pragma('journal_mode = WAL');
        initDb();
    }
    return db;
}

function initDb() {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);
    console.log('Database initialized');
}

// Email Logs
export function logEmail(emailData) {
    const stmt = getDb().prepare(`
        INSERT INTO email_logs (
            email_id, thread_id, sender, subject, body_preview, 
            category, priority, confidence, 
            is_hierarchy, is_client, is_escalation, is_urgent, mom_missing,
            analysis_json, received_at
        ) VALUES (
            @email_id, @thread_id, @sender, @subject, @body_preview,
            @category, @priority, @confidence,
            @is_hierarchy, @is_client, @is_escalation, @is_urgent, @mom_missing,
            @analysis_json, @received_at
        )
        ON CONFLICT(email_id) DO UPDATE SET
            category = excluded.category,
            priority = excluded.priority,
            analysis_json = excluded.analysis_json
    `);

    return stmt.run({
        ...emailData,
        is_hierarchy: emailData.is_hierarchy ? 1 : 0,
        is_client: emailData.is_client ? 1 : 0,
        is_escalation: emailData.is_escalation ? 1 : 0,
        is_urgent: emailData.is_urgent ? 1 : 0,
        mom_missing: emailData.mom_missing ? 1 : 0,
        analysis_json: JSON.stringify(emailData.analysis_json || {})
    });
}

export function getEmail(emailId) {
    return getDb().prepare('SELECT * FROM email_logs WHERE email_id = ?').get(emailId);
}

// Reminders
export function queueReminder(reminder) {
    const stmt = getDb().prepare(`
        INSERT INTO reminder_queue (email_id, reminder_type, scheduled_time, metadata)
        VALUES (@email_id, @reminder_type, @scheduled_time, @metadata)
    `);
    return stmt.run({
        ...reminder,
        metadata: JSON.stringify(reminder.metadata || {})
    });
}

export function getPendingReminders() {
    return getDb().prepare(`
        SELECT * FROM reminder_queue 
        WHERE status = 'pending' AND scheduled_time <= datetime('now')
    `).all();
}

export function updateReminderStatus(id, status) {
    return getDb().prepare('UPDATE reminder_queue SET status = ? WHERE id = ?').run(status, id);
}

// MoM Tracker
export function trackMeeting(meeting) {
    const stmt = getDb().prepare(`
        INSERT INTO mom_tracker (
            meeting_id, email_id, subject, meeting_date, participants
        ) VALUES (
            @meeting_id, @email_id, @subject, @meeting_date, @participants
        )
        ON CONFLICT(meeting_id) DO NOTHING
    `);
    return stmt.run({
        ...meeting,
        participants: JSON.stringify(meeting.participants || [])
    });
}

export function getMissingMoMs() {
    // Find meetings > 24h ago where MoM not received
    return getDb().prepare(`
        SELECT * FROM mom_tracker 
        WHERE status = 'tracking' 
        AND mom_received = 0 
        AND meeting_date <= datetime('now', '-1 day')
    `).all();
}

export function updateMeeting(meetingId, updates) {
    const sets = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
        sets.push(`${key} = ?`);
        values.push(value);
    }
    values.push(meetingId);

    return getDb().prepare(`
        UPDATE mom_tracker 
        SET ${sets.join(', ')} 
        WHERE meeting_id = ?
    `).run(...values);
}
