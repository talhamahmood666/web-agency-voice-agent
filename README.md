# Web Agency Voice Agent

AI-powered voice agent that cold-calls US tradesmen (plumbers, electricians, HVAC, roofers, landscapers, contractors) to pitch website and local SEO services, handle objections, book Google Meet consultations, and log outcomes — all autonomously.

## Prerequisites

- **Node.js 18+** and **npm**
- **ngrok** account (free tier works) — [sign up](https://ngrok.com)

## Quick Start

```bash
# 1. Clone the repo
git clone <repo-url>
cd web-agency-voice-agent

# 2. Set up environment
cp .env.example .env
# Fill in your API keys (see below)

# 3. Install dependencies
npm install

# 4. Start the server
npm run dev

# 5. Open the dashboard
open http://localhost:3000
```

## API Keys Needed

| Service | Purpose | Signup URL | Monthly Cost (Est.) |
|---|---|---|---|
| **Vapi** | AI voice platform (orchestration + telephony) | [vapi.ai](https://vapi.ai) | Pay-as-you-go |
| **DeepSeek** | LLM for agent reasoning | [deepseek.com](https://platform.deepseek.com) | Pay-per-token |
| **ElevenLabs** | Text-to-speech voice synthesis | [elevenlabs.io](https://elevenlabs.io) | ~$5/mo starter |
| **Deepgram** | Speech-to-text transcription | [deepgram.com](https://deepgram.com) | Free tier available |
| **Twilio** | Outbound phone calling | [twilio.com](https://twilio.com) | ~$1.15/mo per number |
| **Mem0** | Long-term lead memory | [mem0.ai](https://mem0.ai) | Free tier available |
| **Google Calendar** | Meeting booking (optional) | [console.cloud.google.com](https://console.cloud.google.com) | Free |
| **SendGrid** | Email sending (optional) | [sendgrid.com](https://sendgrid.com) | Free tier (100/day) |

Set each key in your `.env` file. The server starts with warnings for missing keys — only PORT and NODE_ENV are required for startup.

## Exposing via ngrok

Vapi needs a public URL to send webhooks to. ngrok creates a tunnel:

```bash
# Install ngrok (one-time)
# macOS: brew install ngrok
# Linux: snap install ngrok

# Start tunnel
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Paste it into .env:
NGROK_URL=https://abc123.ngrok.io

# Restart the server
npm run dev
```

## Configuring Vapi

1. Go to [dashboard.vapi.ai](https://dashboard.vapi.ai)
2. Create a new phone number (or use an existing one)
3. Copy the Phone Number ID into `VAPI_PHONE_NUMBER_ID` in `.env`
4. Set the webhook URL to: `https://your-ngrok.ngrok.io/webhook/vapi`
5. For call status updates, also point status webhook to: `https://your-ngrok.ngrok.io/webhook/vapi/status`
6. Copy your API key into `VAPI_API_KEY` in `.env`

## Uploading Knowledge Base to Vapi RAG

The knowledge base files in `knowledge-base/` are used by the agent to answer detailed questions during calls. To upload them to Vapi's RAG system:

1. Go to [dashboard.vapi.ai](https://dashboard.vapi.ai) → Knowledge Base
2. Create a new Knowledge Base named "Creed Web Designs"
3. Upload all 5 `.md` files from `knowledge-base/`
4. Copy the Knowledge Base ID and reference it in your Vapi assistant configuration

If Vapi RAG is not configured, the system falls back to embedding KB content directly in the system prompt via `formatKnowledgeForPrompt()`.

## Importing Leads from CSV

Place a CSV file with these columns (order doesn't matter, header row required):

```
id,businessName,ownerName,trade,phoneNumber,email,city,state,hasWebsite,websiteUrl,googleReviewCount,googleRating,source,status,notes
```

Or use the dashboard: **Leads tab → Import CSV button**.

For bulk imports, use the API directly:
```bash
curl -X POST http://localhost:3000/api/leads/import -F "file=@leads.csv"
```

## Running a Campaign

1. Seed test leads: Dashboard → Leads tab → "Seed Test Data"
2. Go to Campaign tab
3. Enter a campaign name, optionally filter by trade
4. Click "Start Campaign"
5. The campaign processes leads one at a time:
   - Checks callable hours (8 AM - 6 PM, Mon-Fri)
   - Enforces opt-out list and max 3 attempts per lead
   - Fetches Mem0 memories for context
   - Initiates call via Vapi
   - Waits for completion, logs costs
   - Pauses 30 seconds between calls

## Architecture

Single Express server that serves both a REST API and a dashboard UI. The core loop: **LeadStore** provides leads → **Campaign** orchestrates sequential calls → **CallManager** enforces rules and builds config → **VapiClient** talks to Vapi API → Vapi runs the AI voice agent using our **system prompt** (assembled from persona, trade hooks, call objectives, compliance rules, and lead context) → tool calls come back via webhooks → **handleToolCall** routes to the appropriate handler → outcomes logged to **LeadStore** and **Mem0**.

## Cost Estimates

| Component | Per-Minute Rate |
|---|---|
| Vapi (platform) | $0.05 |
| DeepSeek (LLM) | $0.01 |
| ElevenLabs (TTS) | $0.05 |
| Deepgram (STT) | $0.01 |
| Twilio (calling) | $0.02 |
| **Total** | **~$0.14/min** |

A typical 5-minute cold call costs ~$0.70. With pauses, a campaign calling 50 leads takes ~2 hours and costs ~$35.

## API Endpoints

### Health & Config
- `GET /health` — server health
- `GET /api/config` — config status (no keys exposed)
- `GET /api/test/:service` — connection test per service

### Leads
- `GET /api/leads` — list (filter: `?status=&trade=`)
- `POST /api/leads` — create
- `GET /api/leads/:id` — get one
- `PUT /api/leads/:id` — update
- `POST /api/leads/import` — CSV upload (multipart, field: `file`)
- `POST /api/leads/seed` — seed 5 test leads

### Campaign
- `POST /api/campaign/start` — body: `{ name, trade? }`
- `POST /api/campaign/stop` — stop after current call
- `GET /api/campaign/status` — live status

### Calling
- `POST /api/call` — manual single call: `{ leadId, phoneNumber, trade, callType, leadInfo }`
- `GET /api/calls/active` — active call list
- `GET /api/costs` — daily + total costs
- `GET /api/scheduler/check?timezone=` — callable time check

### Vapi Webhooks
- `POST /webhook/vapi` — tool calls and conversation events
- `POST /webhook/vapi/status` — call status updates

## License

MIT
