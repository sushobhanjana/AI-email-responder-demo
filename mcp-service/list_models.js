
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config({ path: '../.env' });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    // Note: getGenerativeModel doesn't list models, we need a different approach or just try to generate and see error, 
    // but better to use the specific list method if available in the SDK or just HTTP.
    // The SDK doesn't have a direct listModels method on the client instance in some versions, 
    // but usually it is accessible via the API.
    // Actually, checking docs (mentally), standard way is likely not exposed simply in the high level helper 
    // without a model instance, but let's try to just run a simple generation with a few candidates.

    // However, I will rely on the error message which says "Call ListModels".
    // I'll try to use a direct REST call or a script that iterates common names.

    console.log("Checking common model names...");
    const candidates = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-001",
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro",
        "gemini-1.0-pro"
    ];

    for (const name of candidates) {
        try {
            console.log(`Testing ${name}...`);
            const m = genAI.getGenerativeModel({ model: name });
            const result = await m.generateContent("Hello");
            console.log(`SUCCESS: ${name}`);
            return;
        } catch (e) {
            console.log(`FAILED: ${name} - ${e.message.split('\n')[0]}`);
        }
    }
}

listModels();
