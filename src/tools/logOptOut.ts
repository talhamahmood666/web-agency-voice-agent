import logger from '../utils/logger';

interface LogOptOutArgs {
  leadId: string;
  reason: string;
}

// DO_NOT_CALL list — persisted in memory for this session
export const optOutList = new Set<string>();

export async function logOptOut(args: Record<string, unknown>): Promise<string> {
  const { leadId, reason } = args as unknown as LogOptOutArgs;

  optOutList.add(leadId);

  logger.warn(`[logOptOut] Lead ${leadId} opted out. Reason: ${reason}. Total opt-outs: ${optOutList.size}`);

  return `Lead ${leadId} has been marked DO_NOT_CALL. Reason: "${reason}". No further calls will be made.`;
}
