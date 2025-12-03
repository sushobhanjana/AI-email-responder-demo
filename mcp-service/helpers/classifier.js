import { retrieveDocs, callLLM } from './vector.js';

// Rule-based constants (should be loaded from policies/config in production)
const HIERARCHY_DOMAINS = ['yourcompany.com']; // Replace with actual internal domain
const CLIENT_DOMAINS = ['client.com', 'partner.org'];
const MEETING_KEYWORDS = ['meeting', 'call', 'sync', 'discussion', 'review', 'zoom', 'teams', 'meet'];
const MOM_KEYWORDS = ['mom', 'minutes', 'summary', 'action items', 'notes'];

export async function classifyEmail(email) {
    const { subject, from, bodyPlain } = email;
    const text = `${subject}\n${bodyPlain}`;

    // 1. Rule-Based Pre-classification
    const isHierarchy = HIERARCHY_DOMAINS.some(d => from.includes(d));
    const isClient = CLIENT_DOMAINS.some(d => from.includes(d));

    const subjectLower = subject.toLowerCase();
    const isMeeting = MEETING_KEYWORDS.some(k => subjectLower.includes(k));
    const isMoM = MOM_KEYWORDS.some(k => subjectLower.includes(k));

    // 2. RAG Context Retrieval
    // Retrieve relevant policy docs based on email content
    const contextDocs = await retrieveDocs(text);

    // 3. LLM Classification
    // We'll update callLLM to return structured JSON
    const llmResult = await callLLM(text, contextDocs, {
        isHierarchy,
        isClient,
        isMeeting
    });

    // 4. Merge Results & Calculate Priority
    const category = llmResult.category || 'General';
    let priority = llmResult.priority || 'Low';

    // Override priority based on rules
    if (isHierarchy || isClient) {
        if (priority === 'Low') priority = 'Medium';
    }
    if (llmResult.is_escalation || llmResult.is_urgent) {
        priority = 'High';
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
