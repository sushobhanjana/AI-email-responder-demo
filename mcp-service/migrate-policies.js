import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POLICY_DIR = path.join(__dirname, 'policy_docs');
const STRAPI_URL = 'http://localhost:1337/api/policies';

async function migrate() {
    console.log('Starting migration to Strapi...');

    if (!fs.existsSync(POLICY_DIR)) {
        console.error(`Policy directory not found: ${POLICY_DIR}`);
        return;
    }

    const files = fs.readdirSync(POLICY_DIR).filter(f => f.endsWith('.md'));
    console.log(`Found ${files.length} policy files.`);

    for (const file of files) {
        const content = fs.readFileSync(path.join(POLICY_DIR, file), 'utf-8');
        const fileBase = file.replace('.md', '');

        // Convert "start_date_policy" -> "Start Date Policy"
        const title = fileBase
            .split(/[_-]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        // Convert "start_date_policy" -> "start-date-policy"
        const slug = fileBase.replace(/_/g, '-').toLowerCase();

        console.log(`Migrating: ${title} (${slug})...`);

        try {
            // Check if exists first to avoid duplicates (optional, but good)
            const exists = await axios.get(`${STRAPI_URL}?filters[slug][$eq]=${slug}`);
            if (exists.data.data.length > 0) {
                console.log(`⚠️ Skipped (already exists): ${file}`);
                continue;
            }

            await axios.post(STRAPI_URL, {
                data: {
                    title: title,
                    slug: slug,
                    content: content,
                    publishedAt: new Date()
                }
            });
            console.log(`✅ Success: ${file}`);
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                console.error("❌ Connection refused. Is Strapi running?");
                process.exit(1);
            }
            if (error.response) {
                console.error(`❌ Error (${file}):`, JSON.stringify(error.response.data, null, 2));
            } else {
                console.error(`❌ Error (${file}):`, error.message);
            }
        }
    }
}

migrate();
