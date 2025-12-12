import { QdrantClient } from "@qdrant/js-client-rest";
import { GoogleGenerativeAI } from "@google/generative-ai";

const client = new QdrantClient({ url: process.env.QDRANT_URL });
let genAI;

function getGenAI() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is missing");
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

// Helper for exponential backoff
async function retryWithBackoff(fn, retries = 5, delay = 2000) {
  try {
    return await fn();
  } catch (error) {
    // Check for 429 Too Many Requests or 503 Service Unavailable
    if (retries > 0 && (error.message.includes("429") || error.message.includes("503"))) {
      console.warn(`[Gemini API] Rate limit hit. Retrying in ${delay}ms... (${retries} retries left)`);
      if (error.message.includes("Quota exceeded")) console.warn(`[Gemini API] Quota exceeded details: ${error.message}`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2); // Exponential backoff
    }
    throw error;
  }
}

export async function embedText(text) {
  return retryWithBackoff(async () => {
    const model = getGenAI().getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  });
}

export async function retrieveDocs(text) {
  const emb = await embedText(text);
  const resp = await client.search(process.env.QDRANT_COLLECTION, {
    vector: emb,
    limit: 5
  });
  return resp.map(r => r.payload.text);
}

export async function callLLM(emailText, docs, metadata = {}) {
  const systemPrompt = `
You are an intelligent Email Analyzer for a corporate environment.
Your goal is to classify emails, assess priority, and detect specific actionable items based on company policies.

CONTEXT:
- Is Hierarchy (Internal Management): ${metadata.isHierarchy || false}
- Is Client (External): ${metadata.isClient || false}
- Is Meeting Related: ${metadata.isMeeting || false}

RELEVANT POLICIES:
${docs.join("\n")}

TASK:
Analyze the email below and return a JSON object with the following fields:
- category: (String) One of "Work", "Client", "Personal", "Spam", "Newsletter", "HR", "Finance"
- priority: (String) "High", "Medium", "Low"
- confidence: (Number) 0.0 to 1.0
- is_escalation: (Boolean) True if the tone indicates anger, frustration, or explicit escalation
- is_urgent: (Boolean) True if immediate action is requested (e.g., "ASAP", "Urgent", deadlines today)
- mom_missing: (Boolean) True ONLY if this is a past meeting where Minutes of Meeting (MoM) haven't been sent yet.
- actions: (Array<String>) List of recommended actions (e.g., "Reply", "Schedule Meeting", "File Ticket")
- reason: (String) Brief explanation of the classification
- suggested_reply: (String) A draft response (if action is Reply)
- tags: (Array<String>) Relevant tags (e.g., "Project X", "Invoice", "Bug")

EMAIL CONTENT:
${emailText}
`;

  return retryWithBackoff(async () => {
    const model = getGenAI().getGenerativeModel({
      // Using gemini-2.5-flash-lite as verified working model
      model: "gemini-2.5-flash-lite",
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    return JSON.parse(response.text());
  });
}
