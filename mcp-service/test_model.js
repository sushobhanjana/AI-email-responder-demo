
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config({ path: '../.env' });

async function testModel(modelName) {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log(`Testing ${modelName}...`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello");
        console.log(`✅ SUCCESS: ${modelName} works! Response: ${result.response.text().substring(0, 20)}...`);
        return true;
    } catch (e) {
        let msg = e.message;
        if (e.message.includes("429") || e.message.includes("Quota")) {
            try { msg = e.message.split('[')[1] || e.message; } catch { }
            console.log(`❌ FAILED: ${modelName} (Quota/Limit Hit: ${msg})`);
        } else {
            console.log(`❌ FAILED: ${modelName} (Error: ${msg.split('\n')[0]})`);
        }
        return false;
    }
}

async function list() {
    const candidates = [
        "gemini-2.5-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-exp-1206",
        "gemma-3-27b-it"
    ];

    console.log("Searching for a working model...");
    for (const m of candidates) {
        if (await testModel(m)) {
            console.log(`\n🎉 FOUND WORKING MODEL: ${m}`);
            break;
        }
    }
}

list();
