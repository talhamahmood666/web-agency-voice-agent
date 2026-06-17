import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import { TradeType } from '../personas/types';
import { optOutList } from '../tools/logOptOut';
import { isCallableTime } from '../orchestrator/scheduler';

export interface Lead {
  id: string;
  businessName: string;
  ownerName: string;
  trade: TradeType;
  phoneNumber: string;
  email: string;
  city: string;
  state: string;
  hasWebsite: boolean;
  websiteUrl: string | null;
  googleReviewCount: number | null;
  googleRating: number | null;
  source: 'google_maps' | 'yelp' | 'manual' | 'referral';
  status:
    | 'new'
    | 'contacted'
    | 'interested'
    | 'meeting_booked'
    | 'closed'
    | 'declined'
    | 'do_not_call'
    | 'callback_scheduled';
  callCount: number;
  lastCallDate: string | null;
  nextCallDate: string | null;
  meetingDate: string | null;
  timezone: string;
  notes: string;
}

const DATA_DIR = path.resolve(__dirname, '../../data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

const STATE_TZ_MAP: Record<string, string> = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix',
  AR: 'America/Chicago', CA: 'America/Los_Angeles', CO: 'America/Denver',
  CT: 'America/New_York', DE: 'America/New_York', FL: 'America/New_York',
  GA: 'America/New_York', HI: 'Pacific/Honolulu', ID: 'America/Boise',
  IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis', IA: 'America/Chicago',
  KS: 'America/Chicago', KY: 'America/New_York', LA: 'America/Chicago',
  ME: 'America/New_York', MD: 'America/New_York', MA: 'America/New_York',
  MI: 'America/Detroit', MN: 'America/Chicago', MS: 'America/Chicago',
  MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago',
  NV: 'America/Los_Angeles', NH: 'America/New_York', NJ: 'America/New_York',
  NM: 'America/Denver', NY: 'America/New_York', NC: 'America/New_York',
  ND: 'America/Chicago', OH: 'America/New_York', OK: 'America/Chicago',
  OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York',
  SC: 'America/New_York', SD: 'America/Chicago', TN: 'America/Chicago',
  TX: 'America/Chicago', UT: 'America/Denver', VT: 'America/New_York',
  VA: 'America/New_York', WA: 'America/Los_Angeles', WV: 'America/New_York',
  WI: 'America/Chicago', WY: 'America/Denver', DC: 'America/New_York',
};

export class LeadStore {
  private leads: Map<string, Lead>;

  constructor() {
    this.leads = new Map();
  }

  /** Load leads from the JSON file on disk. */
  loadFromFile(): void {
    try {
      if (!fs.existsSync(LEADS_FILE)) {
        logger.info('[LeadStore] No leads.json found — starting empty');
        return;
      }
      const raw = fs.readFileSync(LEADS_FILE, 'utf-8');
      const arr: Lead[] = JSON.parse(raw);
      for (const lead of arr) {
        this.leads.set(lead.id, lead);
      }
      logger.info(`[LeadStore] Loaded ${this.leads.size} leads from file`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[LeadStore] Failed to load leads: ${message}`);
    }
  }

  /** Persist current leads to disk. */
  saveToFile(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const arr = Array.from(this.leads.values());
      fs.writeFileSync(LEADS_FILE, JSON.stringify(arr, null, 2), 'utf-8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[LeadStore] Failed to save leads: ${message}`);
    }
  }

  /** Add a single lead. Auto-saves. */
  addLead(lead: Lead): Lead {
    if (!lead.timezone) {
      lead.timezone = STATE_TZ_MAP[lead.state?.toUpperCase()] || 'America/Chicago';
    }
    this.leads.set(lead.id, lead);
    this.saveToFile();
    logger.info(`[LeadStore] Added lead: ${lead.id} (${lead.businessName})`);
    return lead;
  }

  /** Update a lead by id with partial fields. Auto-saves. */
  updateLead(id: string, partial: Partial<Lead>): Lead | null {
    const existing = this.leads.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...partial };
    this.leads.set(id, updated);
    this.saveToFile();
    return updated;
  }

  /** Get a single lead by id. */
  getLead(id: string): Lead | undefined {
    return this.leads.get(id);
  }

  /** Get all leads, optionally filtered by status and/or trade. */
  getLeads(filters?: { status?: string; trade?: string }): Lead[] {
    let result = Array.from(this.leads.values());
    if (filters?.status) {
      result = result.filter((l) => l.status === filters.status);
    }
    if (filters?.trade) {
      result = result.filter((l) => l.trade === filters.trade);
    }
    return result;
  }

  /** Get leads by status. */
  getLeadsByStatus(status: Lead['status']): Lead[] {
    return this.getLeads({ status });
  }

  /** Get leads by trade. */
  getLeadsByTrade(trade: TradeType): Lead[] {
    return this.getLeads({ trade });
  }

  /** Get all leads. */
  getAllLeads(): Lead[] {
    return Array.from(this.leads.values());
  }

  /**
   * Get the next callable lead.
   * Criteria: status is new/contacted/callback_scheduled, callCount < 3,
   * NOT in optOutList, and currently within callable hours in their timezone.
   * Returns in order of priority: callback_scheduled (by nextCallDate) then new then contacted.
   */
  getCallableLead(): Lead | null {
    const callable: Lead[] = Array.from(this.leads.values()).filter((lead) => {
      // Must be in a callable status
      if (!['new', 'contacted', 'callback_scheduled'].includes(lead.status)) return false;

      // Must not have exceeded max attempts
      if (lead.callCount >= 3) return false;

      // Must not be opted out
      if (optOutList.has(lead.id)) return false;

      // Must be within callable hours in their timezone
      if (!isCallableTime(lead.timezone)) return false;

      // If callback_scheduled, nextCallDate must be now or in the past
      if (lead.status === 'callback_scheduled' && lead.nextCallDate) {
        if (new Date(lead.nextCallDate) > new Date()) return false;
      }

      return true;
    });

    if (callable.length === 0) return null;

    // Sort: callback_scheduled first (by nextCallDate), then new, then contacted
    callable.sort((a, b) => {
      const statusOrder: Record<string, number> = {
        callback_scheduled: 0,
        new: 1,
        contacted: 2,
      };
      const orderDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      if (orderDiff !== 0) return orderDiff;

      // For callback_scheduled, sort by nextCallDate
      if (a.status === 'callback_scheduled' && b.status === 'callback_scheduled') {
        const aDate = a.nextCallDate ? new Date(a.nextCallDate).getTime() : Infinity;
        const bDate = b.nextCallDate ? new Date(b.nextCallDate).getTime() : Infinity;
        return aDate - bDate;
      }

      return 0;
    });

    return callable[0];
  }

  /** Import leads from a CSV file. Assumes header row. */
  importFromCSV(filePath: string): number {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    if (lines.length < 2) return 0;

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (values[idx] || '').trim();
      });

      const lead: Lead = {
        id: row.id || `lead-${Date.now()}-${i}`,
        businessName: row.businessname || row.business_name || '',
        ownerName: row.ownername || row.owner_name || '',
        trade: (row.trade as TradeType) || 'other',
        phoneNumber: row.phonenumber || row.phone_number || row.phone || '',
        email: row.email || '',
        city: row.city || '',
        state: row.state || '',
        hasWebsite: row.haswebsite === 'true' || row.has_website === 'true',
        websiteUrl: row.websiteurl || row.website_url || null,
        googleReviewCount: row.googlereviewcount ? parseInt(row.googlereviewcount, 10) : null,
        googleRating: row.googlerating ? parseFloat(row.googlerating) : null,
        source: (row.source as Lead['source']) || 'manual',
        status: (row.status as Lead['status']) || 'new',
        callCount: row.callcount ? parseInt(row.callcount, 10) : 0,
        lastCallDate: row.lastcalldate || null,
        nextCallDate: row.nextcalldate || null,
        meetingDate: row.meetingdate || null,
        timezone: row.timezone || STATE_TZ_MAP[row.state?.toUpperCase()] || 'America/Chicago',
        notes: row.notes || '',
      };

      this.leads.set(lead.id, lead);
      imported++;
    }

    this.saveToFile();
    logger.info(`[LeadStore] Imported ${imported} leads from CSV`);
    return imported;
  }

  /** Export all leads to a CSV file. */
  exportToCSV(filePath: string): void {
    const headers = [
      'id', 'businessName', 'ownerName', 'trade', 'phoneNumber', 'email',
      'city', 'state', 'hasWebsite', 'websiteUrl', 'googleReviewCount',
      'googleRating', 'source', 'status', 'callCount', 'lastCallDate',
      'nextCallDate', 'meetingDate', 'timezone', 'notes',
    ];

    const rows = Array.from(this.leads.values()).map((lead) =>
      headers
        .map((h) => {
          const val = (lead as unknown as Record<string, unknown>)[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          // Quote strings with commas
          return str.includes(',') ? `"${str}"` : str;
        })
        .join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    fs.writeFileSync(filePath, csv, 'utf-8');
    logger.info(`[LeadStore] Exported ${rows.length} leads to ${filePath}`);
  }
}

/**
 * Parse a single CSV line, respecting quoted fields.
 */
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
