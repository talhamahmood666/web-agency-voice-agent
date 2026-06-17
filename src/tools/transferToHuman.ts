import logger from '../utils/logger';

interface TransferToHumanArgs {
  leadId: string;
  reason: string;
}

export async function transferToHuman(args: Record<string, unknown>): Promise<string> {
  const { leadId, reason } = args as unknown as TransferToHumanArgs;

  logger.info(`[transferToHuman] Transferring lead ${leadId} to human. Reason: ${reason}`);

  return `Transferring call to a human representative. Reason: ${reason}. Please hold while we connect you.`;
}
