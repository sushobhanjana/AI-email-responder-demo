CREATE TABLE IF NOT EXISTS email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT UNIQUE NOT NULL,
    thread_id TEXT,
    sender TEXT,
    subject TEXT,
    body_preview TEXT,
    category TEXT,
    priority TEXT,
    confidence REAL,
    is_hierarchy BOOLEAN DEFAULT 0,
    is_client BOOLEAN DEFAULT 0,
    is_escalation BOOLEAN DEFAULT 0,
    is_urgent BOOLEAN DEFAULT 0,
    mom_missing BOOLEAN DEFAULT 0,
    analysis_json TEXT,
    received_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reminder_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT,
    reminder_type TEXT NOT NULL, -- 'digest', 'mom_alert', 'escalation'
    scheduled_time DATETIME NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'cancelled'
    retry_count INTEGER DEFAULT 0,
    metadata TEXT, -- JSON string for extra data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(email_id) REFERENCES email_logs(email_id)
);

CREATE TABLE IF NOT EXISTS mom_tracker (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id TEXT UNIQUE, -- Could be calendar event ID or generated
    email_id TEXT, -- The email that triggered this (e.g., invite)
    subject TEXT,
    meeting_date DATETIME,
    participants TEXT, -- JSON array of emails
    mom_received BOOLEAN DEFAULT 0,
    mom_email_id TEXT,
    reminder_sent BOOLEAN DEFAULT 0,
    status TEXT DEFAULT 'tracking', -- 'tracking', 'completed', 'overdue'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_logs_date ON email_logs(received_at);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminder_queue(status, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_mom_status ON mom_tracker(status);
