export interface TravelPreferences {
  seatType: string;
  minHotelRating: number;
  cabinClass: string;
  preferredAirlines?: string[];
}

export interface DiningPreferences {
  ambiance: string;
  dietaryRestrictions: string[];
  preferredCuisines?: string[];
}

export type NylasAccountStatus =
  | 'connected'
  | 'syncing'
  | 'disconnected';

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;

  autoBookEnabled: boolean;
  zeroRetentionEnabled: boolean;

  travelPreferences: TravelPreferences;
  diningPreferences: DiningPreferences;

  nylasGrantId?: string;
  nylasAccountStatus?: NylasAccountStatus;

  lastEmailSyncedAt?: string | null;

  createdAt: string;
  updatedAt: string;
}