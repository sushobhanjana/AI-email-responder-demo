import { retrieveDocs, callLLM } from './vector.js';
import { getSenderRule, getPastEmailsForSender } from './database.js';

// Rule-based constants (should be loaded from policies/config in production)
const HIERARCHY_DOMAINS = ['yourcompany.com']; // Replace with actual internal domain
const CLIENT_DOMAINS = ['client.com', 'partner.org'];
const MEETING_KEYWORDS = ['meeting', 'call', 'sync', 'discussion', 'review', 'zoom', 'teams', 'meet'];
const MOM_KEYWORDS = ['mom', 'minutes', 'summary', 'action items', 'notes'];

export async function classifyEmail(email) {
    const { subject, from, to = [], cc = [], bodyPlain } = email;
    const text = `${subject}\n${bodyPlain}`;

    // 1. Rule-Based Pre-classification
    const isHierarchy = HIERARCHY_DOMAINS.some(d => from.includes(d));
    const isClient = CLIENT_DOMAINS.some(d => from.includes(d));

    const subjectLower = subject.toLowerCase();
    const isMeeting = MEETING_KEYWORDS.some(k => subjectLower.includes(k));
    const isMoM = MOM_KEYWORDS.some(k => subjectLower.includes(k));

    // Determine if the user is explicitly addressed in the "To" field 
    // Usually, we'd compare against process.env.USER_EMAIL, but for this demo 
    // we'll assume if "To" exists & doesn't just contain mailing lists, they are directly addressed.
    // Or we could try matching against a demo user email:
    const myEmail = process.env.MY_EMAIL || 'me@example.com';
    const userInTo = to.some(addr => addr.toLowerCase().includes(myEmail.toLowerCase())) || to.length > 0; // fallback if single receiver and no MY_EMAIL is set

    // Robust email extraction: matches <email> or just email, handles whitespace
    const emailMatch = from.match(/<([^>]+)>|(\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/i);
    let cleanSender = emailMatch ? (emailMatch[1] || emailMatch[0]) : from;
    cleanSender = cleanSender.trim().toLowerCase(); // Normalize for DB lookup

    // Fetch past emails from this sender to detect sentiment deviation
    const pastEmails = getPastEmailsForSender(cleanSender);

    // 2. RAG Context Retrieval
    // Retrieve relevant policy docs based on email content
    const contextDocs = await retrieveDocs(text);

    // 3. LLM Classification
    // We'll update callLLM to return structured JSON
    const llmResult = await callLLM(text, contextDocs, {
        isHierarchy,
        isClient,
        isMeeting,
        userInTo,
        pastEmails
    });

    // 4. Merge Results & Calculate Priority
    const category = llmResult.category || 'General';
    let priority = llmResult.priority || 'Low';

    // Override priority based on rules
    if (isHierarchy || isClient) {
        if (priority === 'Low') priority = 'Medium';

        // Boost priority further if the user is directly targeted (in "To")
        if (userInTo && priority === 'Medium') {
            priority = 'High';
        }
    }
    if (llmResult.is_escalation || llmResult.is_urgent) {
        priority = 'High';
    }

    // 5. Strict Sender Rule Override
    const senderRule = getSenderRule(cleanSender);
    if (senderRule) {
        priority = senderRule.priority;
        console.log(`[Classifier] Applied Rule for ${cleanSender}: Priority -> ${priority}`);
    }

    return {
        ...llmResult,
        category,
        priority,
        is_hierarchy: isHierarchy,
        is_client: isClient,
        is_meeting: isMeeting,
        is_mom: isMoM
    };
}
