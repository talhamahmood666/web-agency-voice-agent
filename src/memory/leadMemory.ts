import { Mem0Client } from './mem0Client';
import logger from '../utils/logger';

/**
 * Fetch all memories for a lead and format them into a context string
 * suitable for embedding in the system prompt.
 */
export async function getLeadContext(
  leadId: string,
  mem0Client: Mem0Client
): Promise<string> {
  try {
    const memories = await mem0Client.getMemories(leadId);

    if (!memories || memories.length === 0) {
      return '';
    }

    const lines = memories
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((m) => {
        const date = new Date(m.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        return `- ${date}: ${m.content}`;
      });

    return `Previous interactions with this lead:\n${lines.join('\n')}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[leadMemory] Failed to get lead context for ${leadId}: ${message}`);
    return '';
  }
}

/**
 * Save a memory for a lead to Mem0 (or local fallback).
 */
export async function saveLeadMemory(
  leadId: string,
  category: string,
  content: string,
  mem0Client: Mem0Client
): Promise<void> {
  try {
    await mem0Client.addMemory(leadId, content, { category });
    logger.info(`[leadMemory] Saved memory for lead ${leadId} [${category}]`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[leadMemory] Failed to save memory for ${leadId}: ${message}`);
  }
}
