
import axios from 'axios';
import dotenv from "dotenv";
dotenv.config({ path: '../.env' });

async function checkModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("No API KEY");
        return;
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        const response = await axios.get(url);
        const models = response.data.models;

        console.log("Available Models:");
        models.forEach(m => {
            if (m.name.includes('gemini')) {
                console.log(`- ${m.name}`);
            }
        });
    } catch (e) {
        console.error("Error listing models:", e.message);
        if (e.response) {
            console.error(e.response.data);
        }
    }
}

checkModels();
