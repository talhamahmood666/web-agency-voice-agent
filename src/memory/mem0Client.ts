import { env } from '../config/env';
import { memoryStore } from '../tools/saveMemory';
import logger from '../utils/logger';

interface Mem0Memory {
  id: string;
  userId: string;
  content: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

const BASE_URL = 'https://api.mem0.ai/v1';

let warnedLocalFallback = false;

export class Mem0Client {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || env.MEM0_API_KEY;

    if (!this.apiKey && !warnedLocalFallback) {
      warnedLocalFallback = true;
      logger.warn('[Mem0Client] No MEM0_API_KEY set — using local memory fallback');
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Store a memory for a given user (lead).
   * Falls back to local memoryStore if no API key or on API failure.
   */
  async addMemory(
    userId: string,
    content: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    if (!this.apiKey) {
      this.addLocalMemory(userId, content, metadata);
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/memories`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ user_id: userId, content, metadata }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Mem0 API error ${response.status}: ${errBody}`);
      }

      logger.info(`[Mem0Client] Memory stored for user ${userId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[Mem0Client] Mem0 API failure, falling back to local: ${message}`);
      this.addLocalMemory(userId, content, metadata);
    }
  }

  /**
   * Retrieve all memories for a user.
   */
  async getMemories(userId: string): Promise<Mem0Memory[]> {
    if (!this.apiKey) {
      return this.getLocalMemories(userId);
    }

    try {
      const response = await fetch(`${BASE_URL}/memories?user_id=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Mem0 API error ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      return (data as Mem0Memory[]) || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[Mem0Client] Mem0 fetch failed, falling back to local: ${message}`);
      return this.getLocalMemories(userId);
    }
  }

  /**
   * Search memories for a user by query.
   */
  async searchMemories(userId: string, query: string): Promise<Mem0Memory[]> {
    if (!this.apiKey) {
      const all = this.getLocalMemories(userId);
      // Simple local search: case-insensitive substring match
      const lower = query.toLowerCase();
      return all.filter(
        (m) =>
          m.content.toLowerCase().includes(lower) ||
          JSON.stringify(m.metadata || {}).toLowerCase().includes(lower)
      );
    }

    try {
      const response = await fetch(`${BASE_URL}/memories/search`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ user_id: userId, query }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Mem0 API error ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      return (data as Mem0Memory[]) || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[Mem0Client] Mem0 search failed, falling back to local: ${message}`);
      const all = this.getLocalMemories(userId);
      const lower = query.toLowerCase();
      return all.filter(
        (m) =>
          m.content.toLowerCase().includes(lower) ||
          JSON.stringify(m.metadata || {}).toLowerCase().includes(lower)
      );
    }
  }

  // --- Local memory fallback ---

  private addLocalMemory(userId: string, content: string, metadata?: Record<string, string>): void {
    const existing = memoryStore.get(userId) || [];
    existing.push({
      category: metadata?.category || 'general',
      content,
      timestamp: new Date().toISOString(),
    });
    memoryStore.set(userId, existing);
  }

  private getLocalMemories(userId: string): Mem0Memory[] {
    const entries = memoryStore.get(userId) || [];
    return entries.map((entry, idx) => ({
      id: `local-${idx}`,
      userId,
      content: entry.content,
      metadata: { category: entry.category },
      createdAt: entry.timestamp,
    }));
  }
}
