import logger from '../utils/logger';
import { VapiToolCall, VapiToolResponse, ToolHandler } from './types';
import { bookMeeting } from './bookMeeting';
import { sendEmail } from './sendEmail';
import { sendSMS } from './sendSMS';
import { saveMemory } from './saveMemory';
import { logOptOut } from './logOptOut';
import { transferToHuman } from './transferToHuman';

export const toolRouter: Record<string, ToolHandler> = {
  book_meeting: bookMeeting,
  send_email: sendEmail,
  send_sms: sendSMS,
  save_memory: saveMemory,
  log_opt_out: logOptOut,
  transfer_to_human: transferToHuman,
};

export async function handleToolCall(toolCall: VapiToolCall): Promise<VapiToolResponse> {
  const { name, arguments: args } = toolCall.function;
  const toolCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  logger.info(`[toolRouter] Handling tool call: ${name}`, { args });

  const handler = toolRouter[name];

  if (!handler) {
    logger.error(`[toolRouter] Unknown tool requested: ${name}`);
    return {
      results: [
        {
          toolCallId,
          result: `Error: Unknown tool "${name}". Available tools: ${Object.keys(toolRouter).join(', ')}`,
        },
      ],
    };
  }

  try {
    const result = await handler(args);
    logger.info(`[toolRouter] Tool ${name} completed successfully`);
    return {
      results: [{ toolCallId, result }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[toolRouter] Tool ${name} failed: ${errorMessage}`);
    return {
      results: [
        {
          toolCallId,
          result: `Error executing "${name}": ${errorMessage}`,
        },
      ],
    };
  }
}
