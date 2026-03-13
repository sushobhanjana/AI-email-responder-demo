import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendWhatsAppMessage } from './helpers/whatsapp.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
    // Manually testing the user's reported number
    const testPhone = '+919051776683';
    console.log("Testing with phone:", testPhone);
    const customMessage = "Verification test for +919051776683";

    try {
        const result = await sendWhatsAppMessage(testPhone, customMessage);
        console.log("Test execution successful. SID:", result?.sid);
    } catch (error) {
        console.error("Test failed:", error);
    }
}

run();
