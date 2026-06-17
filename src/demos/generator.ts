import fs from 'fs';
import path from 'path';
import { Lead } from '../data/leads';

export interface DemoConfig {
  businessName: string;
  trade: string;
  tradeLabel: string;
  city: string;
  state: string;
  phone: string;
  tagline: string;
  services: string[];
  serviceArea: string[];
  primaryColor: string;
  primaryDark: string;
  primaryLight: string;
  heroImage: string;
  stars: string;
}

const TRADE_COLORS: Record<string, { primary: string; dark: string; light: string }> = {
  plumber: { primary: '#1565C0', dark: '#0D47A1', light: '#E3F2FD' },
  electrician: { primary: '#F9A825', dark: '#C77800', light: '#FFF8E1' },
  hvac: { primary: '#00897B', dark: '#00695C', light: '#E0F2F1' },
  roofer: { primary: '#A31530', dark: '#7A0E22', light: '#FCE4EC' },
  landscaper: { primary: '#2E7D32', dark: '#1B5E20', light: '#E8F5E9' },
  general_contractor: { primary: '#37474F', dark: '#263238', light: '#ECEFF1' },
  other: { primary: '#1565C0', dark: '#0D47A1', light: '#E3F2FD' },
};

const TRADE_SERVICES: Record<string, string[]> = {
  plumber: ['Emergency Repairs', 'Drain Cleaning', 'Water Heater Installation', 'Pipe Repair & Replacement', 'Leak Detection', 'Sewer Line Services', 'Fixture Installation', 'Bathroom Remodeling'],
  electrician: ['Electrical Repairs', 'Panel Upgrades', 'Wiring & Rewiring', 'Lighting Installation', 'Ceiling Fan Installation', 'Circuit Breaker Repair', 'EV Charger Installation', 'Whole-Home Surge Protection'],
  hvac: ['AC Installation & Repair', 'Furnace Service', 'Heat Pump Installation', 'Duct Cleaning', 'Indoor Air Quality', 'Thermostat Upgrades', 'Commercial HVAC', 'Emergency Heating & Cooling'],
  roofer: ['Roof Repair', 'Roof Replacement', 'Storm Damage Repair', 'Gutter Installation', 'Roof Inspection', 'Flat Roofing', 'Shingle Roofing', 'Emergency Roof Services'],
  landscaper: ['Lawn Maintenance', 'Landscape Design', 'Hardscaping', 'Irrigation Systems', 'Tree & Shrub Care', 'Mulching & Cleanup', 'Outdoor Lighting', 'Patio & Walkway Installation'],
  general_contractor: ['Home Remodeling', 'Kitchen Renovation', 'Bathroom Renovation', 'Room Additions', 'Custom Home Building', 'Deck & Patio Construction', 'Drywall & Painting', 'Flooring Installation'],
  other: ['Residential Services', 'Commercial Services', 'Installation', 'Repair & Maintenance', 'Free Estimates & Inspections', 'Emergency Services', 'Custom Solutions', 'Consultation'],
};

const TRADE_HERO_IMAGES: Record<string, string> = {
  plumber: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&q=80',
  electrician: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1200&q=80',
  hvac: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=1200&q=80',
  roofer: 'https://images.unsplash.com/photo-1632759145351-1d04bbf0621e?w=1200&q=80',
  landscaper: 'https://images.unsplash.com/photo-1558904541-eba1a38b21b8?w=1200&q=80',
  general_contractor: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&q=80',
  other: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=1200&q=80',
};

const TRADE_LABELS: Record<string, string> = {
  plumber: 'Plumber', electrician: 'Electrician', hvac: 'HVAC Contractor',
  roofer: 'Roofer', landscaper: 'Landscaper', general_contractor: 'General Contractor',
  other: 'Service Professional',
};

const NEARBY_CACHE: Record<string, string[]> = {};

function getNearbyCities(state: string, currentCity: string, maxCount: number = 10): string[] {
  const key = `${state}|${currentCity}`;
  if (NEARBY_CACHE[key]) return NEARBY_CACHE[key];

  let all: string[] = [];
  try {
    const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../scraper/config.json'), 'utf-8'));
    const stateCities = (config.states as Record<string, string[]>)[state] || [];
    // Pick cities near the current one in the list (simulating proximity)
    const idx = stateCities.findIndex(c => c.toLowerCase() === currentCity.toLowerCase());
    const before = stateCities.slice(Math.max(0, idx - 5), idx).reverse();
    const after = stateCities.slice(idx + 1, idx + 6);
    all = [...after, ...before].slice(0, maxCount);
  } catch {
    all = [];
  }

  // Always include the current city
  if (!all.find(c => c.toLowerCase() === currentCity.toLowerCase())) {
    all.unshift(currentCity);
  }
  if (all.length > maxCount) all = all.slice(0, maxCount);

  NEARBY_CACHE[key] = all;
  return all;
}

/**
 * Generate a DemoConfig from a Lead.
 */
export function generateDemoConfig(lead: Lead): DemoConfig {
  const colors = TRADE_COLORS[lead.trade] || TRADE_COLORS.other;
  const services = TRADE_SERVICES[lead.trade] || TRADE_SERVICES.other;
  const heroImage = TRADE_HERO_IMAGES[lead.trade] || TRADE_HERO_IMAGES.other;
  const tradeLabel = TRADE_LABELS[lead.trade] || TRADE_LABELS.other;

  return {
    businessName: lead.businessName,
    trade: lead.trade,
    tradeLabel,
    city: lead.city,
    state: lead.state,
    phone: lead.phoneNumber,
    tagline: `${lead.city}'s Trusted ${tradeLabel} | Licensed & Insured`,
    services: services.slice(0, 8),
    serviceArea: getNearbyCities(lead.state, lead.city),
    primaryColor: colors.primary,
    primaryDark: colors.dark,
    primaryLight: colors.light,
    heroImage,
    stars: (lead.googleRating || 4.5).toFixed(1),
  };
}

/**
 * Inject a DemoConfig into the template HTML and return the full page.
 */
export function generateDemoPage(config: DemoConfig): string {
  const templatePath = path.resolve(__dirname, 'template.html');
  let html = fs.readFileSync(templatePath, 'utf-8');

  const servicesHtml = config.services.map(s =>
    `<div class="service-card"><h3>${s}</h3><p>Professional ${config.tradeLabel.toLowerCase()} service in ${config.city}.</p></div>`
  ).join('\n');

  const areaHtml = config.serviceArea.map(c => `<span class="area-tag">${c}, ${config.state}</span>`).join('\n');
  const areaJson = config.serviceArea.map(c => `"${c}, ${config.state}"`).join(',');

  const reviewsHtml = [
    { text: `Great service! Called them for an emergency and they were at my door within an hour. Highly recommend.`, author: `${config.city} Homeowner` },
    { text: `Professional, on time, and fair pricing. I've used them twice now and both experiences were excellent.`, author: `${config.city} Resident` },
    { text: `Best ${config.tradeLabel.toLowerCase()} in ${config.city}. They know what they're doing and don't try to upsell you on stuff you don't need.`, author: `Local Business Owner` },
  ].map(r => `<div class="review-card"><div class="stars">★★★★★</div><p class="text">"${r.text}"</p><p class="author">— ${r.author}</p></div>`).join('\n');

  const replacements: Record<string, string> = {
    '{{BUSINESS_NAME}}': config.businessName,
    '{{TRADE_LABEL}}': config.tradeLabel,
    '{{CITY}}': config.city,
    '{{STATE}}': config.state,
    '{{PHONE}}': config.phone,
    '{{TAGLINE}}': config.tagline,
    '{{PRIMARY_COLOR}}': config.primaryColor,
    '{{PRIMARY_DARK}}': config.primaryDark,
    '{{PRIMARY_LIGHT}}': config.primaryLight,
    '{{HERO_IMAGE}}': config.heroImage,
    '{{STARS}}': config.stars,
    '{{SERVICES_HTML}}': servicesHtml,
    '{{AREA_HTML}}': areaHtml,
    '{{SERVICE_AREA_JSON}}': areaJson,
    '{{REVIEWS_HTML}}': reviewsHtml,
    '{{CURRENT_YEAR}}': String(new Date().getFullYear()),
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(key, value);
  }

  return html;
}

/**
 * Generate demo pages for all leads and save to public/demos/.
 */
export function generateAllDemos(leads: Lead[]): { slug: string; businessName: string; city: string; trade: string; ownerName: string }[] {
  const publicDir = path.resolve(__dirname, '../../public/demos');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  const index: Array<{ slug: string; businessName: string; city: string; trade: string; ownerName: string }> = [];

  for (const lead of leads) {
    const slug = `${lead.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${lead.city.toLowerCase().replace(/\s+/g, '-')}`;
    const config = generateDemoConfig(lead);
    const html = generateDemoPage(config);

    const filePath = path.join(publicDir, `${slug}.html`);
    fs.writeFileSync(filePath, html, 'utf-8');

    index.push({ slug, businessName: lead.businessName, city: lead.city, trade: lead.trade, ownerName: lead.ownerName });
  }

  // Save index
  fs.writeFileSync(path.join(publicDir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  return index;
}
