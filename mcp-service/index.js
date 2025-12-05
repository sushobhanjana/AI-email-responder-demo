import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
// import { retrieveDocs, embedText, callLLM } from "./helpers/vector.js";

dotenv.config({ path: '../.env' });
const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = 3001;
const SECRET = process.env.MCP_SECRET;

import { classifyEmail } from "./helpers/classifier.js";
import { logEmail } from "./helpers/database.js";

import { processMoM, checkAndQueueReminders } from "./helpers/mom-tracker.js";
import { getPendingReminders, updateReminderStatus } from "./helpers/database.js";

app.post("/analyze-email", async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Received email to analyze:", email.subject);

    // 1. Classify Email
    const analysis = await classifyEmail(email);

    // 2. Log to Database
    const emailData = {
      email_id: email.id,
      thread_id: email.threadId,
      sender: email.from,
      subject: email.subject,
      body_preview: email.snippet,
      category: analysis.category,
      priority: analysis.priority,
      confidence: analysis.confidence,
      is_hierarchy: analysis.is_hierarchy,
      is_client: analysis.is_client,
      is_escalation: analysis.is_escalation,
      is_urgent: analysis.is_urgent,
      mom_missing: analysis.mom_missing,
      analysis_json: analysis,
      received_at: email.internalDate
    };

    logEmail(emailData);

    // 3. Process MoM Tracking
    await processMoM(email, analysis);

    console.log(`Analyzed & Logged: ${email.subject} [${analysis.category}/${analysis.priority}]`);

    res.json(analysis);
  } catch (e) {
    console.error("Analysis Error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/check-mom", (req, res) => {
  try {
    const queued = checkAndQueueReminders();
    res.json({ status: "success", queued_count: queued.length, queued });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

import { generateAndSendDigest, sendEmail } from "./helpers/notifications.js";

app.post("/process-reminders", async (req, res) => {
  try {
    const reminders = getPendingReminders();
    const results = [];

    for (const reminder of reminders) {
      const meta = JSON.parse(reminder.metadata || '{}');

      // Construct email content based on reminder type
      let subject = "Reminder";
      let html = "<p>You have a reminder.</p>";

      if (reminder.reminder_type === 'mom_alert') {
        subject = `Action Required: Missing MoM for ${meta.subject}`;
        html = `
          <h2>Missing MoM Alert</h2>
          <p>We haven't received the Minutes of Meeting for:</p>
          <ul>
            <li><strong>Subject:</strong> ${meta.subject}</li>
            <li><strong>Date:</strong> ${new Date(meta.meeting_date).toLocaleString()}</li>
            <li><strong>Participants:</strong> ${meta.participants.join(', ')}</li>
          </ul>
          <p>Please reply to the original thread with the MoM.</p>
        `;
      }

      // Send the email
      // In a real app, we'd look up the user's email. For demo, we might use a fixed one or one from env.
      // Assuming we send to the sender or a configured admin for now.
      // Let's use a default recipient from env if available, else log it.
      const recipient = process.env.DEFAULT_RECIPIENT || "user@example.com";

      await sendEmail({
        to: recipient,
        subject,
        html
      });

      // Update status
      updateReminderStatus(reminder.id, 'sent');
      results.push({ id: reminder.id, status: 'sent', recipient });
    }

    res.json({ processed: results.length, results });
  } catch (e) {
    console.error("Reminder Processing Error:", e);
    res.status(500).json({ error: e.message });
  }
});


app.post("/send-digest", async (req, res) => {
  try {
    const { email } = req.body; // Recipient email
    if (!email) {
      return res.status(400).json({ error: "Recipient email is required" });
    }
    const result = await generateAndSendDigest(email);
    res.json({ status: "success", result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

import { authorize, listMessages } from "./helpers/gmail.js";

app.get("/get-unread-emails", async (req, res) => {
  try {
    const { filter } = req.query;
    const auth = await authorize();

    let query = 'is:unread';
    if (filter === 'important') {
      query += ' is:important';
    }

    const messages = await listMessages(auth, { query });
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

import { getDb } from "./helpers/database.js";

app.get("/dashboard", (req, res) => {
  try {
    const db = getDb();
    const logs = db.prepare('SELECT * FROM email_logs ORDER BY received_at DESC LIMIT 50').all();
    const moms = db.prepare('SELECT * FROM mom_tracker ORDER BY created_at DESC LIMIT 20').all();
    const reminders = db.prepare("SELECT * FROM reminder_queue WHERE status = 'pending'").all();

    let html = `
      <html>
      <head>
        <title>AI Email Responder Dashboard</title>
        <style>
          body { font-family: monospace; padding: 20px; background: #f0f0f0; }
          h2 { margin-top: 30px; border-bottom: 2px solid #333; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          th, td { padding: 10px; border: 1px solid #ddd; text-align: left; font-size: 14px; }
          th { background: #333; color: white; }
          tr:nth-child(even) { background: #f9f9f9; }
          .badge { padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          .high { background: #ffcccc; color: #cc0000; }
          .medium { background: #fff4cc; color: #996600; }
          .low { background: #ccffcc; color: #006600; }
        </style>
      </head>
      <body>
        <h1>📧 AI Email Responder Dashboard</h1>
        
        <h2>Recent Email Logs</h2>
        <table>
          <tr><th>ID</th><th>Subject</th><th>Category</th><th>Priority</th><th>MoM Missing?</th><th>Time</th></tr>
          ${logs.map(l => `
            <tr>
              <td>${l.email_id.substring(0, 8)}...</td>
              <td>${l.subject}</td>
              <td>${l.category}</td>
              <td><span class="badge ${l.priority.toLowerCase()}">${l.priority}</span></td>
              <td>${l.mom_missing ? '🔴 YES' : 'No'}</td>
              <td>${new Date(l.received_at).toLocaleString()}</td>
            </tr>
          `).join('')}
        </table>

        <h2>MoM Tracker</h2>
        <table>
          <tr><th>Meeting ID</th><th>Subject</th><th>Status</th><th>MoM Received?</th></tr>
          ${moms.map(m => `
            <tr>
              <td>${m.meeting_id}</td>
              <td>${m.subject}</td>
              <td>${m.status}</td>
              <td>${m.mom_received ? '✅ YES' : '❌ NO'}</td>
            </tr>
          `).join('')}
        </table>

        <h2>Pending Reminders</h2>
        <table>
          <tr><th>Type</th><th>Scheduled Time</th><th>Status</th></tr>
          ${reminders.map(r => `
            <tr>
              <td>${r.reminder_type}</td>
              <td>${new Date(r.scheduled_time).toLocaleString()}</td>
              <td>${r.status}</td>
            </tr>
          `).join('')}
        </table>
      </body>
      </html>
    `;
    res.send(html);
  } catch (e) {
    res.status(500).send("Error loading dashboard: " + e.message);
  }
});

app.listen(PORT, () => console.log(`MCP running on http://localhost:${PORT}`));
