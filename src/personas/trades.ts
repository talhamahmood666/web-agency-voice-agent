import { TradePersona, TradeType } from './types';

const OBJECTION_TEMPLATES: Record<string, string> = {
  busy: "Oh yeah no totally, I won't keep you. When's a better time to catch you? I can call back whenever works.",
  have_website:
    "Oh really? My bad, when I looked you up on Google I couldn't find one. What's the URL? I mean either way I already built the site so if you wanna compare them side by side I can send it over, might give you some ideas.",
  how_much:
    "It's free. The only catch is it's $1,500 if you like it. And I mean I know local businesses can't spend a fortune on a website, that's why I kept the price in reach. Plus you get to see the whole thing before you pay anything so there's literally zero risk.",
  not_interested:
    "No that's totally fine. I mean the site's already built so if you ever wanna take a look at it no pressure. Want me to just text you the link real quick and you can check it out whenever?",
  tried_seo:
    "Yeah I hear that a lot honestly. Most of the time it's because the site was just sitting there not actually set up to show up on Google. That's kind of the whole point of what I do, it's not just a website it's built to actually get you found. But yeah take a look at it first and see what you think.",
  send_email:
    "Yeah for sure. What's the best email? I'll send it right now with the link to the site so you can actually see it.",
};

const trades: Record<TradeType, TradePersona> = {
  plumber: {
    trade: 'plumber',
    painPoints: [
      'Emergency calls from people who aren\'t actually customers — just price shopping at 2 AM',
      'Word of mouth is great until it isn\'t — slow seasons hit hard when referrals dry up',
      'Big franchise plumbing companies outspending you on Google Ads and taking the top spots',
    ],
    hooks: [
      'I was checking out plumbers in {city} and noticed your Google presence is pretty quiet — you\'re probably leaving calls on the table.',
      'Most plumbers I talk to are booked solid from word of mouth, but they\'re missing all the people searching "plumber near me" at 7 PM when a pipe bursts.',
      'Quick question — when\'s the last time someone found you on Google and actually called?',
    ],
    language:
      'Speak like a fellow tradesperson — direct, no fluff. Drop relatable job-site talk. "Pipes don\'t fix themselves and neither do websites."',
    objections: {
      busy: OBJECTION_TEMPLATES.busy,
      have_website: OBJECTION_TEMPLATES.have_website,
      how_much: OBJECTION_TEMPLATES.how_much,
      not_interested: OBJECTION_TEMPLATES.not_interested,
      tried_seo: OBJECTION_TEMPLATES.tried_seo,
      send_email: OBJECTION_TEMPLATES.send_email,
    },
  },

  electrician: {
    trade: 'electrician',
    painPoints: [
      'Getting lumped in with every handyman who can swap an outlet — hard to stand out as a licensed pro',
      'Residential work is feast or famine, and the famine months eat into everything',
      'Nobody searches for an electrician until something is sparking — and by then they\'re panicking and clicking the first ad they see',
    ],
    hooks: [
      'I was looking at electricians in {city} and honestly, your Google listing is invisible — which means Angi and HomeAdvisor are eating your lunch on leads.',
      'Here\'s a fun one — how many people in {city} do you think search "electrician near me" every single week? A lot. And none of them are finding you.',
      'Quick reality check — if someone\'s breaker panel is buzzing right now and they Google an electrician, do they find you or the other guy?',
    ],
    language:
      'Straightforward, professional but not corporate. Respect the license and trade knowledge. "You didn\'t get your license to chase leads — you got it to do great work."',
    objections: {
      busy: OBJECTION_TEMPLATES.busy,
      have_website: OBJECTION_TEMPLATES.have_website,
      how_much: OBJECTION_TEMPLATES.how_much,
      not_interested: OBJECTION_TEMPLATES.not_interested,
      tried_seo: OBJECTION_TEMPLATES.tried_seo,
      send_email: OBJECTION_TEMPLATES.send_email,
    },
  },

  hvac: {
    trade: 'hvac',
    painPoints: [
      'Seasonal business — slammed all summer and winter, ghost town in spring and fall',
      'Competing with private equity-backed HVAC shops that have full marketing teams',
      'Lead aggregators like HomeAdvisor selling the same lead to 5 different contractors',
    ],
    hooks: [
      'I know you guys get hammered in summer and winter, but what about spring and fall? A solid website keeps the calls coming year-round.',
      'The big PE-owned HVAC shops in {city} are spending thousands on marketing every month. You don\'t need to match that — you just need to show up where they\'re weak.',
      'Honest question — how much are you spending on HomeAdvisor or Angi leads right now? Because a good website costs less and those leads are yours, not shared with 4 other shops.',
    ],
    language:
      'Understand the seasonal grind. Talk like someone who gets that HVAC is brutal in peak season. "You\'re already killing yourself in August — let the website do some of the heavy lifting."',
    objections: {
      busy: OBJECTION_TEMPLATES.busy,
      have_website: OBJECTION_TEMPLATES.have_website,
      how_much: OBJECTION_TEMPLATES.how_much,
      not_interested: OBJECTION_TEMPLATES.not_interested,
      tried_seo: OBJECTION_TEMPLATES.tried_seo,
      send_email: OBJECTION_TEMPLATES.send_email,
    },
  },

  roofer: {
    trade: 'roofer',
    painPoints: [
      'Reputation damage from storm chasers and out-of-town crews giving the trade a bad name',
      'Hard to build trust when every competitor claims to be "the best roofer in {city}"',
      'Insurance work is competitive — homeowners don\'t know who\'s legit and who\'s going to vanish after the check clears',
    ],
    hooks: [
      'Roofing in {city} is tough — half the "roofers" online are guys who show up after a hail storm and disappear by winter. A real website with real reviews sets you apart instantly.',
      'Your Google reviews are actually decent — but nobody\'s seeing them because your online presence isn\'t pulling its weight. That\'s a quick fix.',
      'After the next big storm in {city}, are homeowners going to find you or some out-of-state crew with a rented office?',
    ],
    language:
      'Straight shooter, understands the roofing reputation problem. "You actually do good work — let\'s make sure people can tell the difference between you and the storm chasers."',
    objections: {
      busy: OBJECTION_TEMPLATES.busy,
      have_website: OBJECTION_TEMPLATES.have_website,
      how_much: OBJECTION_TEMPLATES.how_much,
      not_interested: OBJECTION_TEMPLATES.not_interested,
      tried_seo: OBJECTION_TEMPLATES.tried_seo,
      send_email: OBJECTION_TEMPLATES.send_email,
    },
  },

  landscaper: {
    trade: 'landscaper',
    painPoints: [
      'Everyone with a pickup and a mower calls themselves a landscaper — hard to command premium pricing',
      'Seasonal cash flow: booming April through October, scraping by the rest of the year',
      'High-end design/build work goes to the firms with polished online portfolios — the mow-and-blow guys can\'t compete on price forever',
    ],
    hooks: [
      'There are probably 50 lawn guys in {city}, but how many actually show up on Google when someone searches "landscaper near me"? Maybe 5 or 6. You should be one of them.',
      'If you\'re doing high-end work — patios, retaining walls, outdoor kitchens — you need a website that looks like the work you do. Right now your online presence doesn\'t match your craftsmanship.',
      'Winter is slow for everyone. But the landscapers who have a steady stream of spring contracts lined up by February? They\'re the ones with a real online presence.',
    ],
    language:
      'Appreciate the craft, talk about curb appeal and pride of work. "You make properties look incredible — let\'s make sure your online presence does the same for your business."',
    objections: {
      busy: OBJECTION_TEMPLATES.busy,
      have_website: OBJECTION_TEMPLATES.have_website,
      how_much: OBJECTION_TEMPLATES.how_much,
      not_interested: OBJECTION_TEMPLATES.not_interested,
      tried_seo: OBJECTION_TEMPLATES.tried_seo,
      send_email: OBJECTION_TEMPLATES.send_email,
    },
  },

  general_contractor: {
    trade: 'general_contractor',
    painPoints: [
      'Biggest jobs come from referrals, but referrals alone don\'t fill a pipeline — you need discovery too',
      'Homeowners are doing more research online before they ever pick up the phone — no website means you never even get considered',
      'Perception problem: if you don\'t have a solid website, high-end clients assume you\'re a handyman, not a GC',
    ],
    hooks: [
      'Most GCs I know live on referrals — and that works until it doesn\'t. What happens when your best referral source retires or moves? A website is insurance for your pipeline.',
      'High-end clients in {city} are Googling you before they ever call. If they don\'t find anything — or worse, find your competitor\'s polished site — you never even get a shot at the bid.',
      'Quick test — Google "general contractor {city}" right now. Are you in the top results? Because that\'s where your next $50k kitchen remodel client is looking.',
    ],
    language:
      'Speak peer-to-peer, like a seasoned builder talking to another pro. "You\'ve built a real business — now build the online front door that matches it."',
    objections: {
      busy: OBJECTION_TEMPLATES.busy,
      have_website: OBJECTION_TEMPLATES.have_website,
      how_much: OBJECTION_TEMPLATES.how_much,
      not_interested: OBJECTION_TEMPLATES.not_interested,
      tried_seo: OBJECTION_TEMPLATES.tried_seo,
      send_email: OBJECTION_TEMPLATES.send_email,
    },
  },

  other: {
    trade: 'other',
    painPoints: [
      'Getting found online is harder than it should be — the phone should be ringing more',
      'Competing against bigger companies with bigger marketing budgets',
      'You know your customers are searching online, but they\'re finding everyone except you',
    ],
    hooks: [
      'I help local service businesses in {city} show up when people are searching for what they do. Right now, I\'m guessing most of your customers find you through word of mouth.',
      'Here\'s the thing — even if you\'re the best at what you do, if people can\'t find you online, it\'s like having an unlisted phone number.',
      'I\'ve been helping businesses like yours get found on Google and actually convert those visitors into calls. Worth a 15-minute chat to see if it makes sense for you?',
    ],
    language:
      'Friendly, genuine, adaptable. Default to warm and curious. "Every business is different — I want to understand yours before I suggest anything."',
    objections: {
      busy: OBJECTION_TEMPLATES.busy,
      have_website: OBJECTION_TEMPLATES.have_website,
      how_much: OBJECTION_TEMPLATES.how_much,
      not_interested: OBJECTION_TEMPLATES.not_interested,
      tried_seo: OBJECTION_TEMPLATES.tried_seo,
      send_email: OBJECTION_TEMPLATES.send_email,
    },
  },
};

export default trades;
