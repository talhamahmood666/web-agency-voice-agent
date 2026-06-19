import { CallType, LeadInfo } from '../personas/types';
import trades from '../personas/trades';
import { BASE_PERSONA } from './basePersona';
import { COMPLIANCE_RULES } from './complianceRules';
import { getColdCallObjective, getFollowUpObjective, getVoicemailObjective } from './callObjectives';

function getCallObjective(callType: CallType): string {
  switch (callType) {
    case 'cold_call':
      return getColdCallObjective();
    case 'follow_up':
      return getFollowUpObjective();
    case 'voicemail':
      return getVoicemailObjective();
    default:
      return getColdCallObjective();
  }
}

function buildLeadContext(lead: LeadInfo, demoUrl?: string): string {
  const persona = trades[lead.trade];
  const websiteStatus = lead.hasWebsite
    ? `Has a website (${lead.websiteUrl || 'URL unknown'}).`
    : 'Does NOT have a website.';

  const reviewInfo =
    lead.googleReviewCount !== null && lead.googleRating !== null
      ? `Google: ${lead.googleReviewCount} reviews, ${lead.googleRating}-star rating.`
      : lead.googleReviewCount !== null
        ? `Google: ${lead.googleReviewCount} reviews.`
        : 'Google reviews: unknown.';

  const effectiveDemoUrl = demoUrl || lead.demoUrl || buildDemoUrl(lead);
  const demoLine = effectiveDemoUrl ? `\n- **Demo Site URL:** ${effectiveDemoUrl}` : '';

  return `
## LEAD CONTEXT
- **Name:** ${lead.ownerName}
- **Business:** ${lead.businessName}
- **Trade:** ${lead.trade}
- **Location:** ${lead.city}, ${lead.state}
- **Website:** ${websiteStatus}
- **${reviewInfo}**${demoLine}

### Trade Persona: ${persona.trade}
- **Pain Points:** ${persona.painPoints.join(' | ')}
- **How to talk to them:** ${persona.language}
- **Best hook:** ${persona.hooks[0]}

### Objection Handling (use ONLY when the prospect raises these — don't preempt them):
${Object.entries(persona.objections)
  .map(([key, response]) => `- **"${key}"** → ${response}`)
  .join('\n')}

### Additional Hooks (vary them — don't use the same one every call):
${persona.hooks.slice(1).map((h) => `- ${h}`).join('\n')}
`;
}

export function buildSystemPrompt(
  lead: LeadInfo,
  callType: CallType,
  mem0Context?: string,
  demoUrl?: string
): string {
  const sections: string[] = [];

  // 1. Base persona (identity, tools, tone)
  sections.push(BASE_PERSONA);

  // 2. Call objectives for this call type
  sections.push(getCallObjective(callType));

  // 3. Lead-specific context (trade persona, hooks, objections)
  sections.push(buildLeadContext(lead, demoUrl));

  // 4. Mem0 context if available
  if (mem0Context && mem0Context.trim()) {
    sections.push(`
## PREVIOUS INTERACTIONS (Memory)
${mem0Context.trim()}
`);
  }

  // 5. Compliance rules (always last — non-negotiable)
  sections.push(COMPLIANCE_RULES);

  return sections.join('\n---\n').trim();
}

/** Build the demo URL from a lead's business name and city. */
function buildDemoUrl(lead: LeadInfo): string {
  const slug = `${lead.businessName}-${lead.city}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://demos-weld-rho.vercel.app/${slug}.html`;
}
