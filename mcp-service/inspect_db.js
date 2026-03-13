import { getDb } from './helpers/database.js';

const db = getDb();
const settings = db.prepare('SELECT * FROM global_settings').all();
console.log('--- Current Global Settings ---');
console.table(settings);
console.log('-------------------------------');
