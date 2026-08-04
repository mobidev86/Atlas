/**
 * Centralized Environment Configuration for Project Atlas
 *
 * Note: All 3rd party API keys, Supabase credentials, and payment gateway configurations
 * are centralized here for easy substitution when production credentials are provided.
 */

import Config from 'react-native-config';

export const ENV = {
  // Supabase Configuration
  SUPABASE_URL:
    Config.SUPABASE_URL || 'https://jhlwjhylkokkydszgwpx.supabase.co',
  SUPABASE_ANON_KEY:
    Config.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpobHdqaHlsa29ra3lkc3pnd3B4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4ODc3MjksImV4cCI6MjEwMDQ2MzcyOX0.f0nAJE720ouqD-rMDLvDSFJE467ZqywQHQXDe-dcf2M',

  // OpenAI Integration (NL Intent Parser, Email Summaries, Dictation STT)
  OPENAI_API_KEY: Config.OPENAI_API_KEY || 'sk-atlas-placeholder-openai-key',
  OPENAI_MODEL: 'gpt-4o-mini',
  OPENAI_WHISPER_MODEL: 'whisper-1',
  ZERO_RETENTION_DEFAULT: true, // Always enforce store: false on LLM calls

  // Email Integration (Nylas REST API v3)
  NYLAS_API_KEY: Config.NYLAS_API_KEY || 'nyl_placeholder_api_key',
  NYLAS_CLIENT_ID: Config.NYLAS_CLIENT_ID || 'atlas-nylas-client-id',
  NYLAS_API_URI: 'https://api.us.nylas.com/v3',

  // Flight & Travel Lookup (Amadeus / Skyscanner)
  AMADEUS_API_KEY: Config.AMADEUS_API_KEY || 'amadeus_placeholder_key',
  AMADEUS_API_SECRET: Config.AMADEUS_API_SECRET || 'amadeus_placeholder_secret',
  AMADEUS_API_URL: 'https://test.api.amadeus.com/v1',

  // Dining & Restaurant Search (Yelp Fusion / OpenTable)
  YELP_API_KEY: Config.YELP_API_KEY || 'yelp_placeholder_key',
  OPENTABLE_API_KEY: Config.OPENTABLE_API_KEY || 'opentable_placeholder_key',

  // Payment & Subscription (Stripe)
  STRIPE_PUBLISHABLE_KEY:
    Config.STRIPE_PUBLISHABLE_KEY || 'pk_test_atlas_placeholder_key',

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
