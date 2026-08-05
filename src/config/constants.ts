import { DiningPreferences, TravelPreferences } from '../types/UserProfile';

export const ONBOARDING_KEY = 'hasCompletedOnboarding';

export const DEFAULT_TRAVEL_PREFERENCES: TravelPreferences = {
  seatType: 'aisle',
  minHotelRating: 4,
  cabinClass: 'business',
  preferredAirlines: [],
};

export const DEFAULT_DINING_PREFERENCES: DiningPreferences = {
  ambiance: 'quiet',
  dietaryRestrictions: [],
  preferredCuisines: [],
};
