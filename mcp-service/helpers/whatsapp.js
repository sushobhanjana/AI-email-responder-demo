import twilio from 'twilio';

/**
 * Sends a WhatsApp message using Twilio's API.
 * 
 * @param {string} to - Recipient phone number (e.g., '+919932116301')
 * @param {string} text - Message content
 */
export async function sendWhatsAppMessage(to, text) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromPhone) {
        console.log('[WhatsApp] Twilio credentials missing. Skipping message send.');
        console.log(`[Mock WhatsApp] To: ${to}, Message: ${text}`);
        return { message: 'Mock WhatsApp sent (missing credentials)' };
    }

    const client = twilio(accountSid, authToken);

    const formattedTo = `whatsapp:${to.trim().replace(/\D/g, '').startsWith('+') ? to.trim().replace(/\D/g, '') : '+' + to.trim().replace(/\D/g, '')}`;
    console.log(`[WhatsApp] Sending to: ${formattedTo}, from: ${fromPhone}`);

    try {
        const response = await client.messages.create({
            from: fromPhone,
            body: text,
            to: formattedTo
        });

        console.log(`[WhatsApp] Success! Message SID: ${response.sid}`);
        return response;
    } catch (error) {
        console.error('[WhatsApp] Error sending message via Twilio:', error);
        throw error;
    }
}
