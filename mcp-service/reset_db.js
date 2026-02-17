import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'emails.db');

const db = new Database(DB_PATH);

console.log("🧹 specialized cleaning tool initialized...");

try {
    // Option A: Specific Order (Child tables first)

    // 1. Clear Reminders (Depends on email_logs)
    const info3 = db.prepare('DELETE FROM reminder_queue').run();
    console.log(`✅ Cleared ${info3.changes} pending reminders.`);

    // 2. Clear MoM Tracker
    const info2 = db.prepare('DELETE FROM mom_tracker').run();
    console.log(`✅ Cleared ${info2.changes} meeting records.`);

    // 3. Clear Email Logs (Parent table)
    const info1 = db.prepare('DELETE FROM email_logs').run();
    console.log(`✅ Cleared ${info1.changes} emails from history.`);

    console.log("\n🚀 System is ready to re-process emails!");

} catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
        console.warn("⚠️ Foreign key constraint hit. Retrying with FORCE...");
        // Option B: Force (Disable foreign keys temporarily)
        db.pragma('foreign_keys = OFF');
        db.prepare('DELETE FROM reminder_queue').run();
        db.prepare('DELETE FROM mom_tracker').run();
        db.prepare('DELETE FROM email_logs').run();
        db.pragma('foreign_keys = ON');
        console.log("✅ FORCE Cleaned database.");
    } else {
        console.error("❌ Error resetting database:", err);
    }
}
