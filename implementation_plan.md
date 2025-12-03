# AI Email Analyzer & Responder System - Implementation Plan

Complete the AI-powered email analyzer system with intelligent classification, MoM tracking, and automated reminders using n8n orchestration, RAG-powered context, and MCP reasoning.

## User Review Required

> [!IMPORTANT]
> **Classification Accuracy**: The system will use LLM-based classification combined with rule-based detection. Initial accuracy may vary and might require tuning the policy documents and classification prompts based on real-world email patterns.

> [!IMPORTANT]
> **Gmail API Credentials**: The system assumes Gmail OAuth credentials are already configured (credentials.json and token.json exist). If you want to add Outlook support, you'll need to provide Microsoft Graph API credentials.

> [!WARNING]
> **Email Notification Setup**: For the reminder system to send email notifications, you'll need to provide SMTP credentials (Gmail App Password or custom SMTP server details).

> [!NOTE]
> **Optional Components**: The dashboard frontend and Slack/Teams integrations are optional. Please confirm which notification channels you want to implement (Email, Slack, Teams, or Dashboard).

---

## Proposed Changes

### MCP Service - Classification Engine

#### [MODIFY] [vector.js](file:///e:/AI-email-responder-demo/mcp-service/helpers/vector.js)

Enhance the LLM classification prompt to include all required classification categories:
- Update `callLLM` function to request structured output with hierarchy/client detection, escalation tone analysis, urgent task detection, and MoM status
- Add more detailed system prompt with classification examples
- Ensure JSON response includes all required fields: `category`, `priority`, `confidence`, `actions`, `reason`, `mom_missing`, `suggested_reply`, `tags`, `is_hierarchy`, `is_client`, `is_escalation`, `is_urgent`

#### [NEW] [classifier.js](file:///e:/AI-email-responder-demo/mcp-service/helpers/classifier.js)

Create dedicated email classifier with hybrid approach:
- Rule-based classification for simple patterns (domain matching, keyword detection)
- LLM-based classification for complex tone analysis
- Priority scoring algorithm (High/Medium/Low)
- Email metadata extraction and enrichment
- MoM detection logic (meeting keywords + follow-up check)

#### [NEW] [mom-tracker.js](file:///e:/AI-email-responder-demo/mcp-service/helpers/mom-tracker.js)

Implement MoM (Minutes of Meeting) tracker:
- Detect meeting-related emails using keywords ("Meeting", "Call", "Sync", "Review", "Discussion")
- Track meeting metadata (date, participants, subject)
- Check for follow-up emails with MoM keywords ("MoM", "Minutes", "Summary", "Action Items")
- Store meeting logs in database with MoM status
- Generate reminders for missing MoMs (24h after meeting)

#### [NEW] [database.js](file:///e:/AI-email-responder-demo/mcp-service/helpers/database.js)

Create SQLite database layer:
- Schema for email logs (id, email_id, thread_id, sender, subject, category, priority, timestamp, status)
- Schema for reminder queue (id, email_id, reminder_type, scheduled_time, status, retry_count)
- Schema for MoM tracker (id, meeting_id, meeting_date, participants, subject, mom_received, mom_email_id, reminder_sent)
- CRUD operations for all entities
- Query functions for pending reminders and missing MoMs

#### [NEW] [notifications.js](file:///e:/AI-email-responder-demo/mcp-service/helpers/notifications.js)

Build notification system:
- Email digest generator (HTML template for daily summary)
- SMTP sender using nodemailer
- Slack webhook integration (optional)
- Teams webhook integration (optional)
- Template system for different notification types (escalation, urgent, missing MoM)

---

### Policy Documents - Classification Rules

#### [MODIFY] [sample-policy.md](file:///e:/AI-email-responder-demo/mcp-service/policy_docs/sample-policy.md)

Expand policy document with comprehensive classification rules:
- Hierarchy detection: list of internal domains and hierarchy email patterns
- Client identification: list of client domains and VIP contacts
- Escalation keywords: comprehensive list with examples
- Urgent task keywords: priority indicators
- MoM policy: meeting detection rules and follow-up requirements

#### [NEW] [hierarchy-policy.md](file:///e:/AI-email-responder-demo/mcp-service/policy_docs/hierarchy-policy.md)

Define hierarchy and client email policies:
- Internal company domains (e.g., @yourcompany.com)
- Management hierarchy levels
- Client domain whitelist
- VIP contact list

#### [NEW] [escalation-policy.md](file:///e:/AI-email-responder-demo/mcp-service/policy_docs/escalation-policy.md)

Define escalation detection rules:
- Negative sentiment keywords
- Complaint indicators
- Dissatisfaction phrases
- Tone analysis guidelines

#### [NEW] [mom-policy.md](file:///e:/AI-email-responder-demo/mcp-service/policy_docs/mom-policy.md)

Define MoM tracking policies:
- Meeting subject keywords
- Required MoM follow-up timeframe (24h)
- MoM email identifiers
- Exception rules (1:1 calls, informal chats)

---

### API Endpoints

#### [MODIFY] [index.js](file:///e:/AI-email-responder-demo/mcp-service/index.js)

Add new endpoints and enhance existing ones:
- **POST /analyze-email**: Enhance with full classification pipeline
- **GET /get-unread-emails**: Add date range filtering (last 7-14 days)
- **POST /check-mom**: New endpoint to check MoM status for a meeting
- **GET /pending-reminders**: Fetch pending reminder queue
- **POST /send-digest**: Trigger daily digest email
- **GET /email-logs**: View classified email history
- **POST /embed-policies**: Trigger policy document embedding into Qdrant

---

### Database & Storage

#### [NEW] [schema.sql](file:///e:/AI-email-responder-demo/mcp-service/schema.sql)

SQLite database schema definitions with all required tables.

#### [NEW] [seed-policies.js](file:///e:/AI-email-responder-demo/mcp-service/seed-policies.js)

Script to embed policy documents into Qdrant vector database:
- Read all policy markdown files
- Chunk documents into semantic sections
- Generate embeddings using OpenAI
- Upload to Qdrant collection

---

### n8n Workflows

#### [MODIFY] [workflow.json](file:///e:/AI-email-responder-demo/workflow.json)

Enhance existing workflow with complete pipeline:
- Add cron trigger (every 2 hours)
- Add date filtering for emails (last 7-14 days)
- Add conditional routing based on classification
- Add notification nodes (Email, Slack)
- Add database logging
- Add error handling and retry logic

#### [NEW] [digest-workflow.json](file:///e:/AI-email-responder-demo/digest-workflow.json)

Create daily digest workflow:
- Cron trigger (daily at 8 AM)
- Fetch pending reminders from database
- Group by priority and category
- Generate HTML digest
- Send via email

#### [NEW] [mom-reminder-workflow.json](file:///e:/AI-email-responder-demo/mom-reminder-workflow.json)

Create MoM reminder workflow:
- Cron trigger (every 4 hours)
- Check meetings without MoM (>24h old)
- Generate reminder messages
- Send notifications
- Update reminder status

---

### Configuration & Dependencies

#### [MODIFY] [package.json](file:///e:/AI-email-responder-demo/mcp-service/package.json)

Add new dependencies:
- `better-sqlite3` - SQLite database
- `nodemailer` - Email notifications
- `@qdrant/js-client-rest` - Qdrant client (if not already using qdrant-js)
- `marked` - Markdown parsing for policies
- `date-fns` - Date manipulation

#### [NEW] [.env.example](file:///e:/AI-email-responder-demo/mcp-service/.env.example)

Document all required environment variables:
- OpenAI API key
- Qdrant URL and collection name
- Gmail credentials path
- SMTP configuration
- Slack/Teams webhooks (optional)
- MCP secret for authentication

---

### Optional Dashboard (Frontend)

#### [MODIFY] Frontend files (if implementing dashboard)

If you want the optional dashboard, I can create:
- Email log viewer with filtering
- Classification statistics
- MoM tracker status board
- Reminder queue management
- Manual email analysis interface

---

## Verification Plan

### Automated Tests

1. **Unit Tests for Classification** (New test file)
   - Test rule-based classifier with sample emails
   - Verify priority scoring algorithm
   - Test MoM detection logic
   - Command: `npm test` (after creating test suite with Jest/Mocha)

2. **Database Operations** (New test file)
   - Test CRUD operations for all schemas
   - Verify reminder queue queries
   - Test MoM tracker log integrity
   - Command: `npm run test:db`

3. **Policy Embedding** (Manual verification)
   - Run seed script: `node mcp-service/seed-policies.js`
   - Verify Qdrant collection contains policy documents
   - Test retrieval with sample queries
   - Command: `curl http://localhost:6333/collections/email-policies/points/count`

### Integration Tests

1. **End-to-End Email Analysis**
   - Start MCP service: `npm run dev`
   - Trigger workflow in n8n manually
   - Verify emails are fetched, analyzed, and logged
   - Check classification results in console/logs
   - Verify database entries created

2. **MoM Tracker Flow**
   - Send test meeting invite email to Gmail
   - Wait 30 seconds, run workflow
   - Verify meeting logged in database
   - Check reminder scheduled for missing MoM
   - Command: Query SQLite DB: `sqlite3 mcp-service/emails.db "SELECT * FROM mom_tracker;"`

3. **Notification System**
   - Configure SMTP credentials in .env
   - Run digest workflow manually in n8n
   - Verify email received with proper formatting
   - Test Slack webhook (if configured)

### Manual Verification

**Prerequisites:**
- Qdrant running: `docker-compose up -d qdrant`
- n8n running: `docker-compose up -d n8n`
- MCP service running: `cd mcp-service && npm run dev`
- Gmail credentials configured

**Test Scenarios:**

1. **Hierarchy Email Detection**
   - Send an email from your company domain to your Gmail
   - Run n8n workflow
   - Expected: Email classified as "Hierarchy" with appropriate priority

2. **Escalation Detection**
   - Send a test email with escalation keywords ("disappointed with delay")
   - Run workflow
   - Expected: Classified as "Escalation", priority=High, notification sent

3. **MoM Tracking**
   - Send an email with subject "Meeting with Client ABC - 24 Nov 2025"
   - Wait 5 minutes (simulating no MoM sent)
   - Run MoM reminder workflow
   - Expected: Reminder generated for missing MoM

4. **Daily Digest**
   - Accumulate several classified emails
   - Trigger digest workflow manually
   - Expected: Receive formatted email summary with categorized emails

5. **Browser Test (if Dashboard implemented)**
   - Navigate to frontend dashboard
   - Verify email logs displayed
   - Test filtering by category/priority
   - Check MoM tracker status board

**Manual Test Checklist:**
- [ ] Gmail API fetching emails successfully
- [ ] Policy documents embedded in Qdrant
- [ ] Classification returning all required fields
- [ ] Priority scoring working correctly
- [ ] Database logging emails and reminders
- [ ] Email notifications sending properly
- [ ] n8n workflows executing without errors
- [ ] MoM tracker detecting meetings and follow-ups

---

## Implementation Order

1. **Phase 1: Core Classification** (Database, Classifier, Enhanced LLM)
2. **Phase 2: MoM Tracker** (MoM detection, tracking, reminders)
3. **Phase 3: Notifications** (Email digest, SMTP setup, templates)
4. **Phase 4: Policy Updates** (Expand policy docs, embed in Qdrant)
5. **Phase 5: n8n Workflows** (Enhanced workflows, cron triggers)
6. **Phase 6: Testing & Refinement** (End-to-end testing, tuning)
7. **Phase 7: Optional Dashboard** (Frontend if requested)

---

## Questions for User

1. **Notification Preferences**: Which channels do you want? (Email digest, Slack, Teams, or all three?)
2. **SMTP Configuration**: Do you have SMTP credentials ready, or should I help set up Gmail App Password?
3. **Dashboard**: Do you want the optional frontend dashboard, or is CLI + notifications sufficient?
4. **Hierarchy/Client List**: Can you provide your company domain and any known client domains for the policy files?
5. **Testing**: Do you want me to create automated tests (Jest), or focus on manual integration testing?
