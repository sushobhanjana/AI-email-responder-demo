import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendWhatsAppMessage } from './helpers/whatsapp.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
    const originalPhone = process.env.WHATSAPP_RECIPIENT_PHONE || '+919932116301';
    console.log("Testing with phone:", originalPhone);
    const customMessage = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

    try {
        await sendWhatsAppMessage(originalPhone, customMessage);
        console.log("Test execution triggered.");
    } catch (error) {
        console.error("Test failed:", error);
    }
}

run();
