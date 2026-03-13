import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { upsertDoc } from "./helpers/vector.js";
// import { retrieveDocs, embedText, callLLM } from "./helpers/vector.js";

dotenv.config({ path: '../.env' });
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = 3001;
const SECRET = process.env.MCP_SECRET;

import { classifyEmail } from "./helpers/classifier.js";
import { logEmail, getEmail, upsertSenderRule, getSenderRule, getSetting, setSetting } from "./helpers/database.js";

import { processMoM, checkAndQueueReminders } from "./helpers/mom-tracker.js";
import { getPendingReminders, updateReminderStatus } from "./helpers/database.js";

app.post("/analyze-email", async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Received email to analyze:", email.subject);

    // 0. Idempotency Check
    const existing = getEmail(email.id);
    if (existing && existing.analysis_json) {
      console.log(`Skipping analysis. Email ${email.id} already exists.`);

      // OPTIONAL: If it exists in DB but is still unread in Gmail (e.g. previous run crashed before marking read),
      // we should probably mark it read now to clear the queue.
      /* try {
        const auth = await authorize();
        await markAsRead(auth, email.id);
      } catch (err) {
        console.error(`Failed to mark existing email ${email.id} as read:`, err.message);
      } */

      const cachedAnalysis = JSON.parse(existing.analysis_json);
      return res.json({
        ...cachedAnalysis,
        subject: email.subject,
        from: email.from,
        snippet: email.snippet,
        thread_id: email.threadId,
        sender: existing.sender
      });
    }

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

    // 4. Mark as Read in Gmail to prevent re-fetching
    /* try {
      const auth = await authorize();
      await markAsRead(auth, email.id);
    } catch (err) {
      console.error(`Failed to mark email ${email.id} as read:`, err.message);
    } */

    // Return merged data for workflow usage
    res.json({
      ...analysis,
      subject: email.subject,
      from: email.from,
      snippet: email.snippet,
      thread_id: email.threadId,
      sender: emailData.sender
    });
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

import { generateAndSendDigest, sendEmail, sendSingleAlert } from "./helpers/notifications.js";

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
      const recipient = getSetting('DEFAULT_RECIPIENT') || process.env.DEFAULT_RECIPIENT || "user@example.com";

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
    const email = getSetting('DEFAULT_RECIPIENT') || req.body.email; // Recipient email
    if (!email) {
      return res.status(400).json({ error: "Recipient email is required" });
    }
    const result = await generateAndSendDigest(email);
    res.json({ status: "success", result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/send-alert", async (req, res) => {
  try {
    console.log("[DEBUG] /send-alert received body:", JSON.stringify(req.body, null, 2));
    const { email } = req.body;
    const recipient = getSetting('DEFAULT_RECIPIENT') || req.body.recipient;
    if (!email || Object.keys(email).length === 0 || !recipient) {
      return res.status(400).json({ error: "Email data (non-empty) and recipient are required" });
    }
    const result = await sendSingleAlert(email, recipient);
    res.json({ status: "success", result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

import { authorize, listMessages, markAsRead, getOAuthClient, saveCredentials, getUserEmail, SCOPES } from "./helpers/gmail.js";

app.get("/auth/google", async (req, res) => {
  try {
    const client = await getOAuthClient();
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      // Force approval prompt to ensure we get a refresh token
      prompt: 'consent'
    });
    res.redirect(authUrl);
  } catch (e) {
    console.error("Auth Start Error:", e);
    res.status(500).send("Error starting auth: " + e.message);
  }
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send("No code provided");
    }
    const client = await getOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    await saveCredentials(client);

    try {
      const authorizedEmail = await getUserEmail(client);
      setSetting('DEFAULT_RECIPIENT', authorizedEmail);
      console.log(`Connected account: ${authorizedEmail}`);
    } catch (err) {
      console.error("Failed to read user email on auth", err);
    }

    res.redirect('/dashboard?status=connected');
  } catch (e) {
    console.error("Auth Callback Error:", e);
    res.status(500).send("Error validating token: " + e.message);
  }
});

app.get("/get-unread-emails", async (req, res) => {
  try {
    const { filter } = req.query;
    const auth = await authorize();

    let query = 'is:unread';
    if (filter === 'important') {
      query += ' is:important';
    }

    // specific query param > db setting > default 5
    const dbLimit = getSetting('EMAIL_BATCH_LIMIT');
    const limit = dbLimit ? parseInt(dbLimit) : (process.env.EMAIL_BATCH_LIMIT ? parseInt(process.env.EMAIL_BATCH_LIMIT) : 5);
    const maxResults = limit;

    const messages = await listMessages(auth, { limit: maxResults, query });
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

        <div style="margin-bottom: 20px; padding: 10px; background: white; border: 1px solid #ddd;">
           <h3>App Settings</h3>
           <a href="/auth/google" style="background: #dd4b39; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Connect Gmail</a>
           <span style="margin-left: 10px; color: #666; font-size: 14px;">(Click to authorize or re-authorize)</span>
           
           <hr style="margin: 20px 0; border-top: 1px solid #ddd;">
           
           <form action="/settings" method="POST" style="margin-top: 15px;">
              <p><strong>Connected Email / Recipient:</strong> ${getSetting('DEFAULT_RECIPIENT') || 'Not Connected'}</p>
              
              <label for="channel"><strong>Notification Channel:</strong></label><br>
              <select name="channel" id="channel" style="padding: 5px; margin-top: 5px; margin-bottom: 15px;">
                <option value="EMAIL" ${getSetting('NOTIFICATION_CHANNEL') === 'EMAIL' ? 'selected' : ''}>Email Only</option>
                <option value="WHATSAPP" ${getSetting('NOTIFICATION_CHANNEL') === 'WHATSAPP' ? 'selected' : ''}>WhatsApp Only</option>
                <option value="BOTH" ${getSetting('NOTIFICATION_CHANNEL') === 'BOTH' ? 'selected' : ''}>Both</option>
              </select>
              <br>

              <label for="wa_number"><strong>WhatsApp Number:</strong> (Used if WhatsApp is selected)</label><br>
              <input type="text" name="wa_number" id="wa_number" value="${getSetting('WHATSAPP_RECIPIENT_PHONE') || ''}" placeholder="+1234567890" style="padding: 5px; margin-top: 5px; margin-bottom: 15px; width: 300px;">
              <br>

              <label for="email_limit"><strong>Email Fetch Batch Limit:</strong></label><br>
              <input type="number" name="email_limit" id="email_limit" value="${getSetting('EMAIL_BATCH_LIMIT') || 5}" style="padding: 5px; margin-top: 5px; margin-bottom: 15px; width: 100px;">
              <br>

              <label for="digest_days"><strong>Daily Digest Lookback (Days):</strong></label><br>
              <input type="number" name="digest_days" id="digest_days" value="${getSetting('DIGEST_LOOKBACK_DAYS') || 1}" style="padding: 5px; margin-top: 5px; margin-bottom: 15px; width: 100px;">
              <br>

              <label for="mom_hours"><strong>MoM Missing Alert Threshold (Hours):</strong></label><br>
              <input type="number" name="mom_hours" id="mom_hours" value="${getSetting('MOM_MISSING_THRESHOLD_HOURS') || 24}" style="padding: 5px; margin-top: 5px; margin-bottom: 15px; width: 100px;">
              <br>

              <label for="internal_domains"><strong>Internal Domains:</strong> (Comma separated)</label><br>
              <input type="text" name="internal_domains" id="internal_domains" value="${getSetting('INTERNAL_DOMAINS') || 'yourcompany.com'}" placeholder="company.com, internal.org" style="padding: 5px; margin-top: 5px; margin-bottom: 15px; width: 400px;">
              <br>

              <label for="client_domains"><strong>Client Domains:</strong> (Comma separated)</label><br>
              <input type="text" name="client_domains" id="client_domains" value="${getSetting('CLIENT_DOMAINS') || 'client.com, partner.org'}" placeholder="client1.com, client2.net" style="padding: 5px; margin-top: 5px; margin-bottom: 15px; width: 400px;">
              <br>

              <button type="submit" style="background: #1976d2; color: white; padding: 10px 20px; border: none; border-radius: 5px; font-weight: bold; cursor: pointer;">Save Settings</button>
           </form>
        </div>
        
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

app.post("/settings", (req, res) => {
  try {
    const { channel, wa_number, email_limit, digest_days, mom_hours, internal_domains, client_domains } = req.body;
    if (channel) setSetting('NOTIFICATION_CHANNEL', channel);
    if (wa_number !== undefined) setSetting('WHATSAPP_RECIPIENT_PHONE', wa_number);
    if (email_limit) setSetting('EMAIL_BATCH_LIMIT', email_limit);
    if (digest_days) setSetting('DIGEST_LOOKBACK_DAYS', digest_days);
    if (mom_hours) setSetting('MOM_MISSING_THRESHOLD_HOURS', mom_hours);
    if (internal_domains !== undefined) setSetting('INTERNAL_DOMAINS', internal_domains);
    if (client_domains !== undefined) setSetting('CLIENT_DOMAINS', client_domains);

    res.redirect('/dashboard?status=settings_saved');
  } catch (e) {
    res.status(500).send("Error saving settings: " + e.message);
  }
});

app.post("/webhooks/policy-update", async (req, res) => {
  try {
    const { model, entry, event } = req.body;
    console.log(`Webhook received: ${event} on ${model}`);

    if (model === "sender-rule" && (event === "entry.create" || event === "entry.update" || event === "entry.publish")) {
      await upsertSenderRule({
        policy_id: entry.id, // Using Strapi ID
        sender_email: entry.sender_email,
        priority: entry.priority || 'High'
      });
      console.log(`Synced sender rule for '${entry.sender_email}' (Priority: ${entry.priority})`);
    }

    if (model === "policy" && (event === "entry.create" || event === "entry.update" || event === "entry.publish")) {
      // Also sync to Qdrant if there is text content (Dual-mode policies allowed)
      if (entry.content) {
        await upsertDoc(process.env.QDRANT_COLLECTION || "policies", {
          id: entry.id,
          payload: {
            title: entry.title,
            text: entry.content,
            slug: entry.slug,
            source: "strapi",
            updatedAt: entry.updatedAt
          }
        });
        console.log(`Synced policy '${entry.title}' to Qdrant.`);
      }
    }

    res.json({ status: "processed" });
  } catch (e) {
    console.error("Webhook processing error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`MCP running on http://localhost:${PORT}`));
