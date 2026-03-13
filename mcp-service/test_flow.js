import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import { sendEmail } from './helpers/notifications.js';

async function testFullFlow() {
    console.log('--- Testing Full Notification Flow ---');
    try {
        const result = await sendEmail({
            to: 'sushobhan.jana@intglobal.com',
            subject: 'Test Full Flow WhatsApp',
            text: 'This is a test message to verify the WhatsApp recipient logic.'
        });
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Flow failed:', error);
    }
    console.log('---------------------------------------');
}

testFullFlow();
