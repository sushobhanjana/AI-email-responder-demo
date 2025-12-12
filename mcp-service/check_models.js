import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Dummy init to get client
        // The SDK doesn't expose listModels directly on the instance easily in all versions, 
        // but we can try to use the model manager if available, or just catch the error which implies connection works.
        // Actually, checking documentation, we should try to generic list if possible, or just print what we can.
        // Let's use the API KEY to simple fetch via REST if SDK is obscure, but SDK usually has `listModels`.
        // Wait, the error says "Call ListModels". In node SDK: nothing top level?
        // Let's try a direct REST call relative to the key to be sure, or use a known script pattern.

        // Attempting REST call for certainty as SDK method signatures vary by version
        const key = process.env.GEMINI_API_KEY;
        if (!key) throw new Error("No API Key");

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${m.name}`);
                }
            });
        } else {
            console.log("No models found or error:", JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
