import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { env } from './config/env';
import logger from './utils/logger';
import { handleToolCall } from './tools/router';
import { VapiToolCall } from './tools/types';
import { VapiClient } from './vapi/client';
import { CallManager } from './orchestrator/callManager';
import { Campaign } from './orchestrator/campaign';
import { LeadStore, Lead } from './data/leads';
import { seedTestLeads } from './data/seed';
import { Mem0Client } from './memory/mem0Client';
import { setMem0Client } from './tools/saveMemory';
import { getDailyCosts, getTotalCosts } from './utils/costs';
import { isCallableTime, getNextCallableTime, getBestCallTime } from './orchestrator/scheduler';
import type { LeadInfo, CallType, TradeType } from './personas/types';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve dashboard static files
app.use(express.static(path.resolve(__dirname, '../public')));

// File upload middleware for CSV import
const upload = multer({ dest: path.resolve(__dirname, '../data/uploads') });

// --- Initialize core services ---
const leadStore = new LeadStore();
leadStore.loadFromFile();

const mem0Client = new Mem0Client();
setMem0Client(mem0Client);

const vapiClient = new VapiClient();
const callManager = new CallManager(vapiClient);

let activeCampaign: Campaign | null = null;

// Ensure data directories exist
const DATA_DIR = path.resolve(__dirname, '../data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

logger.info('[server] Services initialized: LeadStore, Mem0Client, VapiClient, CallManager');

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// --- Vapi webhooks ---

app.post('/webhook/vapi', async (req, res) => {
  const body = req.body;
  logger.info('[webhook/vapi] Received request', { body });

  const toolCall = extractToolCall(body);

  if (toolCall) {
    logger.info(`[webhook/vapi] Routing tool call: ${toolCall.function.name}`);
    try {
      const toolResponse = await handleToolCall(toolCall);
      res.status(200).json(toolResponse);
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[webhook/vapi] Tool call failed: ${errorMessage}`);
      res.status(500).json({
        results: [{ toolCallId: 'error', result: `Tool execution failed: ${errorMessage}` }],
      });
      return;
    }
  }

  res.status(200).json({ received: true });
});

app.post('/webhook/vapi/status', (req, res) => {
  const body = req.body;
  const callStatus = body?.message?.status || body?.status || 'unknown';

  logger.info(`[webhook/vapi/status] Call status: ${callStatus}`, { body });

  if (
    callStatus === 'ended' ||
    callStatus === 'end-of-call-report' ||
    body?.message?.type === 'end_of_call_report'
  ) {
    const callId = body?.callId || body?.message?.callId || body?.message?.call?.id || 'unknown';
    const callData = body?.message?.call || body?.message || body;
    logger.info(`[webhook/vapi/status] Processing call end for ${callId}`);
    callManager.handleCallEnd(callId, callData as Record<string, unknown>);
  }

  res.status(200).json({ received: true });
});

// --- API: Call ---

app.post('/api/call', async (req, res) => {
  try {
    const { leadId, phoneNumber, trade, callType, leadInfo } = req.body;

    if (!leadId || !phoneNumber) {
      res.status(400).json({ error: 'leadId and phoneNumber are required' });
      return;
    }

    const lead: LeadInfo = {
      id: leadId,
      businessName: leadInfo?.businessName || 'Unknown Business',
      ownerName: leadInfo?.ownerName || 'there',
      trade: (trade || leadInfo?.trade || 'other') as LeadInfo['trade'],
      city: leadInfo?.city || 'your area',
      state: leadInfo?.state || 'TX',
      hasWebsite: leadInfo?.hasWebsite ?? false,
      websiteUrl: leadInfo?.websiteUrl || null,
      googleReviewCount: leadInfo?.googleReviewCount || null,
      googleRating: leadInfo?.googleRating || null,
    };

    const type: CallType = (callType as CallType) || 'cold_call';

    logger.info(`[api/call] Initiating ${type} call to ${lead.ownerName} at ${phoneNumber}`);

    const result = await callManager.initiateCall(lead, type, phoneNumber);

    if (result.success) {
      res.status(200).json({ callId: result.callId, status: 'initiated' });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[api/call] Error: ${message}`);
    res.status(500).json({ error: message });
  }
});

// GET /api/calls/active
app.get('/api/calls/active', (_req, res) => {
  const activeCalls = callManager.getActiveCalls();
  res.json({ activeCalls, count: activeCalls.length });
});

// GET /api/costs
app.get('/api/costs', (_req, res) => {
  const daily = getDailyCosts();
  const total = getTotalCosts();
  res.json({
    daily: { total: daily.total, entryCount: daily.entries.length },
    total: { total: total.total, entryCount: total.entries.length },
  });
});

// GET /api/scheduler/check
app.get('/api/scheduler/check', (req, res) => {
  const timezone = (req.query.timezone as string) || 'America/Chicago';
  const callable = isCallableTime(timezone);
  const nextTime = callable ? null : getNextCallableTime(timezone).toISOString();
  const bestTimes = getBestCallTime(timezone);
  res.json({ timezone, isCallable: callable, nextCallableTime: nextTime, bestTimes });
});

// --- API: Leads ---

// POST /api/leads - add a single lead
app.post('/api/leads', (req, res) => {
  try {
    const body = req.body;
    const lead: Lead = {
      id: body.id || `lead-${Date.now()}`,
      businessName: body.businessName || '',
      ownerName: body.ownerName || '',
      trade: body.trade || 'other',
      phoneNumber: body.phoneNumber || '',
      email: body.email || '',
      city: body.city || '',
      state: body.state || '',
      hasWebsite: body.hasWebsite ?? false,
      websiteUrl: body.websiteUrl || null,
      googleReviewCount: body.googleReviewCount ?? null,
      googleRating: body.googleRating ?? null,
      source: body.source || 'manual',
      status: body.status || 'new',
      callCount: body.callCount || 0,
      lastCallDate: body.lastCallDate || null,
      nextCallDate: body.nextCallDate || null,
      meetingDate: body.meetingDate || null,
      timezone: body.timezone || '',
      notes: body.notes || '',
    };

    const created = leadStore.addLead(lead);
    res.status(201).json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// GET /api/leads - list all leads (optional ?status= & ?trade=)
app.get('/api/leads', (req, res) => {
  const status = req.query.status as string | undefined;
  const trade = req.query.trade as string | undefined;
  const leads = leadStore.getLeads({ status, trade });
  res.json({ leads, count: leads.length });
});

// GET /api/leads/:id - get single lead
app.get('/api/leads/:id', (req, res) => {
  const lead = leadStore.getLead(req.params.id);
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  res.json(lead);
});

// PUT /api/leads/:id - update a lead
app.put('/api/leads/:id', (req, res) => {
  const updated = leadStore.updateLead(req.params.id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  res.json(updated);
});

// POST /api/leads/import - import leads from uploaded CSV
app.post('/api/leads/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded. Use field name "file".' });
      return;
    }
    const count = leadStore.importFromCSV(req.file.path);
    res.json({ imported: count, message: `Successfully imported ${count} leads.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// POST /api/leads/seed - seed test leads
app.post('/api/leads/seed', (_req, res) => {
  try {
    const testLeads = seedTestLeads();
    for (const lead of testLeads) {
      if (!leadStore.getLead(lead.id)) {
        leadStore.addLead(lead);
      }
    }
    logger.info(`[api/leads/seed] Seeded ${testLeads.length} test leads`);
    res.json({ seeded: testLeads.length, message: `${testLeads.length} test leads seeded.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// --- API: Campaign ---

// POST /api/campaign/start
app.post('/api/campaign/start', async (req, res) => {
  try {
    if (activeCampaign?.getStatus().active) {
      res.status(400).json({ error: 'A campaign is already running. Stop it first.' });
      return;
    }

    const { name, trade } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Campaign name is required.' });
      return;
    }

    activeCampaign = new Campaign(
      name,
      leadStore,
      callManager,
      mem0Client,
      trade as TradeType | undefined
    );

    // Start campaign asynchronously (don't await — it runs in background)
    activeCampaign.start().catch((err) => {
      logger.error(`[api/campaign] Campaign error: ${err}`);
    });

    res.status(200).json({ message: `Campaign "${name}" started.`, status: activeCampaign.getStatus() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// POST /api/campaign/stop
app.post('/api/campaign/stop', (_req, res) => {
  if (!activeCampaign) {
    res.status(400).json({ error: 'No campaign is running.' });
    return;
  }

  activeCampaign.stop();
  res.json({ message: 'Campaign stop requested. Will complete current call.', status: activeCampaign.getStatus() });
});

// GET /api/campaign/status
app.get('/api/campaign/status', (_req, res) => {
  if (!activeCampaign) {
    res.json({ active: false, message: 'No campaign has been started.' });
    return;
  }
  res.json(activeCampaign.getStatus());
});

// --- API: Config & Service Tests ---

// GET /api/config — returns configuration status (never exposes actual keys)
app.get('/api/config', (_req, res) => {
  res.json({
    agencyName: env.AGENCY_NAME,
    agentName: env.AGENT_NAME,
    transferPhoneNumber: env.TRANSFER_PHONE_NUMBER,
    ngrokUrl: env.NGROK_URL,
    port: env.PORT,
    services: [
      { key: 'vapi', name: 'Vapi', configured: !!env.VAPI_API_KEY },
      { key: 'deepseek', name: 'DeepSeek', configured: !!env.DEEPSEEK_API_KEY },
      { key: 'elevenlabs', name: 'ElevenLabs', configured: !!env.ELEVENLABS_API_KEY },
      { key: 'deepgram', name: 'Deepgram', configured: !!env.DEEPGRAM_API_KEY },
      { key: 'twilio', name: 'Twilio', configured: !!env.TWILIO_ACCOUNT_SID },
      { key: 'mem0', name: 'Mem0', configured: !!env.MEM0_API_KEY },
      { key: 'google_calendar', name: 'Google Calendar', configured: !!env.GOOGLE_CALENDAR_API_KEY },
      { key: 'sendgrid', name: 'SendGrid', configured: !!env.SENDGRID_API_KEY },
    ],
  });
});

// GET /api/test/:service — lightweight health checks for each service
app.get('/api/test/:service', async (req, res) => {
  const { service } = req.params;

  try {
    switch (service) {
      case 'vapi': {
        if (!env.VAPI_API_KEY) throw new Error('VAPI_API_KEY not set');
        const r = await fetch('https://api.vapi.ai/assistant?limit=1', {
          headers: { Authorization: `Bearer ${env.VAPI_API_KEY}` },
        });
        if (!r.ok) throw new Error(`Vapi returned ${r.status}`);
        res.json({ service, status: 'ok', message: 'Vapi API is reachable' });
        return;
      }
      case 'deepseek': {
        if (!env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not set');
        const r = await fetch(env.DEEPSEEK_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: env.DEEPSEEK_MODEL,
            messages: [{ role: 'user', content: 'Say "ok"' }],
            max_tokens: 5,
          }),
        });
        if (!r.ok) throw new Error(`DeepSeek returned ${r.status}`);
        res.json({ service, status: 'ok', message: 'DeepSeek API is reachable' });
        return;
      }
      case 'elevenlabs':
        if (!env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY not set');
        res.json({ service, status: 'ok', message: 'ElevenLabs API key is configured' });
        return;
      case 'deepgram':
        if (!env.DEEPGRAM_API_KEY) throw new Error('DEEPGRAM_API_KEY not set');
        res.json({ service, status: 'ok', message: 'Deepgram API key is configured' });
        return;
      case 'twilio':
        if (!env.TWILIO_ACCOUNT_SID) throw new Error('TWILIO_ACCOUNT_SID not set');
        res.json({ service, status: 'ok', message: 'Twilio credentials are configured' });
        return;
      case 'mem0':
        if (!env.MEM0_API_KEY) throw new Error('MEM0_API_KEY not set');
        res.json({ service, status: 'ok', message: 'Mem0 API key is configured' });
        return;
      case 'google_calendar':
        if (!env.GOOGLE_CALENDAR_API_KEY) throw new Error('GOOGLE_CALENDAR_API_KEY not set');
        res.json({ service, status: 'ok', message: 'Google Calendar API key is configured' });
        return;
      case 'sendgrid':
        if (!env.SENDGRID_API_KEY) throw new Error('SENDGRID_API_KEY not set');
        res.json({ service, status: 'ok', message: 'SendGrid API key is configured' });
        return;
      default:
        res.status(404).json({ service, status: 'error', message: `Unknown service: ${service}` });
        return;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.json({ service, status: 'error', message });
  }
});

// --- Tool extraction ---

function extractToolCall(body: Record<string, unknown>): VapiToolCall | null {
  if (body.type === 'function' && body.function && typeof body.function === 'object') {
    return body as unknown as VapiToolCall;
  }

  if (body.toolCall && typeof body.toolCall === 'object') {
    const tc = body.toolCall as Record<string, unknown>;
    if (tc.type === 'function' && tc.function) {
      return tc as unknown as VapiToolCall;
    }
  }

  if (Array.isArray(body.toolCalls) && body.toolCalls.length > 0) {
    const first = body.toolCalls[0] as Record<string, unknown>;
    if (first.type === 'function' && first.function) {
      return first as unknown as VapiToolCall;
    }
  }

  if (body.message && typeof body.message === 'object') {
    const msg = body.message as Record<string, unknown>;

    if (
      msg.type === 'function-call' &&
      msg.functionCall &&
      typeof msg.functionCall === 'object'
    ) {
      const fc = msg.functionCall as Record<string, unknown>;
      return {
        type: 'function',
        function: {
          name: (fc.name as string) || '',
          arguments: (fc.arguments as Record<string, unknown>) || {},
        },
      };
    }

    if (msg.type === 'tool_calls' && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) {
      const first = (msg.toolCalls as Array<Record<string, unknown>>)[0];
      if (first.type === 'function' && first.function) {
        return first as unknown as VapiToolCall;
      }
    }
  }

  return null;
}

const server = app.listen(env.PORT, () => {
  logger.info(`[server] ${env.AGENCY_NAME} Voice Agent running on port ${env.PORT}`);
  logger.info(`[server] Environment: ${env.NODE_ENV}`);
  logger.info(`[server] Health check: http://localhost:${env.PORT}/health`);
});

// Graceful shutdown
function shutdown(signal: string) {
  logger.info(`[server] Received ${signal} — shutting down gracefully`);

  if (activeCampaign?.getStatus().active) {
    activeCampaign.stop();
    logger.info('[server] Campaign stop requested');
  }

  server.close(() => {
    logger.info('[server] HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('[server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
