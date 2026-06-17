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
  const systemPrompt = buildSystemPrompt(lead, callType, mem0Context);
  const agentName = env.AGENT_NAME || 'Alex';
  const firstMessage = getFirstMessage(callType, lead.ownerName, agentName);

  const config: Record<string, unknown> = {
    name: `Creed Web Designs - ${lead.trade} - ${lead.businessName}`,
    model: {
      provider: 'custom-llm',
      url: env.DEEPSEEK_API_URL,
      model: env.DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
      ],
    },
    voice: {
      provider: '11labs',
      voiceId: env.ELEVENLABS_VOICE_ID,
      stability: 0.5,
      similarityBoost: 0.75,
    },
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: 'en-US',
    },
    serverUrl: `${env.NGROK_URL}/webhook/vapi`,
    serverMessages: ['tool_calls', 'end_of_call_report', 'status_update'],
    tools: buildToolDefinitions(),
    firstMessage,
    endCallFunctionEnabled: true,
    maxDurationSeconds: 300,
    silenceTimeoutSeconds: 30,
  };

  return config;
}

/**
 * Generate the first message based on call type.
 */
function getFirstMessage(callType: CallType, ownerName: string, agentName: string): string {
  switch (callType) {
    case 'cold_call':
      return `Hi, is this ${ownerName}?`;
    case 'follow_up':
      return `Hey ${ownerName}, this is ${agentName} from Creed Web Designs — we spoke the other day about your website. Got a minute?`;
    case 'voicemail':
      return `Hi ${ownerName}, this is ${agentName} from Creed Web Designs. I help ${ownerName}'s type of business get found on Google — wanted to see if you'd be open to a quick chat. I'll send you an email too. No need to call back, just keep an eye out. Thanks!`;
    default:
      return `Hi, is this ${ownerName}?`;
  }
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
