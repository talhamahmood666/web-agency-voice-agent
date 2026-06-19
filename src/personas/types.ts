export type TradeType =
  | 'plumber'
  | 'electrician'
  | 'hvac'
  | 'roofer'
  | 'landscaper'
  | 'general_contractor'
  | 'other';

export interface TradePersona {
  trade: TradeType;
  painPoints: string[];
  hooks: string[];
  language: string;
  objections: Record<string, string>;
}

export type CallType = 'cold_call' | 'follow_up' | 'voicemail';

export interface LeadInfo {
  id: string;
  businessName: string;
  ownerName: string;
  trade: TradeType;
  city: string;
  state: string;
  hasWebsite: boolean;
  websiteUrl: string | null;
  googleReviewCount: number | null;
  googleRating: number | null;
  demoUrl?: string;
}
