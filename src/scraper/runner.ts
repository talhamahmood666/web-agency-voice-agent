#!/usr/bin/env npx ts-node
import { GooglePlacesScraper, ScrapeStats } from './scraper';
import config from './config.json';

function parseArgs(): {
  trades: string[];
  states: string[];
  maxLeads: number;
  dryRun: boolean;
} {
  const args = process.argv.slice(2);

  function getArg(name: string): string | undefined {
    // Support both --name=value and --name value
    const eq = args.find((a) => a.startsWith(`--${name}=`));
    if (eq) return eq.split('=')[1];
    const idx = args.indexOf(`--${name}`);
    if (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) {
      return args[idx + 1];
    }
    return undefined;
  }

  const tradesVal = getArg('trades');
  const statesVal = getArg('states');
  const maxLeadsVal = getArg('max-leads');
  const dryRun = args.includes('--dry-run');

  const allTrades = Object.keys(config.trades);
  const allStates = Object.keys(config.states);

  return {
    trades: tradesVal ? tradesVal.split(',').filter((t) => allTrades.includes(t)) : allTrades,
    states: statesVal ? statesVal.split(',').filter((s) => allStates.includes(s)) : allStates,
    maxLeads: maxLeadsVal ? parseInt(maxLeadsVal, 10) : 0,
    dryRun,
  };
}

async function main() {
  const opts = parseArgs();
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey && !opts.dryRun) {
    console.error('Error: GOOGLE_PLACES_API_KEY not set in environment.');
    console.error('Set it in .env or export GOOGLE_PLACES_API_KEY=your_key');
    process.exit(1);
  }

  console.log('Google Places Lead Scraper');
  console.log(`Trades: ${opts.trades.join(', ')}`);
  console.log(`States: ${opts.states.join(', ')}`);
  console.log(`Max leads: ${opts.maxLeads > 0 ? opts.maxLeads : 'unlimited'}`);
  console.log(`Dry run: ${opts.dryRun ? 'yes' : 'no'}`);
  console.log('');

  const scraper = new GooglePlacesScraper(apiKey || '');
  const stats = await scraper.run(opts.trades, opts.states, opts.maxLeads, opts.dryRun);

  console.log('\n=== Scrape Complete ===');
  console.log(`Total queries:       ${stats.totalQueries}`);
  console.log(`Total results:       ${stats.totalResults}`);
  console.log(`New leads:           ${stats.newLeads}`);
  console.log(`Owners found:        ${stats.ownersFound}`);
  console.log(`Dupes filtered:      ${stats.dupesFiltered}`);
  console.log(`Filtered - no phone: ${stats.filtered.noPhone}`);
  console.log(`Filtered - website:  ${stats.filtered.hasRealWebsite}`);
  console.log(`Filtered - inactive: ${stats.filtered.inactive}`);
  console.log(`Filtered - closed:   ${stats.filtered.closed}`);
  console.log(`Filtered - <reviews: ${stats.filtered.tooFewReviews}`);
  console.log(`Filtered - no recent: ${stats.filtered.noRecentReviews}`);
  console.log(`Est. API cost:       $${stats.estimatedCost.toFixed(2)}`);

  if (!opts.dryRun && stats.newLeads > 0) {
    console.log(`\nLeads saved to data/scraped_leads.csv`);
    console.log(`Run "npm run import-leads" to import into the lead store.`);
  }
}

main().catch((err) => {
  console.error('Scraper failed:', err);
  process.exit(1);
});
