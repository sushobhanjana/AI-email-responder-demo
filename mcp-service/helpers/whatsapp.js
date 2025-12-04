import fetch from 'node-fetch';

export async function sendWhatsAppMessage(to, text) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
        console.log('[WhatsApp] Credentials missing. Skipping message send.');
        console.log(`[Mock WhatsApp] To: ${to}, Message: ${text}`);
        return { message: 'Mock WhatsApp sent (missing credentials)' };
    }

    const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: { body: text }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(JSON.stringify(data));
        }

        console.log('[WhatsApp] Message sent:', data.messages?.[0]?.id);
        return data;
    } catch (error) {
        console.error('[WhatsApp] Error sending message:', error);
        throw error;
    }
}
