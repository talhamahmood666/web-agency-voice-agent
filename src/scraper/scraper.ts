import fs from 'fs';
import path from 'path';
import config from './config.json';

const DATA_DIR = path.resolve(__dirname, '../../data');
const SEEN_FILE = path.join(DATA_DIR, 'seen_place_ids.txt');
const OUTPUT_FILE = path.join(DATA_DIR, 'scraped_leads.csv');

const STATE_TZ: Record<string, string> = {
  TX: 'America/Chicago', OK: 'America/Chicago', AR: 'America/Chicago',
  LA: 'America/Chicago', MS: 'America/Chicago', AL: 'America/Chicago',
  TN: 'America/Chicago', GA: 'America/New_York', SC: 'America/New_York',
  NC: 'America/New_York',
};

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  formatted_address?: string;
  reviews?: Array<{ author_name?: string; relative_time_description?: string; time?: number }>;
}

interface ScrapedLead {
  id: string;
  businessName: string;
  ownerName: string;
  trade: string;
  phoneNumber: string;
  email: string;
  city: string;
  state: string;
  hasWebsite: boolean;
  websiteUrl: string | null;
  googleReviewCount: number;
  googleRating: number;
  source: string;
  status: string;
  callCount: number;
  lastCallDate: null;
  nextCallDate: null;
  meetingDate: null;
  timezone: string;
  notes: string;
}

export interface FilterRejection {
  noPhone: number;
  hasRealWebsite: number;
  inactive: number;
  closed: number;
  tooFewReviews: number;
  noRecentReviews: number;
}

export interface ScrapeStats {
  totalQueries: number;
  totalResults: number;
  newLeads: number;
  dupesFiltered: number;
  filtered: FilterRejection;
  ownersFound: number;
  estimatedCost: number;
}

export class GooglePlacesScraper {
  private apiKey: string;
  private seenIds: Set<string>;
  private leads: ScrapedLead[];
  private stats: ScrapeStats;
  private textSearchCost = 0.032;
  private detailCost = 0.017;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.seenIds = new Set();
    this.leads = [];
    this.stats = {
      totalQueries: 0, totalResults: 0, newLeads: 0, dupesFiltered: 0,
      filtered: { noPhone: 0, hasRealWebsite: 0, inactive: 0, closed: 0, tooFewReviews: 0, noRecentReviews: 0 },
      ownersFound: 0, estimatedCost: 0,
    };
  }

  loadSeenIds(): void {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(SEEN_FILE)) {
      fs.readFileSync(SEEN_FILE, 'utf-8').split('\n').forEach((id) => {
        if (id.trim()) this.seenIds.add(id.trim());
      });
    }
  }

  saveSeenIds(): void {
    fs.writeFileSync(SEEN_FILE, Array.from(this.seenIds).join('\n') + '\n', 'utf-8');
  }

  saveLeads(): void {
    const headers = ['id','businessName','ownerName','trade','phoneNumber','email','city','state','hasWebsite','websiteUrl','googleReviewCount','googleRating','source','status','callCount','lastCallDate','nextCallDate','meetingDate','timezone','notes'];
    const rows = this.leads.map((l) =>
      headers.map((h) => {
        const val = (l as unknown as Record<string, unknown>)[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') ? `"${str}"` : str;
      }).join(',')
    );
    fs.writeFileSync(OUTPUT_FILE, [headers.join(','), ...rows].join('\n'), 'utf-8');
  }

  async run(trades: string[], states: string[], maxLeads: number, dryRun: boolean): Promise<ScrapeStats> {
    this.loadSeenIds();

    const queries: Array<{ trade: string; searchTerm: string; city: string; state: string }> = [];
    for (const tradeKey of trades) {
      for (const state of states) {
        for (const city of (config.states as Record<string, string[]>)[state] || []) {
          for (const term of (config.trades as Record<string, string[]>)[tradeKey] || []) {
            queries.push({ trade: tradeKey, searchTerm: term, city, state });
          }
        }
      }
    }

    if (dryRun) {
      console.log(`Dry run — would execute ${queries.length} queries:`);
      queries.slice(0, 20).forEach(q => console.log(`  "${q.searchTerm} in ${q.city}, ${q.state}" → trade: ${q.trade}`));
      if (queries.length > 20) console.log(`  ... and ${queries.length - 20} more queries`);
      const estCost = queries.length * this.textSearchCost + queries.length * this.detailCost;
      console.log(`\nEstimated API cost: $${estCost.toFixed(2)}`);
      return { ...this.stats, totalQueries: queries.length, estimatedCost: estCost };
    }

    for (const q of queries) {
      if (maxLeads > 0 && this.leads.length >= maxLeads) { console.log(`Reached max leads (${maxLeads}). Stopping.`); break; }
      this.stats.totalQueries++;

      try {
        const places = await this.textSearch(q.searchTerm, q.city, q.state);
        this.stats.totalResults += places.length;
        const cityReasons: Record<string, number> = { dupes: 0, noPhone: 0, hasRealWebsite: 0, inactive: 0, closed: 0, tooFewReviews: 0, noRecentReviews: 0 };
        let cityNew = 0;

        for (const place of places) {
          if (this.seenIds.has(place.place_id)) { cityReasons.dupes++; this.stats.dupesFiltered++; continue; }
          this.seenIds.add(place.place_id);

          const details = await this.getPlaceDetails(place.place_id);
          await this.sleep(config.delayBetweenRequests);

          // Filter a: business_status must be OPERATIONAL
          const status = details?.business_status || 'OPERATIONAL';
          if (status === 'CLOSED_TEMPORARILY') { cityReasons.inactive++; this.stats.filtered.inactive++; continue; }
          if (status === 'CLOSED_PERMANENTLY') { cityReasons.closed++; this.stats.filtered.closed++; continue; }

          // Filter b: must have phone
          if (!details?.formatted_phone_number) { cityReasons.noPhone++; this.stats.filtered.noPhone++; continue; }

          // Filter c: no website or excluded domain
          const website = details.website || '';
          if (website) {
            const domain = extractDomain(website);
            if (domain && !config.excludedDomains.includes(domain)) {
              cityReasons.hasRealWebsite++; this.stats.filtered.hasRealWebsite++; continue;
            }
          }

          // Filter d: min reviews
          const reviewCount = details.user_ratings_total || 0;
          if (reviewCount < config.minReviews) { cityReasons.tooFewReviews++; this.stats.filtered.tooFewReviews++; continue; }

          // Filter e: at least one recent review within maxReviewAgeDays
          if (details.reviews && details.reviews.length > 0) {
            const cutoff = Date.now() - config.maxReviewAgeDays * 24 * 60 * 60 * 1000;
            const hasRecent = details.reviews.some(r => (r.time || 0) * 1000 >= cutoff);
            if (!hasRecent) { cityReasons.noRecentReviews++; this.stats.filtered.noRecentReviews++; continue; }
          }

          // Extract owner name
          const ownerName = extractOwnerName(details.name, details.reviews || []);

          const lead: ScrapedLead = {
            id: `gm-${details.place_id}`,
            businessName: details.name || place.name || 'Unknown',
            ownerName,
            trade: q.trade,
            phoneNumber: details.formatted_phone_number || '',
            email: '',
            city: q.city,
            state: q.state,
            hasWebsite: false,
            websiteUrl: null,
            googleReviewCount: reviewCount,
            googleRating: details.rating || 0,
            source: 'google_maps',
            status: 'new',
            callCount: 0,
            lastCallDate: null, nextCallDate: null, meetingDate: null,
            timezone: STATE_TZ[q.state] || 'America/Chicago',
            notes: ownerName ? `Owner name extracted from Google: ${ownerName}` : '',
          };

          this.leads.push(lead);
          cityNew++; this.stats.newLeads++;
          if (ownerName) this.stats.ownersFound++;
          if (maxLeads > 0 && this.leads.length >= maxLeads) break;
        }

        const filterParts = Object.entries(cityReasons).filter(([,v]) => v > 0).map(([k,v]) => `${v} ${k}`).join(', ');
        console.log(`  → ${q.searchTerm} in ${q.city}: ${places.length} results (${cityNew} new${filterParts ? ', ' + filterParts : ''})`);
      } catch (error) {
        console.error(`  ✗ Error: ${error instanceof Error ? error.message : error}`);
      }
      await this.sleep(config.delayBetweenRequests);
    }

    this.saveLeads();
    this.saveSeenIds();
    this.stats.estimatedCost = this.stats.totalQueries * this.textSearchCost + this.stats.newLeads * this.detailCost * 2;
    return this.stats;
  }

  private async textSearch(query: string, city: string, state: string): Promise<PlaceResult[]> {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${query} in ${city}, ${state}`)}&key=${this.apiKey}`;
    const data = await fetch(url).then(r => r.json()) as { status: string; results?: PlaceResult[]; error_message?: string };
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') throw new Error(`Places API: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`);
    return (data.results || []).slice(0, config.maxResultsPerQuery);
  }

  private async getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
    const fields = 'name,formatted_phone_number,website,rating,user_ratings_total,business_status,formatted_address,reviews';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${this.apiKey}`;
    const data = await fetch(url).then(r => r.json()) as { status: string; result?: PlaceResult };
    if (data.status !== 'OK') return null;
    return data.result || null;
  }

  private sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }
  getLeads(): ScrapedLead[] { return this.leads; }
}

/** Extract domain from URL string. */
function extractDomain(url: string): string | null {
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return null; }
}

/** Extract owner first name from business name patterns or reviews. */
function extractOwnerName(businessName: string, reviews: PlaceResult['reviews']): string {
  // Try business name patterns like "Mike's Plumbing", "Joe Smith HVAC"
  const nameMatch = businessName.match(/^([A-Z][a-z]+)(?:'s|\s+[A-Z])/);
  if (nameMatch) return nameMatch[1];

  // Try review author names (common first name patterns)
  if (reviews && reviews.length > 0) {
    for (const review of reviews) {
      const author = review.author_name || '';
      const parts = author.split(' ');
      if (parts.length > 0) {
        const first = parts[0];
        // Only accept if looks like a real first name (2+ chars, starts with uppercase)
        if (first.length >= 2 && /^[A-Z][a-z]+$/.test(first)) {
          return first;
        }
      }
    }
  }

  return '';
}
