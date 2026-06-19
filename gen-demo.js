const { generateDemoPage, generateDemoConfig } = require('./dist/demos/generator');
const fs = require('fs');
const path = require('path');

const config = generateDemoConfig({
  id: 'test-001',
  businessName: 'Texas Pro Plumbing',
  ownerName: 'Mike',
  trade: 'plumber',
  phoneNumber: '+12076890006',
  city: 'Temple',
  state: 'TX',
  status: 'new',
  googleRating: 4.7,
  reviewCount: 23,
  source: 'manual',
  createdAt: new Date().toISOString(),
  callAttempts: 0,
});
const html = generateDemoPage(config);
const demosDir = path.resolve(__dirname, 'public/demos');
if (!fs.existsSync(demosDir)) fs.mkdirSync(demosDir, { recursive: true });
fs.writeFileSync(path.join(demosDir, 'texas-pro-plumbing-temple.html'), html);
console.log('Demo generated: public/demos/texas-pro-plumbing-temple.html');
