import logger from '../utils/logger';

interface SaveMemoryArgs {
  leadId: string;
  category: 'objection' | 'interest' | 'personal' | 'callback' | 'qualification';
  content: string;
}

interface MemoryEntry {
  category: string;
  content: string;
  timestamp: string;
}

// In-memory store — used as fallback when Mem0 is unavailable
export const memoryStore = new Map<string, MemoryEntry[]>();

// Module-level Mem0Client reference — set via setMem0Client()
let mem0ClientInstance: { addMemory: (userId: string, content: string, metadata?: Record<string, string>) => Promise<void> } | null = null;

export function setMem0Client(client: { addMemory: (userId: string, content: string, metadata?: Record<string, string>) => Promise<void> }): void {
  mem0ClientInstance = client;
}

export async function saveMemory(args: Record<string, unknown>): Promise<string> {
  const { leadId, category, content } = args as unknown as SaveMemoryArgs;

  const entry: MemoryEntry = {
    category,
    content,
    timestamp: new Date().toISOString(),
  };

  // Always save to local store as backup
  const existing = memoryStore.get(leadId) || [];
  existing.push(entry);
  memoryStore.set(leadId, existing);

  // Also save to Mem0 if available
  if (mem0ClientInstance) {
    try {
      await mem0ClientInstance.addMemory(leadId, content, { category });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[saveMemory] Mem0 save failed (local saved): ${message}`);
    }
  }

  logger.info(`[saveMemory] Saved memory for lead ${leadId} [${category}]: ${content.substring(0, 80)}...`);

  return `Memory saved for lead ${leadId} (${category}): "${content}". Total memories: ${existing.length}.`;
}
