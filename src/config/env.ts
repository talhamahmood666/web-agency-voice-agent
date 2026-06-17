import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  VAPI_API_KEY: string;
  VAPI_PHONE_NUMBER_ID: string;
  DEEPSEEK_API_KEY: string;
  DEEPSEEK_MODEL: string;
  DEEPSEEK_API_URL: string;
  ELEVENLABS_API_KEY: string;
  ELEVENLABS_VOICE_ID: string;
  DEEPGRAM_API_KEY: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
  MEM0_API_KEY: string;
  GOOGLE_CALENDAR_API_KEY: string;
  SENDGRID_API_KEY: string;
  NGROK_URL: string;
  AGENCY_NAME: string;
  AGENT_NAME: string;
  TRANSFER_PHONE_NUMBER: string;
}

const REQUIRED_VARS: (keyof EnvConfig)[] = ['PORT', 'NODE_ENV'];

function loadConfig(): EnvConfig {
  const config: EnvConfig = {
    PORT: parseInt(process.env.PORT || '3000', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    VAPI_API_KEY: process.env.VAPI_API_KEY || '',
    VAPI_PHONE_NUMBER_ID: process.env.VAPI_PHONE_NUMBER_ID || '',
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    DEEPSEEK_API_URL: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
    ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || '',
    DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || '',
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
    MEM0_API_KEY: process.env.MEM0_API_KEY || '',
    GOOGLE_CALENDAR_API_KEY: process.env.GOOGLE_CALENDAR_API_KEY || '',
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
    NGROK_URL: process.env.NGROK_URL || '',
    AGENCY_NAME: process.env.AGENCY_NAME || 'Creed Web Designs',
    AGENT_NAME: process.env.AGENT_NAME || '',
    TRANSFER_PHONE_NUMBER: process.env.TRANSFER_PHONE_NUMBER || '',
  };

  // Validate required vars — throw if missing
  for (const key of REQUIRED_VARS) {
    if (!config[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  // Warn for optional vars that are empty (so we can develop incrementally)
  const OPTIONAL_VARS: (keyof EnvConfig)[] = [
    'VAPI_API_KEY',
    'VAPI_PHONE_NUMBER_ID',
    'DEEPSEEK_API_KEY',
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_VOICE_ID',
    'DEEPGRAM_API_KEY',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'MEM0_API_KEY',
    'GOOGLE_CALENDAR_API_KEY',
    'SENDGRID_API_KEY',
  ];

  for (const key of OPTIONAL_VARS) {
    if (!config[key]) {
      console.warn(`[env] Warning: ${key} is not set — some features will be unavailable`);
    }
  }

  return config;
}

export const env = loadConfig();
