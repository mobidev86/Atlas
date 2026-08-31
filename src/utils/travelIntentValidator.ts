export type TravelIntentType = 'hotel' | 'flight' | 'unsupported';

export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';

export interface TravelIntent {
  type: TravelIntentType;

  destination: string | null;
  origin: string | null;

  check_in: string | null;
  check_out: string | null;

  departure_date: string | null;
  return_date: string | null;

  adults: number | null;
  rooms: number | null;

  passengers: number | null;

  cabin_class: CabinClass | null;

  missing_fields: string[];

  reason: string | null;
}

export interface TravelIntentResponse {
  success: boolean;
  intent?: TravelIntent;
  error?: string;
  code?: string;
}

/**
 * Validates the travel intent returned by OpenAI.
 *
 * Returns:
 *   null  → valid intent
 *   string → validation error
 */
export const validateTravelIntent = (intent: TravelIntent): string | null => {
  /**
   * -----------------------------------------
   * Basic validation
   * -----------------------------------------
   */
  if (!intent) {
    return 'Unable to understand the travel request.';
  }

  /**
   * -----------------------------------------
   * Unsupported request
   * -----------------------------------------
   */
  if (intent.type === 'unsupported') {
    return intent.reason || 'This travel request is not supported.';
  }

  /**
   * -----------------------------------------
   * HOTEL
   * -----------------------------------------
   */
  if (intent.type === 'hotel') {
    /**
     * Destination is required.
     */
    if (!intent.destination) {
      return 'Please provide a hotel destination.';
    }

    /**
     * Check-in date is required.
     */
    if (!intent.check_in || intent.missing_fields?.includes('check_in')) {
      return 'Please provide your hotel check-in date.';
    }

    /**
     * Check-out date is required.
     */
    if (!intent.check_out || intent.missing_fields?.includes('check_out')) {
      return 'Please provide your hotel check-out date.';
    }

    /**
     * Hotel intent is valid.
     */
    return null;
  }

  /**
   * -----------------------------------------
   * FLIGHT
   * -----------------------------------------
   */
  if (intent.type === 'flight') {
    /**
     * Origin is required.
     */
    if (!intent.origin) {
      return 'Please provide your departure location.';
    }

    /**
     * Destination is required.
     */
    if (!intent.destination) {
      return 'Please provide your flight destination.';
    }

    /**
     * Departure date is required.
     */
    if (
      !intent.departure_date ||
      intent.missing_fields?.includes('departure_date')
    ) {
      return 'Please provide your departure date.';
    }

    /**
     * Number of passengers is required.
     */
    if (!intent.passengers || intent.missing_fields?.includes('passengers')) {
      return 'Please provide the number of passengers.';
    }

    /**
     * Flight intent is valid.
     */
    return null;
  }

  /**
   * -----------------------------------------
   * Unknown intent type
   * -----------------------------------------
   */
  return 'Unable to understand the travel request.';
};
