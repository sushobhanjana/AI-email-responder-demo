import { google } from 'googleapis';
import { promises as fs } from 'fs';
import path from 'path';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

// Exported for web flow
export async function getOAuthClient() {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;

  // Create an OAuth2 client with the given credentials
  // We use the first redirect URI from the file, but for web flow we might need to override it dynamically 
  // if localhost:3001/auth/google/callback isn't the first one. 
  // We force the callback URL to match our route.
  const redirectUri = 'http://localhost:3001/auth/google/callback';

  return new google.auth.OAuth2(
    key.client_id,
    key.client_secret,
    redirectUri
  );
}

export async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }

  // If no token exists, we can't auto-authorize in headless mode easily without the web flow or CLI interaction.
  // For the web service, we might just return null or throw, prompting the user to go to /auth/google
  // But to keep backward compatibility with CLI usage (if any), we keep the error.
  throw new Error(
    'Failed to load credentials from token.json. ' +
    'The file might be missing, corrupted, or have incorrect permissions. ' +
    'Please authenticate via the Dashboard or run: node mcp-service/get-gmail-token.js'
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
    // console.error("Failed to load token.json. Error:", err.message);
    return null;
  }
}

async function listMessages(auth, { limit = 10, query = 'is:unread' } = {}) {
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: limit,
  });
  const messages = res.data.messages;
  if (!messages || messages.length === 0) {
    return [];
  }

  const messagePromises = messages.map(message => {
    return gmail.users.messages.get({
      userId: 'me',
      id: message.id,
      format: 'full',
    });
  });

  const results = await Promise.all(messagePromises);

  return results.map(res => parseMessage(res.data));
}

function parseMessage(message) {
  const headers = message.payload.headers;
  const subject = headers.find(header => header.name === 'Subject')?.value || '(No Subject)';
  const from = headers.find(header => header.name === 'From')?.value || '(Unknown Sender)';

  let bodyPlain = '';

  if (message.payload.parts) {
    const plainTextPart = message.payload.parts.find(part => part.mimeType === 'text/plain');
    if (plainTextPart && plainTextPart.body.data) {
      bodyPlain = Buffer.from(plainTextPart.body.data, 'base64').toString('utf8');
    }
  } else if (message.payload.body && message.payload.body.data) {
    bodyPlain = Buffer.from(message.payload.body.data, 'base64').toString('utf8');
  }

  return {
    id: message.id,
    threadId: message.threadId,
    subject,
    from,
    bodyPlain,
  };
}

export { authorize, listMessages, SCOPES };
