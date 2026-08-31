const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DUFFEL_API_KEY = Deno.env.get('DUFFEL_API_KEY');

const DUFFEL_BASE_URL = 'https://api.duffel.com';

/**
 * =========================================
 * TEMPORARY HOTEL LOCATION
 * =========================================
 *
 * For now we always use Dubai coordinates.
 *
 * Later this can be replaced with:
 * - Google Maps Geocoding API
 * OR
 * - Duffel Places API
 */
const DUBAI_LOCATION = {
  latitude: 25.2048,
  longitude: 55.2708,
};

/**
 * =========================================
 * TRAVEL INTENT
 * =========================================
 */

interface TravelIntent {
  type: 'hotel' | 'flight' | 'unsupported';

  destination: string | null;

  origin: string | null;

  check_in: string | null;

  check_out: string | null;

  departure_date: string | null;

  return_date: string | null;

  adults: number | null;

  rooms: number | null;

  passengers: number | null;

  cabin_class: 'economy' | 'premium_economy' | 'business' | 'first' | null;

  missing_fields: string[];

  reason: string | null;
}

interface RequestBody {
  intent?: TravelIntent;
}

/**
 * =========================================
 * FLIGHT TYPES
 * =========================================
 */

interface DuffelPassenger {
  type: 'adult';
}

interface DuffelSlice {
  origin: string;

  destination: string;

  departure_date: string;
}

interface DuffelOfferRequest {
  data: {
    slices: DuffelSlice[];

    passengers: DuffelPassenger[];

    cabin_class: 'economy' | 'premium_economy' | 'business' | 'first';
  };
}

interface ReturnFlight {
  airline: string;

  flightNumber: string;

  origin: string;

  destination: string;

  departureTime: string;

  arrivalTime: string;

  duration?: string;

  stops?: number;
}

interface FlightOption {
  id: string;

  airline: string;

  flightNumber: string;

  origin: string;

  destination: string;

  departureTime: string;

  arrivalTime: string;

  price: string;

  currency?: string;

  cabinClass: string;

  duration?: string;

  stops?: number;

  badge?: string;

  returnFlight?: ReturnFlight;
}

/**
 * =========================================
 * HOTEL TYPES
 * =========================================
 *
 * IMPORTANT:
 *
 * This matches the HotelOption type
 * currently used by the React Native app.
 */

interface HotelOption {
  id: string;

  hotelName: string;

  location: string;

  rating: number;

  pricePerNight: string;

  roomType: string;

  amenities: string[];

  badge?: string;
}

/**
 * =========================================
 * ERROR RESPONSE HELPER
 * =========================================
 */

const errorResponse = (status: number, error: string, code?: string) => {
  return new Response(
    JSON.stringify({
      success: false,

      error,

      ...(code ? { code } : {}),
    }),
    {
      status,

      headers: {
        ...corsHeaders,

        'Content-Type': 'application/json',
      },
    },
  );
};

/**
 * =========================================
 * FLIGHT MAPPING
 * =========================================
 */

/**
 * -----------------------------------------
 * Map Duffel Slice
 * -----------------------------------------
 *
 * Converts one Duffel slice into the
 * simplified flight structure used by
 * the application.
 */
const mapDuffelSlice = (slice: any) => {
  const segments = Array.isArray(slice?.segments) ? slice.segments : [];

  const firstSegment = segments[0];

  const lastSegment =
    segments.length > 0 ? segments[segments.length - 1] : undefined;

  return {
    airline:
      firstSegment?.marketing_carrier?.name ??
      firstSegment?.operating_carrier?.name ??
      '',

    flightNumber:
      firstSegment?.marketing_carrier_flight_number ??
      firstSegment?.operating_carrier_flight_number ??
      '',

    origin: firstSegment?.origin?.iata_code ?? firstSegment?.origin?.iata ?? '',

    destination:
      lastSegment?.destination?.iata_code ??
      lastSegment?.destination?.iata ??
      '',

    departureTime: firstSegment?.departing_at ?? '',

    arrivalTime: lastSegment?.arriving_at ?? '',

    duration: slice?.duration ?? undefined,

    stops: segments.length > 0 ? Math.max(segments.length - 1, 0) : 0,
  };
};

/**
 * -----------------------------------------
 * Map Duffel Offer
 * -----------------------------------------
 */
const mapDuffelOfferToFlightOption = (offer: any): FlightOption => {
  const slices = Array.isArray(offer?.slices) ? offer.slices : [];

  /**
   * Outbound
   */
  const outbound = slices[0] ? mapDuffelSlice(slices[0]) : null;

  /**
   * Return
   */
  const returnFlight = slices[1] ? mapDuffelSlice(slices[1]) : undefined;

  /**
   * Cabin class
   */
  const cabinClass =
    slices[0]?.segments?.[0]?.passengers?.[0]?.cabin_class ?? '';

  /**
   * Base flight option
   */
  const flightOption: FlightOption = {
    id: offer?.id ?? '',

    airline: outbound?.airline ?? '',

    flightNumber: outbound?.flightNumber ?? '',

    origin: outbound?.origin ?? '',

    destination: outbound?.destination ?? '',

    departureTime: outbound?.departureTime ?? '',

    arrivalTime: outbound?.arrivalTime ?? '',

    price: offer?.total_amount ?? '',

    currency: offer?.total_currency ?? undefined,

    cabinClass,

    duration: outbound?.duration,

    stops: outbound?.stops,
  };

  /**
   * Add return flight
   */
  if (returnFlight) {
    flightOption.returnFlight = {
      airline: returnFlight.airline,

      flightNumber: returnFlight.flightNumber,

      origin: returnFlight.origin,

      destination: returnFlight.destination,

      departureTime: returnFlight.departureTime,

      arrivalTime: returnFlight.arrivalTime,

      duration: returnFlight.duration,

      stops: returnFlight.stops,
    };
  }

  return flightOption;
};

/**
 * =========================================
 * HOTEL MAPPING
 * =========================================
 */

/**
 * -----------------------------------------
 * Extract hotel amenities
 * -----------------------------------------
 */
const extractHotelAmenities = (accommodation: any): string[] => {
  const rawAmenities = Array.isArray(accommodation?.amenities)
    ? accommodation.amenities
    : [];

  return rawAmenities
    .map((amenity: any) => {
      if (typeof amenity === 'string') {
        return amenity;
      }

      return amenity?.name ?? amenity?.description ?? '';
    })
    .filter((amenity: string) => Boolean(amenity));
};

/**
 * -----------------------------------------
 * Map Duffel Hotel Result
 * -----------------------------------------
 *
 * Converts the raw Duffel hotel result into
 * the exact HotelOption structure expected
 * by the React Native app.
 *
 * Raw Duffel data is never returned.
 */
const mapDuffelHotelToHotelOption = (
  result: any,

  intent: TravelIntent,
): HotelOption => {
  const accommodation = result?.accommodation ?? {};

  const address = accommodation?.location?.address ?? {};

  /**
   * -----------------------------------------
   * Location
   * -----------------------------------------
   */
  const locationParts = [
    address?.city_name,

    address?.region,

    address?.country_code,
  ].filter(Boolean);

  const location =
    locationParts.length > 0
      ? locationParts.join(', ')
      : intent.destination ?? 'Dubai';

  /**
   * -----------------------------------------
   * Rating
   * -----------------------------------------
   *
   * Always return a number because the
   * app-side HotelOption requires number.
   */
  const rating =
    typeof accommodation?.rating === 'number' ? accommodation.rating : 0;

  /**
   * -----------------------------------------
   * Price
   * -----------------------------------------
   *
   * Duffel's cheapest available rate.
   */
  const pricePerNight =
    result?.cheapest_rate_total_amount ?? result?.cheapest_rate_amount ?? '';

  /**
   * -----------------------------------------
   * Room type
   * -----------------------------------------
   */
  let roomType = '';

  const rooms = Array.isArray(accommodation?.rooms) ? accommodation.rooms : [];

  if (rooms.length > 0) {
    roomType =
      rooms[0]?.name ?? rooms[0]?.room_name ?? rooms[0]?.description ?? '';
  }

  /**
   * -----------------------------------------
   * Amenities
   * -----------------------------------------
   */
  const amenities = extractHotelAmenities(accommodation);

  /**
   * -----------------------------------------
   * Badge
   * -----------------------------------------
   *
   * Do not invent cancellation information.
   */
  let badge: string | undefined;

  if (
    result?.free_cancellation === true ||
    result?.free_cancellation_only === true
  ) {
    badge = 'FREE CANCELLATION';
  }

  /**
   * -----------------------------------------
   * Return clean HotelOption
   * -----------------------------------------
   */
  return {
    id: result?.id ?? accommodation?.id ?? '',

    hotelName: accommodation?.name ?? 'Hotel',

    location,

    rating,

    pricePerNight,

    roomType,

    amenities,

    badge,
  };
};

/**
 * =========================================
 * EDGE FUNCTION
 * =========================================
 */

Deno.serve(async req => {
  /**
   * =========================================
   * CORS
   * =========================================
   */

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    /**
     * =========================================
     * VALIDATE DUFFEL API KEY
     * =========================================
     */

    if (!DUFFEL_API_KEY) {
      throw new Error('DUFFEL_API_KEY is not configured');
    }

    /**
     * =========================================
     * VALIDATE METHOD
     * =========================================
     */

    if (req.method !== 'POST') {
      return errorResponse(405, 'Method not allowed');
    }

    /**
     * =========================================
     * READ REQUEST
     * =========================================
     */

    const body = (await req.json()) as RequestBody;

    const intent = body?.intent;

    if (!intent) {
      return errorResponse(400, 'Travel intent is required');
    }

    /**
     * =========================================
     * FLIGHT SEARCH
     * =========================================
     */

    if (intent.type === 'flight') {
      /**
       * -----------------------------------------
       * Validate origin
       * -----------------------------------------
       */

      if (!intent.origin) {
        return errorResponse(
          400,
          'Flight origin is required.',
          'MISSING_ORIGIN',
        );
      }

      /**
       * -----------------------------------------
       * Validate destination
       * -----------------------------------------
       */

      if (!intent.destination) {
        return errorResponse(
          400,
          'Flight destination is required.',
          'MISSING_DESTINATION',
        );
      }

      /**
       * -----------------------------------------
       * Validate departure date
       * -----------------------------------------
       */

      if (!intent.departure_date) {
        return errorResponse(
          400,
          'Flight departure date is required.',
          'MISSING_DEPARTURE_DATE',
        );
      }

      /**
       * -----------------------------------------
       * Validate passengers
       * -----------------------------------------
       */

      if (!intent.passengers || intent.passengers < 1) {
        return errorResponse(
          400,
          'Number of passengers is required.',
          'MISSING_PASSENGERS',
        );
      }

      /**
       * -----------------------------------------
       * Cabin class
       * -----------------------------------------
       */

      const cabinClass = intent.cabin_class ?? 'economy';

      /**
       * -----------------------------------------
       * Build passengers
       * -----------------------------------------
       */

      const passengers: DuffelPassenger[] = Array.from(
        {
          length: intent.passengers,
        },
        () => ({
          type: 'adult',
        }),
      );

      /**
       * -----------------------------------------
       * Build slices
       * -----------------------------------------
       */

      const slices: DuffelSlice[] = [
        {
          origin: intent.origin,

          destination: intent.destination,

          departure_date: intent.departure_date,
        },
      ];

      /**
       * -----------------------------------------
       * Add return slice
       * -----------------------------------------
       */

      if (intent.return_date) {
        slices.push({
          origin: intent.destination,

          destination: intent.origin,

          departure_date: intent.return_date,
        });
      }

      /**
       * -----------------------------------------
       * Duffel request
       * -----------------------------------------
       */

      const requestBody: DuffelOfferRequest = {
        data: {
          slices,

          passengers,

          cabin_class: cabinClass,
        },
      };

      console.log('DUFFEL FLIGHT REQUEST:', JSON.stringify(requestBody));

      /**
       * -----------------------------------------
       * Call Duffel Air
       * -----------------------------------------
       */

      const duffelResponse = await fetch(
        `${DUFFEL_BASE_URL}/air/offer_requests?return_offers=true&view=offers`,
        {
          method: 'POST',

          headers: {
            Authorization: `Bearer ${DUFFEL_API_KEY}`,

            'Content-Type': 'application/json',

            Accept: 'application/json',

            'Duffel-Version': 'v2',
          },

          body: JSON.stringify(requestBody),
        },
      );

      const responseText = await duffelResponse.text();

      console.log('DUFFEL FLIGHT STATUS:', duffelResponse.status);

      /**
       * -----------------------------------------
       * Duffel flight API error
       * -----------------------------------------
       */

      if (!duffelResponse.ok) {
        console.error('DUFFEL FLIGHT API ERROR:', responseText);

        let errorMessage = 'Unable to search for flights.';

        try {
          const errorBody = JSON.parse(responseText);

          errorMessage =
            errorBody?.errors?.[0]?.message ??
            errorBody?.message ??
            errorMessage;
        } catch {
          // Keep generic error.
        }

        return errorResponse(502, errorMessage, 'DUFFEL_API_ERROR');
      }

      /**
       * -----------------------------------------
       * Parse Duffel response
       * -----------------------------------------
       */

      let duffelData: any;

      try {
        duffelData = JSON.parse(responseText);
      } catch {
        console.error('Invalid Duffel flight JSON:', responseText);

        return errorResponse(
          502,
          'Invalid response received from Duffel.',
          'INVALID_DUFFEL_RESPONSE',
        );
      }

      /**
       * -----------------------------------------
       * Extract offer request
       * -----------------------------------------
       */

      const offerRequest = duffelData?.data;

      if (!offerRequest) {
        return errorResponse(
          502,
          'Duffel returned an empty search response.',
          'EMPTY_DUFFEL_RESPONSE',
        );
      }

      /**
       * -----------------------------------------
       * Extract offers
       * -----------------------------------------
       */

      const offers = Array.isArray(offerRequest?.offers)
        ? offerRequest.offers
        : [];

      console.log('DUFFEL FLIGHT OFFER COUNT:', offers.length);

      /**
       * -----------------------------------------
       * Convert flight offers
       * -----------------------------------------
       */

      const flights: FlightOption[] = offers
        .map(mapDuffelOfferToFlightOption)
        .sort((a, b) => {
          const priceA = Number.parseFloat(a.price);

          const priceB = Number.parseFloat(b.price);

          return priceA - priceB;
        })
        .slice(0, 20);

      console.log('RETURNING FLIGHT OPTIONS:', flights.length);

      /**
       * -----------------------------------------
       * Return flight response
       * -----------------------------------------
       */

      return new Response(
        JSON.stringify({
          success: true,

          type: 'flight',

          flights,
        }),
        {
          status: 200,

          headers: {
            ...corsHeaders,

            'Content-Type': 'application/json',
          },
        },
      );
    }

    /**
     * =========================================
     * HOTEL SEARCH
     * =========================================
     */

    if (intent.type === 'hotel') {
      /**
       * -----------------------------------------
       * Validate destination
       * -----------------------------------------
       */

      if (!intent.destination) {
        return errorResponse(
          400,
          'Hotel destination is required.',
          'MISSING_DESTINATION',
        );
      }

      /**
       * -----------------------------------------
       * Validate check-in
       * -----------------------------------------
       */

      if (!intent.check_in) {
        return errorResponse(
          400,
          'Hotel check-in date is required.',
          'MISSING_CHECK_IN',
        );
      }

      /**
       * -----------------------------------------
       * Validate check-out
       * -----------------------------------------
       */

      if (!intent.check_out) {
        return errorResponse(
          400,
          'Hotel check-out date is required.',
          'MISSING_CHECK_OUT',
        );
      }

      /**
       * -----------------------------------------
       * Validate date order
       * -----------------------------------------
       */

      if (intent.check_out <= intent.check_in) {
        return errorResponse(
          400,
          'Hotel check-out date must be after check-in date.',
          'INVALID_DATE_RANGE',
        );
      }

      /**
       * -----------------------------------------
       * Adults
       * -----------------------------------------
       *
       * Defaults to one adult when the intent
       * does not explicitly contain the value.
       */

      const adults =
        intent.adults && intent.adults > 0 ? Math.floor(intent.adults) : 1;

      /**
       * -----------------------------------------
       * Rooms
       * -----------------------------------------
       *
       * Defaults to one room.
       */

      const rooms =
        intent.rooms && intent.rooms > 0 ? Math.floor(intent.rooms) : 1;

      /**
       * -----------------------------------------
       * Validate guests / rooms
       * -----------------------------------------
       */

      if (adults < rooms) {
        return errorResponse(
          400,
          'The number of adults must be at least equal to the number of rooms.',
          'INVALID_GUEST_ROOM_COUNT',
        );
      }

      /**
       * -----------------------------------------
       * Build guests
       * -----------------------------------------
       */

      const guests = Array.from(
        {
          length: adults,
        },
        () => ({
          type: 'adult',
        }),
      );

      /**
       * =========================================
       * DUFFEL STAYS REQUEST
       * =========================================
       *
       * IMPORTANT:
       *
       * We are intentionally using Dubai
       * coordinates for now.
       *
       * This will later be replaced with
       * destination geocoding.
       */

      const hotelRequest = {
        data: {
          rooms,

          location: {
            radius: 10,

            geographic_coordinates: {
              latitude: DUBAI_LOCATION.latitude,

              longitude: DUBAI_LOCATION.longitude,
            },
          },

          check_in_date: intent.check_in,

          check_out_date: intent.check_out,

          guests,

          mobile: true,
        },
      };

      console.log('DUFFEL HOTEL REQUEST:', JSON.stringify(hotelRequest));

      /**
       * -----------------------------------------
       * Call Duffel Stays
       * -----------------------------------------
       */

      const duffelResponse = await fetch(`${DUFFEL_BASE_URL}/stays/search`, {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${DUFFEL_API_KEY}`,

          'Content-Type': 'application/json',

          Accept: 'application/json',

          'Duffel-Version': 'v2',
        },

        body: JSON.stringify(hotelRequest),
      });

      const responseText = await duffelResponse.text();

      console.log('DUFFEL HOTEL STATUS:', duffelResponse.status);

      /**
       * -----------------------------------------
       * Duffel hotel API error
       * -----------------------------------------
       */

      if (!duffelResponse.ok) {
        console.error('DUFFEL HOTEL API ERROR:', responseText);

        let errorMessage = 'Unable to search for hotels.';

        try {
          const errorBody = JSON.parse(responseText);

          errorMessage =
            errorBody?.errors?.[0]?.message ??
            errorBody?.message ??
            errorMessage;
        } catch {
          // Keep generic error.
        }

        return errorResponse(502, errorMessage, 'DUFFEL_HOTEL_API_ERROR');
      }

      /**
       * -----------------------------------------
       * Parse hotel response
       * -----------------------------------------
       */

      let duffelData: any;

      try {
        duffelData = JSON.parse(responseText);
      } catch {
        console.error('Invalid Duffel hotel JSON:', responseText);

        return errorResponse(
          502,
          'Invalid hotel response received from Duffel.',
          'INVALID_DUFFEL_HOTEL_RESPONSE',
        );
      }

      /**
       * -----------------------------------------
       * Extract hotel results
       * -----------------------------------------
       */

      const searchResults = Array.isArray(duffelData?.data?.results)
        ? duffelData.data.results
        : [];

      console.log('DUFFEL HOTEL RESULT COUNT:', searchResults.length);

      /**
       * -----------------------------------------
       * Convert hotel results
       * -----------------------------------------
       *
       * Only HotelOption objects are returned
       * to the app.
       */

      const hotels: HotelOption[] = searchResults
        .map((result: any) => mapDuffelHotelToHotelOption(result, intent))
        .filter((hotel: HotelOption) => Boolean(hotel.id && hotel.hotelName))
        .sort((a, b) => {
          const priceA = Number.parseFloat(a.pricePerNight);

          const priceB = Number.parseFloat(b.pricePerNight);

          /**
           * Invalid prices go to the end.
           */

          if (Number.isNaN(priceA) && Number.isNaN(priceB)) {
            return 0;
          }

          if (Number.isNaN(priceA)) {
            return 1;
          }

          if (Number.isNaN(priceB)) {
            return -1;
          }

          return priceA - priceB;
        })
        .slice(0, 20);

      console.log('RETURNING HOTEL OPTIONS:', hotels.length);

      /**
       * -----------------------------------------
       * Return clean hotel response
       * -----------------------------------------
       */

      return new Response(
        JSON.stringify({
          success: true,

          type: 'hotel',

          hotels,
        }),
        {
          status: 200,

          headers: {
            ...corsHeaders,

            'Content-Type': 'application/json',
          },
        },
      );
    }

    /**
     * =========================================
     * UNSUPPORTED SEARCH TYPE
     * =========================================
     */

    return errorResponse(
      400,
      'This travel request type is not supported.',
      'UNSUPPORTED_SEARCH_TYPE',
    );
  } catch (error) {
    /**
     * =========================================
     * UNEXPECTED ERROR
     * =========================================
     */

    console.error('travel-search error:', error);

    return new Response(
      JSON.stringify({
        success: false,

        error:
          error instanceof Error
            ? error.message
            : 'Failed to search for travel options.',
      }),
      {
        status: 500,

        headers: {
          ...corsHeaders,

          'Content-Type': 'application/json',
        },
      },
    );
  }
});
