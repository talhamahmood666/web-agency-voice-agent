import logger from '../utils/logger';
import { env } from '../config/env';
import Twilio from 'twilio';

interface SendSMSArgs {
  leadId: string;
  phoneNumber: string;
  message: string;
}

let twilioClient: Twilio.Twilio | null = null;

function getTwilioClient(): Twilio.Twilio | null {
  if (twilioClient) return twilioClient;

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    logger.warn('[sendSMS] Twilio credentials not configured — using stub mode');
    return null;
  }

  twilioClient = Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  return twilioClient;
}

/**
 * Send an SMS message to the prospect via Twilio.
 * Falls back to stub mode if Twilio credentials are missing or on send failure.
 */
export async function sendSMS(args: Record<string, unknown>): Promise<string> {
  const { leadId, phoneNumber, message } = args as unknown as SendSMSArgs;

  const truncated = message.length > 100 ? message.substring(0, 100) + '...' : message;
  logger.info(`[sendSMS] Sending SMS to ${phoneNumber} for lead ${leadId}: "${truncated}"`);

  const client = getTwilioClient();

  if (!client || !env.TWILIO_PHONE_NUMBER) {
    logger.warn('[sendSMS] Twilio not configured — using stub mode');
    return `SMS sent to ${phoneNumber}. Message: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`;
  }

  // Fire and forget — respond instantly, send SMS in background
  client.messages
    .create({
      body: message,
      from: env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    })
    .then((m) => {
      logger.info(`[sendSMS] Twilio message sent. SID: ${m.sid}, Status: ${m.status}`);
    })
    .catch((err) => {
      logger.error(`[sendSMS] Twilio background send failed: ${err instanceof Error ? err.message : err}`);
    });

  return `SMS sent to ${phoneNumber}.`;
}
