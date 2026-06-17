import { LeadStore, Lead } from '../data/leads';
import { CallManager } from './callManager';
import { Mem0Client } from '../memory/mem0Client';
import { getLeadContext } from '../memory/leadMemory';
import { VapiClient } from '../vapi/client';
import logger from '../utils/logger';
import { TradeType } from '../personas/types';

export interface CampaignStatus {
  name: string;
  totalLeads: number;
  called: number;
  remaining: number;
  active: boolean;
  startTime: string | null;
  tradeFilter: string | null;
}

export class Campaign {
  private name: string;
  private tradeFilter: TradeType | null;
  private leadStore: LeadStore;
  private callManager: CallManager;
  private mem0Client: Mem0Client;
  private vapiClient: VapiClient;
  private active: boolean;
  private stopRequested: boolean;
  private startTime: Date | null;
  private called: number;
  private totalLeads: number;
  private pauseBetweenCallsMs: number;

  constructor(
    name: string,
    leadStore: LeadStore,
    callManager: CallManager,
    mem0Client: Mem0Client,
    tradeFilter?: TradeType
  ) {
    this.name = name;
    this.tradeFilter = tradeFilter || null;
    this.leadStore = leadStore;
    this.callManager = callManager;
    this.mem0Client = mem0Client;
    this.vapiClient = new VapiClient();
    this.active = false;
    this.stopRequested = false;
    this.startTime = null;
    this.called = 0;
    this.totalLeads = 0;
    this.pauseBetweenCallsMs = 30000; // 30 seconds between calls
  }

  /**
   * Start processing leads sequentially.
   * Gets next callable lead, fetches memory context, initiates call,
   * waits for completion, updates lead status, moves to next.
   */
  async start(): Promise<void> {
    if (this.active) {
      logger.warn(`[Campaign:${this.name}] Already running`);
      return;
    }

    this.active = true;
    this.stopRequested = false;
    this.startTime = new Date();
    this.called = 0;

    // Determine total leads matching the filter
    const allLeads = this.tradeFilter
      ? this.leadStore.getLeadsByTrade(this.tradeFilter)
      : this.leadStore.getAllLeads();
    const callableStatuses = ['new', 'contacted', 'callback_scheduled'];
    this.totalLeads = allLeads.filter((l) => callableStatuses.includes(l.status) && l.callCount < 3).length;

    logger.info(
      `[Campaign:${this.name}] Starting campaign. Total callable: ${this.totalLeads}, Trade filter: ${this.tradeFilter || 'all'}`
    );

    while (!this.stopRequested) {
      // Get next callable lead
      const lead = this.leadStore.getCallableLead();

      if (!lead) {
        logger.info(`[Campaign:${this.name}] No more callable leads. Campaign complete.`);
        break;
      }

      // Apply trade filter
      if (this.tradeFilter && lead.trade !== this.tradeFilter) {
        // Temporarily skip this lead (mark it so getCallableLead returns a different one)
        const originalStatus = lead.status;
        this.leadStore.updateLead(lead.id, { status: 'contacted' });
        // Immediately restore so it's not lost; skip by moving on
        this.leadStore.updateLead(lead.id, { status: originalStatus });
        continue;
      }

      logger.info(`[Campaign:${this.name}] Dialing lead: ${lead.ownerName} (${lead.businessName})`);

      try {
        // Fetch memory context
        const mem0Context = await getLeadContext(lead.id, this.mem0Client);

        // Initiate call
        const result = await this.callManager.initiateCall(
          {
            id: lead.id,
            businessName: lead.businessName,
            ownerName: lead.ownerName,
            trade: lead.trade,
            city: lead.city,
            state: lead.state,
            hasWebsite: lead.hasWebsite,
            websiteUrl: lead.websiteUrl,
            googleReviewCount: lead.googleReviewCount,
            googleRating: lead.googleRating,
          },
          'cold_call',
          lead.phoneNumber,
          mem0Context || undefined
        );

        if (!result.success) {
          logger.warn(`[Campaign:${this.name}] Call failed for ${lead.id}: ${result.error}`);
          // If it's an opt-out or max-attempts issue, update lead status
          if (result.error?.includes('DO_NOT_CALL')) {
            this.leadStore.updateLead(lead.id, { status: 'do_not_call' });
          }
          continue;
        }

        // Update lead status
        this.leadStore.updateLead(lead.id, {
          status: 'contacted',
          callCount: lead.callCount + 1,
          lastCallDate: new Date().toISOString(),
        });

        this.called++;
        logger.info(
          `[Campaign:${this.name}] Call ${this.called}/${this.totalLeads} completed for ${lead.businessName}`
        );

        // Wait for call to actually complete (poll Vapi)
        if (result.callId) {
          await this.waitForCallEnd(result.callId);
        }

        // Pause between calls
        if (!this.stopRequested) {
          logger.info(`[Campaign:${this.name}] Pausing ${this.pauseBetweenCallsMs / 1000}s before next call...`);
          await this.sleep(this.pauseBetweenCallsMs);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`[Campaign:${this.name}] Error processing lead ${lead.id}: ${message}`);
      }
    }

    this.active = false;
    logger.info(`[Campaign:${this.name}] Campaign ended. ${this.called} calls made.`);
  }

  /** Stop the campaign after the current call completes. */
  stop(): void {
    logger.info(`[Campaign:${this.name}] Stop requested`);
    this.stopRequested = true;
  }

  /** Get the current campaign status. */
  getStatus(): CampaignStatus {
    const allLeads = this.tradeFilter
      ? this.leadStore.getLeadsByTrade(this.tradeFilter)
      : this.leadStore.getAllLeads();

    const callableStatuses = ['new', 'contacted', 'callback_scheduled'];
    const total = allLeads.filter((l) => callableStatuses.includes(l.status) && l.callCount < 3).length;
    const remaining = Math.max(0, total - this.called);

    return {
      name: this.name,
      totalLeads: total,
      called: this.called,
      remaining,
      active: this.active,
      startTime: this.startTime?.toISOString() || null,
      tradeFilter: this.tradeFilter,
    };
  }

  /** Poll Vapi for call completion. Max timeout 6 minutes. */
  private async waitForCallEnd(callId: string): Promise<void> {
    const maxWaitMs = 6 * 60 * 1000; // 6 minutes
    const pollIntervalMs = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      if (this.stopRequested) return;

      try {
        const call = await this.vapiClient.getCall(callId);
        if (call.status === 'ended' || call.status === 'completed') {
          logger.info(`[Campaign:${this.name}] Call ${callId} completed`);
          return;
        }
      } catch {
        // Ignore poll errors, keep waiting
      }

      await this.sleep(pollIntervalMs);
    }

    logger.warn(`[Campaign:${this.name}] Call ${callId} timed out waiting for completion`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
