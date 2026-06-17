import logger from './logger';

export interface CostBreakdown {
  vapi?: number;
  deepseek?: number;
  elevenlabs?: number;
  deepgram?: number;
  twilio?: number;
  total: number;
}

export interface CostEntry {
  callId: string;
  timestamp: Date;
  breakdown: CostBreakdown;
}

// In-memory cost store
const costEntries: CostEntry[] = [];

export function logCallCost(callId: string, breakdown: CostBreakdown): void {
  const entry: CostEntry = {
    callId,
    timestamp: new Date(),
    breakdown,
  };
  costEntries.push(entry);
  logger.info(
    `[costs] Call ${callId}: $${breakdown.total.toFixed(4)}` +
      (breakdown.vapi ? ` (VAPI: $${breakdown.vapi.toFixed(4)})` : '') +
      (breakdown.deepseek ? ` (DeepSeek: $${breakdown.deepseek.toFixed(4)})` : '') +
      (breakdown.elevenlabs ? ` (ElevenLabs: $${breakdown.elevenlabs.toFixed(4)})` : '') +
      (breakdown.deepgram ? ` (Deepgram: $${breakdown.deepgram.toFixed(4)})` : '') +
      (breakdown.twilio ? ` (Twilio: $${breakdown.twilio.toFixed(4)})` : '')
  );
}

export function getDailyCosts(date?: Date): { entries: CostEntry[]; total: number } {
  const target = date || new Date();
  const startOfDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const entries = costEntries.filter(
    (e) => e.timestamp >= startOfDay && e.timestamp < endOfDay
  );
  const total = entries.reduce((sum, e) => sum + e.breakdown.total, 0);

  return { entries, total };
}

export function getTotalCosts(): { entries: CostEntry[]; total: number } {
  const total = costEntries.reduce((sum, e) => sum + e.breakdown.total, 0);
  return { entries: [...costEntries], total };
}
