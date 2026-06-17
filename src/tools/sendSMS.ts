import logger from '../utils/logger';

interface SendSMSArgs {
  leadId: string;
  phoneNumber: string;
  message: string;
}

/**
 * Send an SMS message to the prospect.
 * Stub — Twilio SMS integration comes in a later phase.
 */
export async function sendSMS(args: Record<string, unknown>): Promise<string> {
  const { leadId, phoneNumber, message } = args as unknown as SendSMSArgs;

  logger.info(`[sendSMS] Sending SMS to ${phoneNumber} for lead ${leadId}: "${message.substring(0, 100)}..."`);

  // Stub: returns confirmation
  return `SMS sent to ${phoneNumber}. Message: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`;
}
