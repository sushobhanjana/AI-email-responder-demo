import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function sendWhatsAppMessage(to, text) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    console.log(`Sending to: '${to}'`);

    if (!token || !phoneId) {
        console.error("Missing token or phoneId");
        return;
    }

    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

    try {
        const body = {
            messaging_product: 'whatsapp',
            to: to.replace(/\D/g, ''),
            type: 'text',
            text: { body: text }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Error Response:", JSON.stringify(data, null, 2));
        } else {
            console.log("Success:", JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("Fetch Error:", error);
    }
}

async function run() {
    const originalPhone = process.env.WHATSAPP_RECIPIENT_PHONE;
    console.log("Environment Phone:", originalPhone);
    await sendWhatsAppMessage(originalPhone, "Test message re-verification");
}

run();
