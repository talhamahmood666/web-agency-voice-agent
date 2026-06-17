import fs from 'fs';
import path from 'path';

const KNOWLEDGE_BASE_DIR = path.resolve(__dirname, '../../knowledge-base');

/**
 * Return absolute file paths to all knowledge-base markdown files.
 */
export function getKnowledgeBaseFiles(): string[] {
  const files: string[] = [
    'agency-services.md',
    'objection-handling.md',
    'trade-specific-hooks.md',
    'faq.md',
    'competitor-comparison.md',
  ];

  return files.map((f) => path.join(KNOWLEDGE_BASE_DIR, f)).filter((f) => fs.existsSync(f));
}

/**
 * Read knowledge base files and concatenate into a single string with section headers.
 * This is a fallback for when Vapi RAG is not configured — the content can be
 * embedded directly into the system prompt.
 */
export function formatKnowledgeForPrompt(filePaths: string[]): string {
  const sections: string[] = [];

  for (const filePath of filePaths) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const filename = path.basename(filePath, '.md');
      const header = filename.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      sections.push(`## ${header}\n\n${content}`);
    } catch {
      // Skip files that can't be read
      continue;
    }
  }

  return sections.join('\n\n---\n\n');
}
