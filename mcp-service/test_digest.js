import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import { generateAndSendDigest } from './helpers/notifications.js';
import { getSetting } from './helpers/database.js';

async function testDigestFlow() {
    console.log('--- Testing Improved Digest Flow ---');
    const recipient = getSetting('DEFAULT_RECIPIENT') || process.env.WHATSAPP_RECIPIENT_PHONE;

    if (!recipient) {
        console.error("No recipient found for testing.");
        return;
    }

    try {
        const result = await generateAndSendDigest(recipient);
        console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Digest failed:', error);
    }
    console.log('------------------------------------');
}

testDigestFlow();
