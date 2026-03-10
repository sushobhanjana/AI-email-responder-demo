import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import { classifyEmail } from './helpers/classifier.js';
import { getDb } from './helpers/database.js';

async function runTest() {
    // Override my email for the test to match the "To" field below
    process.env.MY_EMAIL = 'me@yourcompany.com';

    // 1. Seed the DB with a past polite email from the boss to test baseline
    getDb().prepare(`
        INSERT OR IGNORE INTO email_logs (
            email_id, thread_id, sender, subject, body_preview, 
            category, priority, confidence, 
            is_hierarchy, is_client, is_escalation, is_urgent, mom_missing,
            analysis_json, received_at
        ) VALUES (
            'mock_past_1', 'thread_past', 'boss@yourcompany.com', 'Initial thoughts on project', 
            'Take your time with the review.', 'Work', 'Low', 0.9, 
            1, 0, 0, 0, 0, '{}', '2023-01-01T10:00:00Z'
        )
    `).run();

    // 2. Define the mock incoming email from the same sender, but now angry and urgent
    const mockEmail = {
        id: 'mock_current_1',
        subject: 'URGENT: Why is the project delayed?! Need sync meeting now',
        from: 'boss@yourcompany.com',
        to: ['me@yourcompany.com'],
        cc: ['team@yourcompany.com'],
        bodyPlain: 'I am extremely disappointed. I asked for this last week and still have not received the project files. Why is this delayed?! We need a meeting right now. Schedule it ASAP and make sure to take minutes.',
        internalDate: new Date().getTime().toString(),
        threadId: 'thread_current',
        snippet: 'I am extremely disappointed. I asked for this last week...'
    };

    console.log("Analyzing mock email...");

    try {
        const analysis = await classifyEmail(mockEmail);
        console.log("\n--- Analysis Result ---");
        console.log(JSON.stringify(analysis, null, 2));

        console.log("\n--- Verification ---");
        console.log(`User explicitly in To?     ${mockEmail.to.some(t => t.includes(process.env.MY_EMAIL)) ? 'Yes' : 'No'}`);
        console.log(`Detected as Hierarchy?     ${analysis.is_hierarchy ? 'Yes' : 'No'}`);
        console.log(`Calculated Priority:       ${analysis.priority} (Expected: High)`);
        console.log(`Detected Escaltion Risk?   ${analysis.is_escalation ? 'Yes' : 'No'}`);
        console.log(`Detected missing MoM base? ${analysis.is_meeting && !analysis.is_mom ? 'Yes' : 'No'}`);
    } catch (e) {
        console.error("Test failed:", e.message);
    }
}

runTest();
