export interface TravelPreferences {
  seatType: string;
  minHotelRating: number;
  cabinClass: string;
  preferredAirlines: string[];
}

export interface DiningPreferences {
  ambiance: string;
  dietaryRestrictions: string[];
  preferredCuisines: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  stripeCustomerId?: string;
  subscriptionStatus: 'active' | 'trialing' | 'canceled' | 'none';
  subscriptionTier?: 'executive' | 'standard';
  autoBookEnabled: boolean;
  zeroRetentionEnabled: boolean;
  travelPreferences: TravelPreferences;
  diningPreferences: DiningPreferences;
  nylasGrantId?: string;
  nylasAccountStatus: 'connected' | 'syncing' | 'disconnected';
  lastEmailSyncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
