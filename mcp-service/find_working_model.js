
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from 'axios';
import dotenv from "dotenv";
dotenv.config({ path: '../.env' });

async function findWorkingModel() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("No API KEY");
        return;
    }

    let models = [];
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        const response = await axios.get(url);
        models = response.data.models.map(m => m.name.replace('models/', ''));
        console.log(`Found ${models.length} models to test.`);
    } catch (e) {
        console.error("Error fetching model list:", e.message);
        return; // Cannot proceed without list
    }

    // Prioritize likely candidates to save time
    const priority = [
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash-001',
        'gemini-1.5-pro',
        'gemini-2.0-flash-lite-preview-02-05', // Example current
        'gemini-2.0-pro-exp-02-05'
    ];

    // Sort models: priority ones first, then others
    models.sort((a, b) => {
        const aIdx = priority.indexOf(a);
        const bIdx = priority.indexOf(b);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return 0;
    });

    const genAI = new GoogleGenerativeAI(key);

    console.log("Testing models for availability...");

    for (const modelName of models) {
        // Skip vision/embedding only models if obvious
        if (modelName.includes('vision') || modelName.includes('embedding')) continue;

        try {
            process.stdout.write(`Testing ${modelName} ... `);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Test");
            const response = await result.response;
            const text = response.text();

            if (text) {
                console.log(`\n✅ SUCCESS! Working model found: ${modelName}`);
                console.log(`Response: ${text.substring(0, 20)}...`);
                return; // Stop after finding the first working one
            }
        } catch (e) {
            console.log(`❌ FAILED: ${e.message.split('\n')[0]}`);
            // Special handling for 429 to avoid hammering if global quota
            if (e.message.includes('429')) {
                // If it's a rate limit, we might want to pause? But here we just want to find *one* that works.
            }
        }
    }

    console.log("❌ No working models found.");
}

findWorkingModel();
