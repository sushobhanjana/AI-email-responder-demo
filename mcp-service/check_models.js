import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from 'fs';

dotenv.config({ path: '../.env' });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // For v1beta, we might need to access the model list differently or just try to instantiate and get info.
    // The SDK doesn't have a direct 'listModels' method exposed easily on the main class in some versions, 
    // but usually it's via the API. 
    // Actually, the SDK might not expose listModels directly in the helper.
    // Let's try a direct REST call using fetch if the SDK doesn't make it obvious, 
    // but let's try to see if we can just use a known working model like 'gemini-pro'.

    // However, let's try to use the API key to fetch the list via REST to be sure.
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        let output = "Available Models:\n";
        if (data.models) {
            data.models.forEach(m => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                    output += `- ${m.name}\n`;
                }
            });
        } else {
            output += "No models found or error: " + JSON.stringify(data);
        }
        fs.writeFileSync('models_output.txt', output);
        console.log("Wrote to models_output.txt");
    } catch (error) {
        fs.writeFileSync('models_output.txt', "Error: " + error.message);
    }
}

listModels();
