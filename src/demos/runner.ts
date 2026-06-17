#!/usr/bin/env npx ts-node
import { LeadStore } from '../data/leads';
import { generateAllDemos } from './generator';

async function main() {
  console.log('Demo Site Generator\n');

  const store = new LeadStore();
  store.loadFromFile();

  const leads = store.getLeadsByStatus('new');
  if (leads.length === 0) {
    console.log('No leads with status "new" found in the lead store.');
    console.log('Import leads first: npm run import-leads');
    process.exit(1);
  }

  console.log(`Found ${leads.length} leads with status "new".`);

  const index = generateAllDemos(leads);
  console.log(`Generated ${index.length} demo sites.`);
  console.log(`Access at http://localhost:3000/demos/[slug].html`);
  console.log(`Index at http://localhost:3000/demos/index.json`);
  console.log('');

  // Print summary
  for (const entry of index.slice(0, 10)) {
    console.log(`  /demos/${entry.slug}.html — ${entry.businessName} (${entry.trade})`);
  }
  if (index.length > 10) {
    console.log(`  ... and ${index.length - 10} more`);
  }
}

main().catch((err) => {
  console.error('Demo generation failed:', err);
  process.exit(1);
});
