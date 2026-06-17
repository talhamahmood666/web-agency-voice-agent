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

export interface ScrapeStats {
  totalQueries: number;
  totalResults: number;
  newLeads: number;
  dupesFiltered: number;
  noPhoneFiltered: number;
  hasWebsiteFiltered: number;
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
      totalQueries: 0,
      totalResults: 0,
      newLeads: 0,
      dupesFiltered: 0,
      noPhoneFiltered: 0,
      hasWebsiteFiltered: 0,
      estimatedCost: 0,
    };
  }

  /** Load previously seen place IDs from file. */
  loadSeenIds(): void {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(SEEN_FILE)) {
      const content = fs.readFileSync(SEEN_FILE, 'utf-8');
      content.split('\n').forEach((id) => {
        const trimmed = id.trim();
        if (trimmed) this.seenIds.add(trimmed);
      });
    }
  }

  /** Save seen place IDs to file. */
  saveSeenIds(): void {
    fs.writeFileSync(SEEN_FILE, Array.from(this.seenIds).join('\n') + '\n', 'utf-8');
  }

  /** Save scraped leads to CSV. */
  saveLeads(): void {
    const headers = [
      'id', 'businessName', 'ownerName', 'trade', 'phoneNumber', 'email',
      'city', 'state', 'hasWebsite', 'websiteUrl', 'googleReviewCount',
      'googleRating', 'source', 'status', 'callCount', 'lastCallDate',
      'nextCallDate', 'meetingDate', 'timezone', 'notes',
    ];

    const rows = this.leads.map((l) =>
      headers
        .map((h) => {
          const val = (l as unknown as Record<string, unknown>)[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          return str.includes(',') ? `"${str}"` : str;
        })
        .join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    fs.writeFileSync(OUTPUT_FILE, csv, 'utf-8');
  }

  /** Run the scraper. */
  async run(
    trades: string[],
    states: string[],
    maxLeads: number,
    dryRun: boolean
  ): Promise<ScrapeStats> {
    this.loadSeenIds();

    const queries: Array<{ trade: string; searchTerm: string; city: string; state: string }> = [];

    for (const tradeKey of trades) {
      const searchTerms = (config.trades as Record<string, string[]>)[tradeKey];
      if (!searchTerms) continue;
      for (const state of states) {
        const cities = (config.states as Record<string, string[]>)[state];
        if (!cities) continue;
        for (const city of cities) {
          for (const term of searchTerms) {
            queries.push({ trade: tradeKey, searchTerm: term, city, state });
          }
        }
      }
    }

    // For dry-run: just print the query plan
    if (dryRun) {
      console.log(`Dry run — would execute ${queries.length} queries:`);
      const sample = queries.slice(0, 20);
      for (const q of sample) {
        console.log(`  "${q.searchTerm} in ${q.city}, ${q.state}" → trade: ${q.trade}`);
      }
      if (queries.length > 20) {
        console.log(`  ... and ${queries.length - 20} more queries`);
      }
      const estCost = queries.length * this.textSearchCost + queries.length * this.detailCost;
      console.log(`\nEstimated API cost: $${estCost.toFixed(2)}`);
      return { ...this.stats, totalQueries: queries.length, estimatedCost: estCost };
    }

    for (const q of queries) {
      if (maxLeads > 0 && this.leads.length >= maxLeads) {
        console.log(`Reached max leads (${maxLeads}). Stopping.`);
        break;
      }

      this.stats.totalQueries++;
      console.log(`[${this.stats.newLeads} leads] Searching: "${q.searchTerm} in ${q.city}, ${q.state}"...`);

      try {
        const places = await this.textSearch(q.searchTerm, q.city, q.state);
        this.stats.totalResults += places.length;

        let cityNew = 0;
        let cityDupes = 0;
        let cityFiltered = 0;

        for (const place of places) {
          // Dedup by place_id
          if (this.seenIds.has(place.place_id)) {
            cityDupes++;
            this.stats.dupesFiltered++;
            continue;
          }
          this.seenIds.add(place.place_id);

          // Fetch details
          const details = await this.getPlaceDetails(place.place_id);
          await this.sleep(config.delayBetweenRequests);

          // Filter: must have phone
          if (!details?.formatted_phone_number) {
            cityFiltered++;
            this.stats.noPhoneFiltered++;
            continue;
          }

          // Filter: no website or excluded domain
          const website = details.website || '';
          if (website) {
            const domain = extractDomain(website);
            if (domain && !config.excludedDomains.includes(domain)) {
              // Has a real website — not our target
              cityFiltered++;
              this.stats.hasWebsiteFiltered++;
              continue;
            }
          }

          // Filter: min reviews
          const reviewCount = details.user_ratings_total || 0;
          if (reviewCount < config.minReviews) {
            cityFiltered++;
            continue;
          }

          // Create lead
          const lead: ScrapedLead = {
            id: `gm-${details.place_id}`,
            businessName: details.name || place.name || 'Unknown',
            ownerName: '',
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
            lastCallDate: null,
            nextCallDate: null,
            meetingDate: null,
            timezone: STATE_TZ[q.state] || 'America/Chicago',
            notes: `Found via "${q.searchTerm} in ${q.city}, ${q.state}"`,
          };

          this.leads.push(lead);
          cityNew++;
          this.stats.newLeads++;

          if (maxLeads > 0 && this.leads.length >= maxLeads) break;
        }

        console.log(
          `  → ${q.searchTerm} in ${q.city}, ${q.state}: ${places.length} results (${cityNew} new, ${cityDupes} dupes, ${cityFiltered} filtered)`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ Error: ${message}`);
      }

      await this.sleep(config.delayBetweenRequests);
    }

    // Save outputs
    this.saveLeads();
    this.saveSeenIds();
    this.stats.estimatedCost =
      this.stats.totalQueries * this.textSearchCost +
      this.stats.newLeads * this.detailCost * 2; // ~2 detail calls per new lead

    return this.stats;
  }

  /** Google Places Text Search. */
  private async textSearch(
    query: string,
    city: string,
    state: string
  ): Promise<PlaceResult[]> {
    const fullQuery = encodeURIComponent(`${query} in ${city}, ${state}`);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${fullQuery}&key=${this.apiKey}`;

    const response = await fetch(url);
    const data = (await response.json()) as {
      status: string;
      results?: PlaceResult[];
      error_message?: string;
    };

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Places API error: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`);
    }

    return (data.results || []).slice(0, config.maxResultsPerQuery);
  }

  /** Google Place Details. */
  private async getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
    const fields = 'name,formatted_phone_number,website,rating,user_ratings_total,business_status,formatted_address';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${this.apiKey}`;

    const response = await fetch(url);
    const data = (await response.json()) as {
      status: string;
      result?: PlaceResult;
    };

    if (data.status !== 'OK') return null;
    return data.result || null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getLeads(): ScrapedLead[] {
    return this.leads;
  }
}

function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}
