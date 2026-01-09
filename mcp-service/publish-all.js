import axios from 'axios';
const url = 'http://localhost:1337/api/policies';

async function publishAll() {
    try {
        const res = await axios.get(url + '?publicationState=preview');
        for (const p of res.data.data) {
            await axios.put(url + '/' + p.documentId, { data: { publishedAt: new Date() } });
            console.log('✅ Published:', p.title);
        }
        console.log('Finished publishing all policies.');
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

publishAll();
