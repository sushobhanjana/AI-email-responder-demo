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

app.get("/pending-reminders", (req, res) => {
  try {
    const reminders = getPendingReminders();
    res.json(reminders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

import { generateAndSendDigest } from "./helpers/notifications.js";

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
    const auth = await authorize();
    const messages = await listMessages(auth);
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`MCP running on http://localhost:${PORT}`));
