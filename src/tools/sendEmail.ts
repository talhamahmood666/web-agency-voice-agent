import logger from '../utils/logger';

interface SendEmailArgs {
  leadId: string;
  emailAddress: string;
  templateType: 'intro' | 'followup' | 'meeting_confirmation';
}

const TEMPLATE_LABELS: Record<string, string> = {
  intro: 'Introduction email',
  followup: 'Follow-up email',
  meeting_confirmation: 'Meeting confirmation email',
};

export async function sendEmail(args: Record<string, unknown>): Promise<string> {
  const { leadId, emailAddress, templateType } = args as unknown as SendEmailArgs;
  const label = TEMPLATE_LABELS[templateType] || templateType;

  logger.info(`[sendEmail] Sending ${templateType} email to ${emailAddress} for lead ${leadId}`);

  // Stub: SendGrid integration coming in Phase 6
  return `${label} sent to ${emailAddress}. The lead should receive it within a few minutes.`;
}
