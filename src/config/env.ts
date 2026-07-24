/**
 * Centralized Environment Configuration for Project Atlas
 * 
 * Note: All 3rd party API keys, Supabase credentials, and payment gateway configurations
 * are centralized here for easy substitution when production credentials are provided.
 */

export const ENV = {
  // Supabase Configuration
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://atlas-app.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.atlas_placeholder_key',

  // OpenAI Integration (NL Intent Parser, Email Summaries, Dictation STT)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-atlas-placeholder-openai-key',
  OPENAI_MODEL: 'gpt-4o-mini',
  OPENAI_WHISPER_MODEL: 'whisper-1',
  ZERO_RETENTION_DEFAULT: true, // Always enforce store: false on LLM calls

  // Email Integration (Nylas REST API v3)
  NYLAS_API_KEY: process.env.NYLAS_API_KEY || 'nyl_placeholder_api_key',
  NYLAS_CLIENT_ID: process.env.NYLAS_CLIENT_ID || 'atlas-nylas-client-id',
  NYLAS_API_URI: 'https://api.us.nylas.com/v3',

  // Flight & Travel Lookup (Amadeus / Skyscanner)
  AMADEUS_API_KEY: process.env.AMADEUS_API_KEY || 'amadeus_placeholder_key',
  AMADEUS_API_SECRET: process.env.AMADEUS_API_SECRET || 'amadeus_placeholder_secret',
  AMADEUS_API_URL: 'https://test.api.amadeus.com/v1',

  // Dining & Restaurant Search (Yelp Fusion / OpenTable)
  YELP_API_KEY: process.env.YELP_API_KEY || 'yelp_placeholder_key',
  OPENTABLE_API_KEY: process.env.OPENTABLE_API_KEY || 'opentable_placeholder_key',

  // Payment & Subscription (Stripe)
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_atlas_placeholder_key',

  // App Settings & Retries
  API_TIMEOUT_MS: 15000,
  MAX_RETRY_ATTEMPTS: 3,
  IS_MOCK_FALLBACK_ENABLED: true, // Fallback to realistic mock responses when API keys are unconfigured or fail
};

export function isConfigured(key: keyof typeof ENV): boolean {
  const val = ENV[key];
  if (typeof val !== 'string') return true;
  return !!val && !val.includes('placeholder');
}
