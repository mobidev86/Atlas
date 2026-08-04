import { UserProfile } from '../types/UserProfile';

import { ProfileRow } from '../types/ProfileRow';

export const mapProfileRowToUser = (row: ProfileRow): UserProfile => {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? undefined,
    stripeCustomerId: row.stripe_customer_id ?? undefined,
    subscriptionStatus: row.subscription_status ?? 'none',
    subscriptionTier: row.subscription_tier ?? undefined,
    autoBookEnabled: row.auto_book_enabled ?? false,
    zeroRetentionEnabled: row.zero_retention_enabled ?? true,
    travelPreferences: row.travel_preferences ?? {
      seatType: 'aisle',
      minHotelRating: 4,
      cabinClass: 'business',
      preferredAirlines: [],
    },
    diningPreferences: row.dining_preferences ?? {
      ambiance: 'quiet',
      dietaryRestrictions: [],
      preferredCuisines: [],
    },
    nylasGrantId: row.nylas_grant_id ?? undefined,
    nylasAccountStatus: row.nylas_account_status ?? 'disconnected',
    lastEmailSyncedAt: row.last_email_synced_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};
