#!/usr/bin/env npx ts-node
import fs from 'fs';
import path from 'path';
import { LeadStore } from '../data/leads';

const DATA_DIR = path.resolve(__dirname, '../../data');
const SCRAPED_FILE = path.join(DATA_DIR, 'scraped_leads.csv');

function main() {
  if (!fs.existsSync(SCRAPED_FILE)) {
    console.error(`No scraped leads file found at ${SCRAPED_FILE}`);
    console.error('Run "npm run scrape" first to generate leads.');
    process.exit(1);
  }

  // Get existing leads before import
  const store = new LeadStore();
  store.loadFromFile();
  const existingPhones = new Set<string>();
  for (const lead of store.getAllLeads()) {
    if (lead.phoneNumber) {
      existingPhones.add(lead.phoneNumber.replace(/\D/g, ''));
    }
  }

  console.log(`Existing leads in store: ${store.getAllLeads().length}`);

  // Import from scraped CSV
  const content = fs.readFileSync(SCRAPED_FILE, 'utf-8');
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    console.log('Scraped CSV is empty.');
    return;
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

  let imported = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').trim();
    });

    const phoneDigits = (row.phonenumber || '').replace(/\D/g, '');

    // Skip if phone already exists in store
    if (phoneDigits && existingPhones.has(phoneDigits)) {
      skipped++;
      continue;
    }

    // Add to store
    store.addLead({
      id: row.id || `scraped-${Date.now()}-${i}`,
      businessName: row.businessname || '',
      ownerName: row.ownername || '',
      trade: (row.trade as any) || 'other',
      phoneNumber: row.phonenumber || '',
      email: row.email || '',
      city: row.city || '',
      state: row.state || '',
      hasWebsite: row.haswebsite === 'true',
      websiteUrl: row.websiteurl || null,
      googleReviewCount: row.googlereviewcount ? parseInt(row.googlereviewcount, 10) : null,
      googleRating: row.googlerating ? parseFloat(row.googlerating) : null,
      source: (row.source as any) || 'google_maps',
      status: 'new',
      callCount: 0,
      lastCallDate: null,
      nextCallDate: null,
      meetingDate: null,
      timezone: row.timezone || 'America/Chicago',
      notes: row.notes || '',
    });

    if (phoneDigits) existingPhones.add(phoneDigits);
    imported++;
  }

  console.log(`Imported ${imported} new leads, ${skipped} dupes skipped, ${store.getAllLeads().length} total leads in store.`);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

main();
