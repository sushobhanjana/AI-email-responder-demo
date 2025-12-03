import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { QdrantClient } from "@qdrant/js-client-rest";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Load env from parent dir
dotenv.config({ path: '../.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POLICY_DIR = path.join(__dirname, 'policy_docs');
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'policies';

const client = new QdrantClient({ url: process.env.QDRANT_URL });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function embedText(text) {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
}

async function seed() {
    console.log(`Connecting to Qdrant at ${process.env.QDRANT_URL}...`);

    // 1. Ensure Collection Exists
    try {
        await client.getCollection(COLLECTION_NAME);
        console.log(`Collection '${COLLECTION_NAME}' exists.`);
    } catch (e) {
        if (e.status === 404) {
            console.log(`Creating collection '${COLLECTION_NAME}'...`);
            await client.createCollection(COLLECTION_NAME, {
                vectors: { size: 768, distance: 'Cosine' } // text-embedding-004 is 768 dim
            });
        } else {
            throw e;
        }
    }

    // 2. Read Policy Files
    const files = fs.readdirSync(POLICY_DIR).filter(f => f.endsWith('.md'));
    console.log(`Found ${files.length} policy files.`);

    const points = [];
    let idCounter = 1;

    for (const file of files) {
        const content = fs.readFileSync(path.join(POLICY_DIR, file), 'utf-8');
        console.log(`Processing ${file}...`);

        // For simplicity, we embed the whole file as one chunk.
        // In production, you might split by headers.
        const embedding = await embedText(content);

        points.push({
            id: idCounter++,
            vector: embedding,
            payload: {
                source: file,
                text: content,
                type: 'policy'
            }
        });
    }

    // 3. Upsert to Qdrant
    if (points.length > 0) {
        await client.upsert(COLLECTION_NAME, {
            wait: true,
            points: points
        });
        console.log(`Successfully seeded ${points.length} documents.`);
    } else {
        console.log('No documents to seed.');
    }
}

seed().catch(console.error);
