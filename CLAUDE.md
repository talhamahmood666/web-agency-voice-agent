# Project: web-agency-voice-agent

## Architecture
Node.js/TypeScript Express server. Vapi AI voice agent for cold-calling US tradesmen. Single Express server serves both the REST API and a dashboard UI. Local lead database with JSON persistence, Mem0 for long-term memory, campaign orchestrator for sequential outbound calling.

## Stack
Express, Vapi AI, DeepSeek V4 Flash, ElevenLabs, Deepgram, Twilio, Mem0, Multer

## File Structure
```
src/
  server.ts                      - Express entry point, API routes, static serving
  config/env.ts                  - Typed env loader with validation
  utils/logger.ts                - Winston logger
  utils/costs.ts                 - In-memory call cost tracker
  personas/
    types.ts                     - TradeType, TradePersona, CallType, LeadInfo interfaces
    trades.ts                    - 7 trade personas with hooks, pain points, objections
  prompts/
    basePersona.ts               - Agent core identity (Alex at Creed Web Designs)
    callObjectives.ts            - Per-call-type objectives (cold_call, follow_up, voicemail)
    complianceRules.ts           - TCPA, AI disclosure, DNC, time restrictions
    buildSystemPrompt.ts         - Assembles full system prompt from all sections
  tools/
    types.ts                     - VapiToolCall, VapiToolResponse, ToolHandler
    bookMeeting.ts               - Meeting booking stub (Phase 6: Google Calendar)
    sendEmail.ts                 - Email sending stub (Phase 6: SendGrid)
    saveMemory.ts                - Memory storage (Mem0 + local fallback)
    logOptOut.ts                 - DO_NOT_CALL list (exported Set)
    transferToHuman.ts           - Human transfer instruction
    router.ts                    - Tool router maps names to handlers
  vapi/
    client.ts                    - VapiClient (REST API wrapper, stub mode when no key)
    assistant.ts                 - buildAssistantConfig (model, voice, tools, firstMessage)
    knowledgeBase.ts             - KB file reader + prompt formatter
  orchestrator/
    scheduler.ts                 - isCallableTime, getNextCallableTime, getBestCallTime
    callManager.ts               - CallManager (opt-out, max-attempts, timezone enforcement)
    campaign.ts                  - Campaign (sequential lead processing, cost tracking)
  data/
    leads.ts                     - Lead interface, LeadStore (JSON CRUD, CSV import/export)
    seed.ts                      - 5 test leads across TX cities
  memory/
    mem0Client.ts                - Mem0Client (API + local fallback)
    leadMemory.ts                - getLeadContext, saveLeadMemory
public/
  index.html                     - Dashboard UI (5 tabs: Leads, Campaign, Call, Settings, Costs)
knowledge-base/
  agency-services.md             - Creed Web Designs service details
  objection-handling.md          - 12 objection responses
  trade-specific-hooks.md        - 7 trade hook sets with pain points
  faq.md                         - 16 FAQ entries
  competitor-comparison.md       - Us vs. competitors comparison table
data/
  leads.json                     - Lead database (auto-created)
  uploads/                       - CSV upload temp directory
```

## Rules
- TypeScript strict. No any.
- Files under 150 lines where practical.
- All API keys from process.env.
- Error handling on every external call.
- Never use nano. Use cat heredoc or sed.
- No unused imports or dead code.
- Do NOT break existing functionality.
