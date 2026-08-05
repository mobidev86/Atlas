export type SeatType = 'aisle' | 'window' | 'middle';
export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';
export type AmbianceType =
  | 'quiet'
  | 'lively'
  | 'casual'
  | 'romantic'
  | 'fine_dining';

export interface TravelPreferences {
  seatType: SeatType;
  minHotelRating: number;
  cabinClass: CabinClass;
  preferredAirlines?: string[];
  preferredHotelChains?: string[];
}

export interface DiningPreferences {
  ambiance: AmbianceType;
  dietaryRestrictions: string[];
  preferredCuisines?: string[];
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
