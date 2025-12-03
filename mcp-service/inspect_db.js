import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../emails.db');

function inspectDb() {
    console.log(`Connecting to database at ${DB_PATH}`);
    const db = new Database(DB_PATH);

    console.log('\n=== Email Logs (Last 5) ===');
    try {
        const logs = db.prepare('SELECT email_id, subject, category, priority, received_at FROM email_logs ORDER BY received_at DESC LIMIT 5').all();
        if (logs.length === 0) console.log('No email logs found.');
        logs.forEach(log => console.log(log));
    } catch (e) {
        console.log('Error reading email_logs:', e.message);
    }

    console.log('\n=== MoM Tracker (Last 5) ===');
    try {
        const moms = db.prepare('SELECT meeting_id, subject, status, mom_received FROM mom_tracker ORDER BY created_at DESC LIMIT 5').all();
        if (moms.length === 0) console.log('No tracked meetings found.');
        moms.forEach(mom => console.log(mom));
    } catch (e) {
        console.log('Error reading mom_tracker:', e.message);
    }

    console.log('\n=== Reminder Queue (Pending) ===');
    try {
        const reminders = db.prepare("SELECT id, email_id, reminder_type, status, scheduled_time FROM reminder_queue WHERE status = 'pending' LIMIT 5").all();
        if (reminders.length === 0) console.log('No pending reminders.');
        reminders.forEach(rem => console.log(rem));
    } catch (e) {
        console.log('Error reading reminder_queue:', e.message);
    }
}

inspectDb();
