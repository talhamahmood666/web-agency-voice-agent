import logger from '../utils/logger';
import { env } from '../config/env';

const BASE_URL = 'https://api.vapi.ai';

interface VapiAssistantConfig {
  name?: string;
  model?: Record<string, unknown>;
  voice?: Record<string, unknown>;
  transcriber?: Record<string, unknown>;
  serverUrl?: string;
  serverMessages?: string[];
  tools?: Array<Record<string, unknown>>;
  firstMessage?: string;
  endCallFunctionEnabled?: boolean;
  maxDurationSeconds?: number;
  silenceTimeoutSeconds?: number;
  [key: string]: unknown;
}

interface VapiAssistant {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

interface VapiCall {
  id: string;
  assistantId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export class VapiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || env.VAPI_API_KEY;
    this.baseUrl = BASE_URL;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create a Vapi assistant with the given configuration.
   */
  async createAssistant(config: VapiAssistantConfig): Promise<VapiAssistant> {
    logger.info('[VapiClient] Creating assistant', { name: config.name });

    if (!this.apiKey) {
      logger.warn('[VapiClient] No VAPI_API_KEY set — using stub mode');
      return {
        id: `stub-assistant-${Date.now()}`,
        name: config.name || 'Unnamed Assistant',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/assistant`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Vapi API error ${response.status}: ${errorBody}`);
      }

      const assistant = (await response.json()) as VapiAssistant;
      logger.info(`[VapiClient] Assistant created: ${assistant.id}`);
      return assistant;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[VapiClient] Failed to create assistant: ${message}`);
      throw error;
    }
  }

  /**
   * Initiate an outbound call via Vapi.
   */
  async startCall(
    assistantId: string,
    phoneNumber: string,
    leadInfo?: { id: string; businessName?: string; ownerName?: string }
  ): Promise<VapiCall> {
    logger.info(`[VapiClient] Starting call to ${phoneNumber} with assistant ${assistantId}`);

    const phoneNumberId = env.VAPI_PHONE_NUMBER_ID;

    if (!this.apiKey) {
      logger.warn('[VapiClient] No VAPI_API_KEY set — using stub mode');
      const stubCall: VapiCall = {
        id: `stub-call-${Date.now()}`,
        assistantId,
        status: 'queued',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return stubCall;
    }

    const payload: Record<string, unknown> = {
      assistantId,
      customer: {
        number: phoneNumber,
        ...(leadInfo?.ownerName ? { name: leadInfo.ownerName } : {}),
      },
    };

    if (phoneNumberId) {
      payload.phoneNumberId = phoneNumberId;
    }

    try {
      const response = await fetch(`${this.baseUrl}/call`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Vapi API error ${response.status}: ${errorBody}`);
      }

      const call = (await response.json()) as VapiCall;
      logger.info(`[VapiClient] Call started: ${call.id} (status: ${call.status})`);
      return call;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[VapiClient] Failed to start call: ${message}`);
      throw error;
    }
  }

  /**
   * Fetch call status and details from Vapi.
   */
  async getCall(callId: string): Promise<VapiCall> {
    logger.info(`[VapiClient] Fetching call: ${callId}`);

    if (!this.apiKey) {
      return {
        id: callId,
        assistantId: 'stub',
        status: 'ended',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/call/${callId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Vapi API error ${response.status}: ${errorBody}`);
      }

      const call = (await response.json()) as VapiCall;
      return call;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[VapiClient] Failed to get call: ${message}`);
      throw error;
    }
  }

  /**
   * End an active call.
   */
  async endCall(callId: string): Promise<VapiCall> {
    logger.info(`[VapiClient] Ending call: ${callId}`);

    if (!this.apiKey) {
      return {
        id: callId,
        assistantId: 'stub',
        status: 'ended',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/call/${callId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Vapi API error ${response.status}: ${errorBody}`);
      }

      const call = (await response.json()) as VapiCall;
      logger.info(`[VapiClient] Call ended: ${callId}`);
      return call;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[VapiClient] Failed to end call: ${message}`);
      throw error;
    }
  }
}
