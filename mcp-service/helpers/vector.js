import { QdrantClient } from "qdrant-js";
import OpenAI from "openai";

const client = new QdrantClient({ url: process.env.QDRANT_URL });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedText(text) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });
  return res.data[0].embedding;
}

export async function retrieveDocs(text) {
  const emb = await embedText(text);
  const resp = await client.search(process.env.QDRANT_COLLECTION, {
    vector: emb,
    limit: 5
  });
  return resp.map(r => r.payload.text);
}

export async function callLLM(emailText, docs) {
  const systemPrompt = `
You are an Email Analyzer.
Policies:
${docs.join("\n")}
Email:
${emailText}
Return JSON with keys:
category, priority, confidence, actions, reason, mom_missing, suggested_reply, tags
`;
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: systemPrompt }],
    response_format: { type: "json_object" }
  });
  return JSON.parse(completion.choices[0].message.content);
}
