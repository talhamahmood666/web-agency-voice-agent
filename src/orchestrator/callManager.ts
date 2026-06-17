import { VapiClient } from '../vapi/client';
import { buildAssistantConfig } from '../vapi/assistant';
import { LeadInfo, CallType } from '../personas/types';
import { isCallableTime } from './scheduler';
import { optOutList } from '../tools/logOptOut';
import { logCallCost, CostBreakdown } from '../utils/costs';
import logger from '../utils/logger';

interface ActiveCallEntry {
  lead: LeadInfo;
  callType: CallType;
  startTime: Date;
  status: string;
  vapiCallId?: string;
}

export class CallManager {
  private vapiClient: VapiClient;
  private activeCalls: Map<string, ActiveCallEntry>;
  private callCountByLead: Map<string, number>;

  constructor(vapiClient: VapiClient) {
    this.vapiClient = vapiClient;
    this.activeCalls = new Map();
    this.callCountByLead = new Map();
  }

  /**
   * Initiate a call to a lead. Enforces opt-out list, max attempts, and callable hours.
   */
  async initiateCall(
    lead: LeadInfo,
    callType: CallType,
    phoneNumber: string,
    mem0Context?: string
  ): Promise<{ callId: string; success: boolean; error?: string }> {
    // Check opt-out list
    if (optOutList.has(lead.id)) {
      logger.warn(`[CallManager] Refusing to call opted-out lead: ${lead.id}`);
      return {
        callId: '',
        success: false,
        error: `Lead ${lead.id} is on the DO_NOT_CALL list.`,
      };
    }

    // Check max attempts (3 total)
    const currentCount = this.callCountByLead.get(lead.id) || 0;
    if (currentCount >= 3) {
      logger.warn(`[CallManager] Lead ${lead.id} has reached max attempts (${currentCount})`);
      return {
        callId: '',
        success: false,
        error: `Lead ${lead.id} has reached the maximum of 3 call attempts.`,
      };
    }

    // Check callable time (use a reasonable default timezone if unknown)
    const timezone = getLeadTimezone(lead.state);
    if (!isCallableTime(timezone)) {
      logger.warn(`[CallManager] Outside callable hours for ${timezone}`);
      return {
        callId: '',
        success: false,
        error: `Current time is outside callable hours (8 AM - 6 PM) in ${timezone}.`,
      };
    }

    try {
      // Build assistant config
      const assistantConfig = buildAssistantConfig(lead, callType, mem0Context);

      // Create assistant
      logger.info(`[CallManager] Creating assistant for lead ${lead.id} (${callType})`);
      const assistant = await this.vapiClient.createAssistant(assistantConfig);

      // Estimate costs
      const costEstimate = estimateCallCost();
      logger.info(`[CallManager] Estimated cost for call: $${costEstimate.total.toFixed(4)}`);

      // Start the call
      const call = await this.vapiClient.startCall(assistant.id, phoneNumber, {
        id: lead.id,
        businessName: lead.businessName,
        ownerName: lead.ownerName,
      });

      // Track the active call
      const entry: ActiveCallEntry = {
        lead,
        callType,
        startTime: new Date(),
        status: call.status || 'queued',
        vapiCallId: call.id,
      };
      this.activeCalls.set(call.id, entry);
      this.callCountByLead.set(lead.id, currentCount + 1);

      // Log estimated cost
      logCallCost(call.id, costEstimate);

      logger.info(`[CallManager] Call initiated: ${call.id} to ${lead.ownerName} (attempt ${currentCount + 1}/3)`);

      return { callId: call.id, success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[CallManager] Failed to initiate call for lead ${lead.id}: ${message}`);
      return { callId: '', success: false, error: message };
    }
  }

  /**
   * Handle call completion — processes end-of-call data from Vapi.
   */
  handleCallEnd(callId: string, callData: Record<string, unknown>): void {
    const entry = this.activeCalls.get(callId);
    if (!entry) {
      logger.warn(`[CallManager] Call end for unknown call: ${callId}`);
      return;
    }

    const duration = (callData?.duration as number) || (callData?.endedReason === 'customer-ended' ? 120 : 0);
    const endedReason = (callData?.endedReason as string) || 'unknown';

    entry.status = 'ended';

    // Log final costs based on actual duration
    const finalCost = calculateCallCost(duration);
    logCallCost(callId, finalCost);

    logger.info(
      `[CallManager] Call ${callId} ended. Duration: ${duration}s, Reason: ${endedReason}, Cost: $${finalCost.total.toFixed(4)}`
    );
  }

  /**
   * Get the status of an active call.
   */
  getActiveCall(callId: string): ActiveCallEntry | undefined {
    return this.activeCalls.get(callId);
  }

  /**
   * Get all active calls.
   */
  getActiveCalls(): Array<{ callId: string } & ActiveCallEntry> {
    const result: Array<{ callId: string } & ActiveCallEntry> = [];
    for (const [callId, entry] of this.activeCalls.entries()) {
      if (entry.status !== 'ended') {
        result.push({ callId, ...entry });
      }
    }
    return result;
  }

  /**
   * Get call attempt count for a lead.
   */
  getCallCount(leadId: string): number {
    return this.callCountByLead.get(leadId) || 0;
  }
}

/**
 * Estimate call cost before the call is placed.
 */
function estimateCallCost(): CostBreakdown {
  return {
    vapi: 0.05,
    deepseek: 0.02,
    elevenlabs: 0.04,
    deepgram: 0.01,
    twilio: 0.03,
    total: 0.15,
  };
}

/**
 * Calculate actual call cost based on duration (seconds).
 * Approximate costs:
 *   - Vapi: $0.05/min
 *   - DeepSeek: $0.01/min
 *   - ElevenLabs: $0.05/min
 *   - Deepgram: $0.01/min
 *   - Twilio: $0.02/min
 */
function calculateCallCost(durationSeconds: number): CostBreakdown {
  const minutes = Math.max(durationSeconds / 60, 0.5);
  const vapi = 0.05 * minutes;
  const deepseek = 0.01 * minutes;
  const elevenlabs = 0.05 * minutes;
  const deepgram = 0.01 * minutes;
  const twilio = 0.02 * minutes;

  return {
    vapi: parseFloat(vapi.toFixed(4)),
    deepseek: parseFloat(deepseek.toFixed(4)),
    elevenlabs: parseFloat(elevenlabs.toFixed(4)),
    deepgram: parseFloat(deepgram.toFixed(4)),
    twilio: parseFloat(twilio.toFixed(4)),
    total: parseFloat((vapi + deepseek + elevenlabs + deepgram + twilio).toFixed(4)),
  };
}

/**
 * Map US state to IANA timezone. Defaults to America/Chicago.
 */
function getLeadTimezone(state: string): string {
  const tzMap: Record<string, string> = {
    AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix',
    AR: 'America/Chicago', CA: 'America/Los_Angeles', CO: 'America/Denver',
    CT: 'America/New_York', DE: 'America/New_York', FL: 'America/New_York',
    GA: 'America/New_York', HI: 'Pacific/Honolulu', ID: 'America/Boise',
    IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis', IA: 'America/Chicago',
    KS: 'America/Chicago', KY: 'America/New_York', LA: 'America/Chicago',
    ME: 'America/New_York', MD: 'America/New_York', MA: 'America/New_York',
    MI: 'America/Detroit', MN: 'America/Chicago', MS: 'America/Chicago',
    MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago',
    NV: 'America/Los_Angeles', NH: 'America/New_York', NJ: 'America/New_York',
    NM: 'America/Denver', NY: 'America/New_York', NC: 'America/New_York',
    ND: 'America/Chicago', OH: 'America/New_York', OK: 'America/Chicago',
    OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York',
    SC: 'America/New_York', SD: 'America/Chicago', TN: 'America/Chicago',
    TX: 'America/Chicago', UT: 'America/Denver', VT: 'America/New_York',
    VA: 'America/New_York', WA: 'America/Los_Angeles', WV: 'America/New_York',
    WI: 'America/Chicago', WY: 'America/Denver', DC: 'America/New_York',
  };
  return tzMap[state.toUpperCase()] || 'America/Chicago';
}
