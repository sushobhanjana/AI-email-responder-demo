import { google } from 'googleapis';
import { promises as fs } from 'fs';
import path from 'path';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  throw new Error(
    'Failed to load credentials from token.json. ' +
    'The file might be missing, corrupted, or have incorrect permissions. ' +
    'Please try generating it again by running: node mcp-service/get-gmail-token.js'
  );
}

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    console.error("Failed to load token.json. Error:", err.message);
    return null;
  }
}

async function listMessages(auth) {
    const gmail = google.gmail({version: 'v1', auth});
    const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread',
    });
    const messages = res.data.messages;
    if (!messages || messages.length === 0) {
        return [];
    }
    
    const messagePromises = messages.map(message => {
        return gmail.users.messages.get({
            userId: 'me',
            id: message.id,
        });
    });

    const results = await Promise.all(messagePromises);
    return results.map(res => res.data);
}

export { authorize, listMessages };
