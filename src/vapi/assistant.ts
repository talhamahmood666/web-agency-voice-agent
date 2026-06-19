import { env } from '../config/env';
import { LeadInfo, CallType } from '../personas/types';
import { buildSystemPrompt } from '../prompts/buildSystemPrompt';

/**
 * Build a Vapi assistant configuration object for a given lead and call type.
 */
export function buildAssistantConfig(
  lead: LeadInfo,
  callType: CallType,
  mem0Context?: string
): Record<string, unknown> {
  const systemPrompt = buildSystemPrompt(lead, callType, mem0Context, lead.demoUrl);
  const agentName = env.AGENT_NAME || 'Alex';
  const firstMessage = getFirstMessage(callType, lead.ownerName, agentName, lead.trade, lead.city);

  const config: Record<string, unknown> = {
    name: `Creed - ${lead.trade} - ${lead.businessName}`.substring(0, 40),
    model: {
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
      ],
      temperature: 0.5,
      maxTokens: 350,
      tools: buildToolDefinitions(),
    },
    voice: {
      provider: 'vapi',
      voiceId: 'Savannah',
      version: 2,
      language: 'en',
      speed: 1.1,
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'en-US',
    },
    serverUrl: `${env.NGROK_URL}/webhook/vapi`,
    serverMessages: ['tool-calls', 'end-of-call-report', 'status-update'],
    firstMessage,
    endCallFunctionEnabled: true,
    maxDurationSeconds: 300,
    silenceTimeoutSeconds: 30,
    backgroundSound: 'office',
    backchannelingEnabled: true,
  };

  return config;
}

/**
 * Generate the first message based on call type.
 */
function getFirstMessage(
  callType: CallType,
  ownerName: string,
  agentName: string,
  trade: string,
  city: string
): string {
  const firstName = ownerName.split(' ')[0] || ownerName;
  const tradeWork = getTradeWork(trade);

  switch (callType) {
    case 'cold_call':
      return `Hey ${firstName}, I was calling to get an estimate on some ${tradeWork} but I couldn't find your website anywhere. Do you guys even have one or is that on purpose?`;
    case 'follow_up':
      return `Hey ${firstName}, it's ${agentName} from Creed Web Designs. I sent you that site link a little bit ago, were you able to check it out at all?`;
    case 'voicemail':
      return `Hey ${firstName}, it's ${agentName} from Creed Web Designs. I actually built you guys a website, I was gonna text you the link but wanted to let you know it's coming so you don't think it's spam or something. I'll shoot it over in a sec. Have a good one.`;
    default:
      return `Hey ${firstName}, I was calling to get an estimate on some ${tradeWork} but I couldn't find your website anywhere. Do you guys even have one or is that on purpose?`;
  }
}

/**
 * Map trade type to the kind of work they do (for the opener).
 */
function getTradeWork(trade: string): string {
  const map: Record<string, string> = {
    plumber: 'plumbing work',
    electrician: 'electrical work',
    hvac: 'HVAC work',
    roofer: 'roofing work',
    landscaper: 'landscaping',
    general_contractor: 'contracting work',
    other: 'work',
  };
  return map[trade] || 'work';
}

/**
 * Build the Vapi tool definitions matching our tool router handlers.
 */
function buildToolDefinitions(): Array<Record<string, unknown>> {
  return [
    {
      type: 'function',
      function: {
        name: 'book_meeting',
        description: 'Schedule a Google Meet consultation with the prospect.',
        parameters: {
          type: 'object',
          properties: {
            leadId: {
              type: 'string',
              description: 'The unique identifier for the lead.',
            },
            date: {
              type: 'string',
              description: 'The meeting date in YYYY-MM-DD format.',
            },
            time: {
              type: 'string',
              description: 'The meeting time in HH:MM format (24-hour).',
            },
            timezone: {
              type: 'string',
              description: 'IANA timezone string, e.g. America/Chicago.',
            },
          },
          required: ['leadId', 'date', 'time', 'timezone'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'send_email',
        description: 'Send a follow-up email to the prospect.',
        parameters: {
          type: 'object',
          properties: {
            leadId: {
              type: 'string',
              description: 'The unique identifier for the lead.',
            },
            emailAddress: {
              type: 'string',
              description: 'The email address to send to.',
            },
            templateType: {
              type: 'string',
              enum: ['intro', 'followup', 'meeting_confirmation'],
              description: 'The type of email template to use.',
            },
          },
          required: ['leadId', 'emailAddress', 'templateType'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'send_sms',
        description: 'Text the demo website link to the prospect so they can see it on their phone.',
        parameters: {
          type: 'object',
          properties: {
            leadId: {
              type: 'string',
              description: 'The unique identifier for the lead.',
            },
            phoneNumber: {
              type: 'string',
              description: 'The phone number to send the SMS to.',
            },
            message: {
              type: 'string',
              description: 'The text message content to send.',
            },
          },
          required: ['leadId', 'phoneNumber', 'message'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'save_memory',
        description: 'Save important context about this lead for future reference.',
        parameters: {
          type: 'object',
          properties: {
            leadId: {
              type: 'string',
              description: 'The unique identifier for the lead.',
            },
            category: {
              type: 'string',
              enum: ['objection', 'interest', 'personal', 'callback', 'qualification'],
              description: 'The category of the memory entry.',
            },
            content: {
              type: 'string',
              description: 'The memory content to save.',
            },
          },
          required: ['leadId', 'category', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'log_opt_out',
        description: 'Permanently log an opt-out request. Use when prospect asks not to be called again.',
        parameters: {
          type: 'object',
          properties: {
            leadId: {
              type: 'string',
              description: 'The unique identifier for the lead.',
            },
            reason: {
              type: 'string',
              description: 'The reason for opting out.',
            },
          },
          required: ['leadId', 'reason'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'transfer_to_human',
        description: 'Transfer the call to a live human representative.',
        parameters: {
          type: 'object',
          properties: {
            leadId: {
              type: 'string',
              description: 'The unique identifier for the lead.',
            },
            reason: {
              type: 'string',
              description: 'The reason for the transfer.',
            },
          },
          required: ['leadId', 'reason'],
        },
      },
    },
  ];
}
