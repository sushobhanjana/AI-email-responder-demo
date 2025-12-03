# AI Email Analyzer - System Architecture

This document provides a visual overview of the complete system architecture and data flow.

## High-Level Architecture

```mermaid
flowchart TD
    subgraph External["External Services"]
        Gmail[Gmail API]
        Slack[Slack Webhook]
        Teams[Teams Webhook]
        SMTP[SMTP Server]
    end
    
    subgraph n8n["n8n Workflow Orchestration"]
        Cron[Cron Trigger<br/>Every 2 hours]
        FetchNode[Fetch Emails Node]
        LoopNode[Loop Over Emails]
        AnalyzeNode[HTTP: Analyze Email]
        FilterNode[Filter by Category]
        NotifyNode[Notification Nodes]
        DigestCron[Daily Digest Cron<br/>8 AM]
        MoMCron[MoM Check Cron<br/>Every 4 hours]
    end
    
    subgraph MCP["MCP Service (Express API)"]
        API[REST API Endpoints]
        ClassifierEngine[Classification Engine]
        MoMTracker[MoM Tracker]
        DBLayer[Database Layer]
        NotificationEngine[Notification Engine]
    end
    
    subgraph RAG["RAG Knowledge Layer"]
        Qdrant[(Qdrant Vector DB)]
        Policies[Policy Documents<br/>- Hierarchy<br/>- Escalation<br/>- MoM Rules<br/>- Client List]
    end
    
    subgraph LLM["AI Processing"]
        OpenAI[OpenAI GPT-4o-mini]
        Embeddings[Text Embeddings<br/>text-embedding-3-small]
    end
    
    subgraph Storage["Data Storage"]
        SQLite[(SQLite Database<br/>- Email Logs<br/>- Reminder Queue<br/>- MoM Tracker)]
    end
    
    subgraph Dashboard["Optional Dashboard"]
        Frontend[React Frontend<br/>- Email Viewer<br/>- Analytics<br/>- MoM Board]
    end
    
    %% Main Flow
    Cron -->|Trigger| FetchNode
    FetchNode -->|HTTP Request| API
    API --> Gmail
    Gmail -->|Emails JSON| API
    API -->|Emails Array| FetchNode
    FetchNode --> LoopNode
    LoopNode -->|Single Email| AnalyzeNode
    AnalyzeNode -->|HTTP POST| API
    
    %% MCP Processing
    API --> ClassifierEngine
    ClassifierEngine -->|Query| Embeddings
    Embeddings -->|Generate Vector| Qdrant
    Qdrant -->|Retrieve Context| ClassifierEngine
    ClassifierEngine -->|Prompt + Context| OpenAI
    OpenAI -->|Classification Result| ClassifierEngine
    ClassifierEngine --> MoMTracker
    MoMTracker --> DBLayer
    DBLayer --> SQLite
    
    %% Results back to n8n
    ClassifierEngine -->|JSON Result| API
    API -->|Classification| AnalyzeNode
    AnalyzeNode --> FilterNode
    FilterNode -->|High Priority<br/>Escalation<br/>Missing MoM| NotifyNode
    NotifyNode --> NotificationEngine
    
    %% Notifications
    NotificationEngine --> SMTP
    NotificationEngine --> Slack
    NotificationEngine --> Teams
    
    %% Digest Flow
    DigestCron --> NotifyNode
    MoMCron --> API
    API --> MoMTracker
    
    %% Dashboard
    Frontend -.->|Optional| API
    API -.-> Frontend
    
    %% Policy Seeding
    Policies -.->|Embed Once| Embeddings
    Embeddings -.-> Qdrant
    
    style MCP fill:#e1f5ff
    style RAG fill:#fff4e6
    style LLM fill:#f3e5f5
    style Storage fill:#e8f5e9
    style External fill:#fce4ec
    style Dashboard fill:#f1f8e9
```

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant Cron as n8n Cron
    participant n8n as n8n Workflow
    participant MCP as MCP Service
    participant RAG as Qdrant RAG
    participant LLM as OpenAI GPT
    participant DB as SQLite DB
    participant Email as Email Service
    
    Note over Cron,Email: Email Analysis Flow (Every 2 hours)
    
    Cron->>n8n: Trigger workflow
    n8n->>MCP: GET /get-unread-emails
    MCP->>Email: Fetch unread (last 7 days)
    Email-->>MCP: Email list
    MCP-->>n8n: Emails array
    
    loop For each email
        n8n->>MCP: POST /analyze-email
        MCP->>RAG: Retrieve policies for context
        RAG-->>MCP: Policy documents
        MCP->>LLM: Classify email + context
        LLM-->>MCP: Classification result
        MCP->>DB: Log email + classification
        MCP-->>n8n: Analysis JSON
        
        alt High Priority / Escalation
            n8n->>MCP: POST /send-notification
            MCP->>Email: Send immediate alert
        end
    end
    
    Note over Cron,Email: Daily Digest Flow (8 AM)
    
    Cron->>n8n: Trigger digest workflow
    n8n->>MCP: GET /pending-reminders
    MCP->>DB: Query pending items
    DB-->>MCP: Reminder list
    MCP->>MCP: Generate HTML digest
    MCP->>Email: Send digest email
    
    Note over Cron,Email: MoM Reminder Flow (Every 4 hours)
    
    Cron->>n8n: Trigger MoM check
    n8n->>MCP: GET /check-mom
    MCP->>DB: Find meetings without MoM
    DB-->>MCP: Missing MoM list
    
    loop For each missing MoM
        MCP->>Email: Send reminder
        MCP->>DB: Update reminder status
    end
```

## Component Responsibilities

### n8n Workflow Orchestration
- **Responsibility**: Trigger scheduled jobs, orchestrate data flow between services
- **Workflows**:
  1. Email Analysis (every 2 hours)
  2. Daily Digest (8 AM daily)
  3. MoM Reminders (every 4 hours)

### MCP Service (Backend API)
- **Responsibility**: Core business logic, email classification, MoM tracking
- **Key Endpoints**:
  - `POST /analyze-email` - Classify single email
  - `GET /get-unread-emails` - Fetch Gmail inbox
  - `POST /check-mom` - Check MoM status
  - `GET /pending-reminders` - Get reminder queue
  - `POST /send-digest` - Trigger digest
  - `POST /embed-policies` - Seed policy docs

### RAG Knowledge Layer (Qdrant)
- **Responsibility**: Store and retrieve classification policies
- **Collections**:
  - `email-policies` - Vector embeddings of policy documents
- **Policy Types**:
  - Hierarchy/Client rules
  - Escalation keywords
  - MoM requirements
  - Urgent task indicators

### AI Processing (OpenAI)
- **Responsibility**: Text understanding and classification
- **Models**:
  - `text-embedding-3-small` - Policy document embeddings
  - `gpt-4o-mini` - Email classification and reasoning

### Database (SQLite)
- **Responsibility**: Persistent storage for logs and tracking
- **Tables**:
  - `email_logs` - All analyzed emails with classifications
  - `reminder_queue` - Pending notifications
  - `mom_tracker` - Meeting and MoM tracking

### Notification Engine
- **Responsibility**: Send alerts via multiple channels
- **Channels**:
  - Email (SMTP) - Digest and immediate alerts
  - Slack - Real-time notifications
  - Teams - Real-time notifications

## Classification Logic

```mermaid
flowchart TD
    Start[New Email] --> Extract[Extract Metadata]
    Extract --> RuleBased{Rule-Based<br/>Classification}
    
    RuleBased -->|Match Domain| Hierarchy[Category: Hierarchy]
    RuleBased -->|Client Domain| Client[Category: Client]
    RuleBased -->|No Match| LLMCheck[LLM Analysis]
    
    LLMCheck --> RAGRetrieval[Retrieve Policy Context]
    RAGRetrieval --> GPTClassify[GPT-4o Classification]
    GPTClassify --> Result{Classification Result}
    
    Result --> Category[Assign Category]
    Category --> Priority[Calculate Priority]
    Priority --> MoMCheck{Meeting Keywords?}
    
    MoMCheck -->|Yes| TrackMeeting[Add to MoM Tracker]
    MoMCheck -->|No| SkipMoM[Skip MoM Tracking]
    
    TrackMeeting --> CheckMoM{MoM Follow-up<br/>Received?}
    CheckMoM -->|No + >24h| AddReminder[Add to Reminder Queue]
    CheckMoM -->|Yes| Complete[Complete]
    
    SkipMoM --> LogDB[Log to Database]
    AddReminder --> LogDB
    Complete --> LogDB
    LogDB --> Notify{High Priority?}
    
    Notify -->|Yes| SendAlert[Send Immediate Alert]
    Notify -->|No| AddToDigest[Add to Daily Digest]
    
    SendAlert --> End[Done]
    AddToDigest --> End
```

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Orchestration** | n8n | Workflow automation, cron scheduling |
| **Backend** | Node.js + Express | MCP service API |
| **Email API** | Gmail API (OAuth 2.0) | Email fetching |
| **Vector DB** | Qdrant | RAG knowledge storage |
| **LLM** | OpenAI GPT-4o-mini | Classification reasoning |
| **Embeddings** | text-embedding-3-small | Policy document vectors |
| **Database** | SQLite | Email logs, reminders, MoM tracking |
| **Notifications** | nodemailer, Slack/Teams APIs | Multi-channel alerts |
| **Frontend** | React (Optional) | Dashboard UI |
| **Deployment** | Docker Compose | Qdrant + n8n containerization |

## Security Considerations

1. **API Authentication**: MCP service uses JWT tokens for n8n communication
2. **Gmail OAuth**: Secure OAuth 2.0 flow for email access
3. **Environment Variables**: Sensitive credentials stored in `.env` (gitignored)
4. **SMTP Credentials**: Use Gmail App Password or dedicated SMTP service
5. **Webhook Security**: Validate Slack/Teams webhook signatures (optional)

## Scalability Notes

- **Current Design**: Suitable for personal/small team use (~100-500 emails/day)
- **Database**: SQLite is lightweight; consider PostgreSQL for larger scale
- **Qdrant**: Can handle millions of vectors; current setup is self-hosted
- **OpenAI API**: Rate limits apply; consider caching common classifications
- **n8n**: Can scale horizontally for high-volume workflows
