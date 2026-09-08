const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RestaurantIntent {
  cuisine: string | null;
  locationText: string | null;
  maxDistanceKm: number | null;
  maxTravelMinutes: number | null;
  minRating: number | null;
  priceLevels: string[];
  occasion: string | null;
  openNow: boolean;
  meal: string | null;
  preferences: string[];
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface GooglePlace {
  id?: string;

  formattedAddress?: string;

  location?: {
    latitude?: number;
    longitude?: number;
  };

  rating?: number;

  userRatingCount?: number;

  displayName?: {
    text?: string;
    languageCode?: string;
  };

  priceLevel?: string;

  googleMapsUri?: string;

  websiteUri?: string;

  editorialSummary?: {
    text?: string;
  };

  currentOpeningHours?: {
    openNow?: boolean;
  };

  regularOpeningHours?: {
    openNow?: boolean;
  };
}

interface RestaurantRecommendation {
  rank: number;
  label: string;
  reason: string;

  placeId: string | null;
  name: string;
  address: string | null;

  latitude: number | null;
  longitude: number | null;

  rating: number | null;
  userRatingCount: number | null;

  priceLevel: string | null;
  priceLevelLabel: string | null;

  openNow: boolean | null;

  distanceMeters: number | null;
  distanceKm: number | null;

  travelMinutes: number | null;

  websiteUri: string | null;
  googleMapsUri: string | null;

  editorialSummary: string | null;
}

const emptyIntent: RestaurantIntent = {
  cuisine: null,
  locationText: null,
  maxDistanceKm: null,
  maxTravelMinutes: null,
  minRating: null,
  priceLevels: [],
  occasion: null,
  openNow: false,
  meal: null,
  preferences: [],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Temporary fallback data.
 *
 * This is intentionally isolated in one place so it can
 * be removed later without changing the recommendation
 * pipeline.
 */
const FALLBACK_PLACES: GooglePlace[] = [
  {
    formattedAddress:
      'Ground Floor, Sapath Complex, Sarkhej - Gandhinagar Hwy, Opposite Rajpath Club, Highway Park Society, Bodakdev, Ahmedabad, Gujarat 380015, India',
    location: {
      latitude: 23.035933699999998,
      longitude: 72.511168099999992,
    },
    rating: 4.4,
    displayName: {
      text: 'Gordhan Thal',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'FF1, Time Square Arcade, 2, NR Sindhu Bhavan Rd, opp. Maple County Road, Thaltej, Ahmedabad, Gujarat 380059, India',
    location: {
      latitude: 23.0450631,
      longitude: 72.507508899999991,
    },
    rating: 4.7,
    displayName: {
      text: 'Balan Dosa',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'FF - 9,10, Time Square, II, Sindhubhavan Rd, near Maple County Road, Thaltej, Ahmedabad, Gujarat 380059, India',
    location: {
      latitude: 23.044753699999998,
      longitude: 72.507549099999991,
    },
    rating: 4.4,
    displayName: {
      text: 'Punjabiyat',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'FF/1-2, Sumel Complex, Sarkhej - Gandhinagar Hwy, nr. Tej Motors, near Pakwan cross Roads, Bodakdev, Ahmedabad, Gujarat 380059, India',
    location: {
      latitude: 23.040539199999998,
      longitude: 72.5122099,
    },
    rating: 4.1,
    displayName: {
      text: 'Mirch Masala, S.G.Road',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'GF 3,4, Patron, Rajpath Rangoli Rd, opp. Epic hospital, PRL Colony, Thaltej, Ahmedabad, Gujarat 380059, India',
    location: {
      latitude: 23.0348209,
      longitude: 72.5000266,
    },
    rating: 4.3,
    displayName: {
      text: 'MOTI MAHAL Tandoori Trail Ahmedabad',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'opp. Mahila Municipal Garden, Rajpath Rangoli Rd, Bodakdev, Ahmedabad, Gujarat 380059, India',
    location: {
      latitude: 23.032570600000003,
      longitude: 72.5052614,
    },
    rating: 4.5,
    displayName: {
      text: 'Under The Neem Trees',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'Ground Floor, Sun orbit, 04, behind Rajpath Rangoli Road, next to Pandit Dindayal Hall, PRL Colony, Bodakdev, Ahmedabad, Gujarat 380059, India',
    location: {
      latitude: 23.0344636,
      longitude: 72.5034221,
    },
    rating: 4.6,
    displayName: {
      text: 'Ishtaa | Pure Vegetarian',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'SF 201, Shilp Satved, beside Sindhu Bhawan, PRL Colony, Bodakdev, Ahmedabad, Gujarat 380059, India',
    location: {
      latitude: 23.040786999999998,
      longitude: 72.5024579,
    },
    rating: 4.7,
    displayName: {
      text: 'Tandoor Story Chur Chur Naan (Sindhubhavan)',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'Shivalik business centre, B-2, behind Rajpath Rangoli Road, opp. Occura Eye Care Hospital, PRL Colony, Bodakdev, Ahmedabad, Gujarat 380054, India',
    location: {
      latitude: 23.034964499999997,
      longitude: 72.5019001,
    },
    rating: 4.4,
    displayName: {
      text: 'Sambar Cafe',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'Shop 4-7, Sarthik Complex, Iskcon Cross Rd, behind Golden Times, Satellite, Ahmedabad, Gujarat 380015, India',
    location: {
      latitude: 23.026708,
      longitude: 72.5092519,
    },
    rating: 4.3,
    displayName: {
      text: 'Dakshinayan',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'GF 16, Shivalik Shilp,Iscon Cross Road, Amli Road, Sanidhya, Bopal, Ahmedabad, Gujarat 380058, India',
    location: {
      latitude: 23.026854999999998,
      longitude: 72.5068515,
    },
    rating: 4.6,
    displayName: {
      text: 'Rustic Spices Cafe and Restaurant',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      "Ashok Vatika Rd, next to SK Farm, opposite Toddler's Den, Bodakdev, Ahmedabad, Gujarat 380059, India",
    location: {
      latitude: 23.0323033,
      longitude: 72.4994797,
    },
    rating: 4.4,
    displayName: {
      text: 'Amala',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'Auda Garden Rd, Bodakdev, Ahmedabad, Gujarat 380059, India',
    location: {
      latitude: 23.041461299999998,
      longitude: 72.5098302,
    },
    rating: 4.2,
    displayName: {
      text: 'Dakshini24',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'FF12A/14, First Floor, B block, Times Square 2, beside Bodakdev Garden, Bodakdev, Ahmedabad, Gujarat 380059, India',
    location: {
      latitude: 23.044584099999998,
      longitude: 72.507871999999992,
    },
    rating: 4.4,
    displayName: {
      text: 'Virasat-E-Curry',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'Shop 4, Alpha Business Park, near Judges Bunglow Road, Bodakdev, Ahmedabad, Gujarat 380015, India',
    location: {
      latitude: 23.036227999999998,
      longitude: 72.5171087,
    },
    rating: 4.6,
    displayName: {
      text: 'RAMANUJAN RESTAURANT - South Indian Restaurant in Ahmedabad',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'GF/ 4, Sumel Complex, opp. GNFC Tower, near Tej Motors, Bodakdev, Ahmedabad, Gujarat 380059, India',
    location: {
      latitude: 23.040539199999998,
      longitude: 72.5122099,
    },
    rating: 4.1,
    displayName: {
      text: 'Angithi by Mirch Masala',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'Shop No 101 to, 104 , Magnifico, above Naturals Icecream, opposite Times Square II, Bodakdev, Ahmedabad, Gujarat 380054, India',
    location: {
      latitude: 23.0455409,
      longitude: 72.507177,
    },
    rating: 4.6,
    displayName: {
      text: 'GRUBOUS',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'Myka cafe & restaurant, beside Zodiac marquis, behind Rajpath Rangoli Road, Bodakdev, Ahmedabad, Gujarat 380059, India',
    location: {
      latitude: 23.035680499999998,
      longitude: 72.506198799999993,
    },
    rating: 4.2,
    displayName: {
      text: 'Myka cafe & restaurant',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'Sindhu Bhavan Road, Opposte, Sterling Cancer Hospital, Armedia Ln, Bodakdev, Ahmedabad, Gujarat 380059, India',
    location: {
      latitude: 23.0411947,
      longitude: 72.50968619999999,
    },
    rating: 4.2,
    displayName: {
      text: 'Tephra Lounge Restaurant',
      languageCode: 'en',
    },
  },
  {
    formattedAddress:
      'FF- 120, opposite BHAVIN SCHOOL, Thaltej, Ahmedabad, Gujarat 380059, India',
    location: {
      latitude: 23.047212,
      longitude: 72.50809799999999,
    },
    rating: 4.2,
    displayName: {
      text: 'Mahamahal',
      languageCode: 'en',
    },
  },
];

async function parseRestaurantIntent(
  prompt: string,
  openAiKey: string,
): Promise<RestaurantIntent> {
  const systemPrompt = `
You extract restaurant-search requirements from a user's natural-language request.

Return ONLY valid JSON.
Do not include markdown.
Do not include explanations.

Use exactly this JSON structure:

{
  "cuisine": string | null,
  "locationText": string | null,
  "maxDistanceKm": number | null,
  "maxTravelMinutes": number | null,
  "minRating": number | null,
  "priceLevels": string[],
  "occasion": string | null,
  "openNow": boolean,
  "meal": string | null,
  "preferences": string[]
}

Rules:

- cuisine:
  Extract the requested cuisine such as Italian, Japanese, Indian, Mexican.
  If no cuisine is specified, use null.

- locationText:
  Extract an explicit location such as "Downtown Dubai", "near Burj Khalifa", or "Marina".
  For "nearby", "near me", or similar wording, use null.

- maxDistanceKm:
  Extract an explicit maximum distance in kilometers.
  Otherwise null.

- maxTravelMinutes:
  Extract an explicit travel-time requirement.
  Examples:
  "within 15 minutes" => 15
  "no more than 20 minutes away" => 20
  Otherwise null.

- minRating:
  Extract an explicit minimum rating.
  Examples:
  "rated at least 4.5" => 4.5
  "4.7 stars or higher" => 4.7
  Otherwise null.

- priceLevels:
  Use only:
  "FREE",
  "INEXPENSIVE",
  "MODERATE",
  "EXPENSIVE",
  "VERY_EXPENSIVE"

  "$" => ["INEXPENSIVE"]
  "$$" => ["MODERATE"]
  "$$$" => ["EXPENSIVE"]
  "$$$$" => ["VERY_EXPENSIVE"]

  If no price preference is specified, return [].

- occasion:
  Extract the occasion when explicitly stated.
  Otherwise null.

- openNow:
  Set true only when the user explicitly asks for a restaurant
  that is open now/currently open.
  Otherwise false.

- meal:
  Extract breakfast, brunch, lunch, dinner, late night, etc.
  Otherwise null.

- preferences:
  Extract additional meaningful preferences such as:
  quiet,
  family-friendly,
  outdoor seating,
  good for groups,
  romantic,
  vegetarian options,
  etc.

  Do not put cuisine, location, rating, price, distance,
  or travel time here.

- Do not invent requirements.
- "good", "best", or "nice" by itself is not a hard rating requirement.
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: {
        type: 'json_object',
      },
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error('OpenAI request failed:', response.status, responseText);

    throw new Error('Unable to process the restaurant request.');
  }

  const openAiData = JSON.parse(responseText);

  const content = openAiData?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('OpenAI returned an empty response.');
  }

  const parsed = JSON.parse(content);

  return {
    ...emptyIntent,
    ...parsed,
    priceLevels: Array.isArray(parsed.priceLevels) ? parsed.priceLevels : [],
    preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
  };
}

function buildGoogleTextQuery(intent: RestaurantIntent): string {
  const parts: string[] = [];

  if (intent.cuisine) {
    parts.push(intent.cuisine);
  }

  parts.push('restaurant');

  if (intent.locationText) {
    parts.push('in', intent.locationText);
  }

  return parts.join(' ');
}

async function searchGooglePlaces(
  intent: RestaurantIntent,
  coordinates: Coordinates | null,
  googleApiKey: string,
): Promise<GooglePlace[]> {
  const textQuery = buildGoogleTextQuery(intent);

  const requestBody: Record<string, unknown> = {
    textQuery,
    languageCode: 'en',
    pageSize: 20,
    includedType: 'restaurant',
    strictTypeFiltering: true,
  };

  if (intent.minRating !== null) {
    requestBody.minRating = intent.minRating;
  }

  if (intent.openNow) {
    requestBody.openNow = true;
  }

  if (intent.priceLevels.length > 0) {
    requestBody.priceLevels = intent.priceLevels;
  }

  if (coordinates) {
    requestBody.locationBias = {
      circle: {
        center: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        },
        radius:
          intent.maxDistanceKm !== null
            ? Math.max(1000, intent.maxDistanceKm * 1000)
            : 50000,
      },
    };
  }

  const response = await fetch(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.location',
          'places.rating',
          'places.userRatingCount',
          'places.priceLevel',
          'places.googleMapsUri',
          'places.websiteUri',
          'places.editorialSummary',
          'places.currentOpeningHours',
          'places.regularOpeningHours',
        ].join(','),
      },
      body: JSON.stringify(requestBody),
    },
  );

  const responseText = await response.text();

  if (!response.ok) {
    console.error(
      'Google Places request failed:',
      response.status,
      responseText,
    );

    throw new Error(
      `Google Places API error (${response.status}): ${responseText}`,
    );
  }

  const data = JSON.parse(responseText);

  return Array.isArray(data.places) ? data.places : [];
}

/**
 * Calculate straight-line distance.
 *
 * This is used only as a fallback when Google routing
 * summaries are unavailable.
 */
function calculateDistanceMeters(
  origin: Coordinates,
  destination: Coordinates,
): number {
  const earthRadiusMeters = 6371000;

  const lat1 = (origin.latitude * Math.PI) / 180;

  const lat2 = (destination.latitude * Math.PI) / 180;

  const deltaLat = ((destination.latitude - origin.latitude) * Math.PI) / 180;

  const deltaLon = ((destination.longitude - origin.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function normalizePriceLevel(priceLevel: string | undefined): string | null {
  if (!priceLevel) {
    return null;
  }

  return priceLevel;
}

function priceLevelLabel(priceLevel: string | null): string | null {
  switch (priceLevel) {
    case 'FREE':
      return 'Free';

    case 'INEXPENSIVE':
      return '$';

    case 'MODERATE':
      return '$$';

    case 'EXPENSIVE':
      return '$$$';

    case 'VERY_EXPENSIVE':
      return '$$$$';

    default:
      return null;
  }
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim();
}

function placeMatchesCuisine(
  place: GooglePlace,
  cuisine: string | null,
): boolean {
  if (!cuisine) {
    return true;
  }

  const requestedCuisine = normalizeText(cuisine);

  const text = normalizeText(
    [place.displayName?.text, place.formattedAddress].filter(Boolean).join(' '),
  );

  /**
   * These mappings allow the temporary fallback data
   * to behave reasonably when Google metadata such as
   * restaurant types is unavailable.
   */
  const cuisineKeywords: Record<string, string[]> = {
    indian: [
      'indian',
      'thal',
      'curry',
      'tandoor',
      'tandoori',
      'masala',
      'punjab',
      'south indian',
      'dakshin',
      'dakshini',
      'dosa',
      'naan',
      'vegetarian',
    ],

    'south indian': ['south indian', 'dosa', 'dakshin', 'dakshini', 'sambar'],

    punjabi: ['punjab', 'punjabi', 'tandoor', 'tandoori', 'naan'],

    japanese: ['japanese', 'sushi', 'ramen', 'izakaya', 'sake'],

    italian: ['italian', 'pizza', 'pasta', 'trattoria', 'ristorante'],

    mexican: ['mexican', 'taco', 'burrito', 'quesadilla'],

    chinese: ['chinese', 'dim sum', 'szechuan', 'sichuan', 'noodle'],
  };

  const keywords = cuisineKeywords[requestedCuisine];

  if (!keywords) {
    /**
     * We cannot safely determine an unknown cuisine
     * from the limited fallback data.
     */
    return false;
  }

  return keywords.some(keyword => text.includes(keyword));
}

function placeMatchesPreference(
  place: GooglePlace,
  preference: string,
): boolean {
  const normalized = normalizeText(preference);

  const text = normalizeText(
    [
      place.displayName?.text,
      place.formattedAddress,
      place.editorialSummary?.text,
    ]
      .filter(Boolean)
      .join(' '),
  );

  if (normalized.includes('vegetarian')) {
    return text.includes('vegetarian');
  }

  /**
   * We cannot reliably infer preferences such as
   * "quiet", "romantic", or "family-friendly" from
   * the limited fallback fields.
   *
   * Therefore these are treated as soft preferences
   * rather than hard filters.
   */
  return false;
}

function filterPlaces(
  places: GooglePlace[],
  intent: RestaurantIntent,
  coordinates: Coordinates | null,
): Array<{
  place: GooglePlace;
  distanceMeters: number | null;
}> {
  return places
    .map(place => {
      let distanceMeters: number | null = null;

      if (
        coordinates &&
        typeof place.location?.latitude === 'number' &&
        typeof place.location?.longitude === 'number'
      ) {
        distanceMeters = calculateDistanceMeters(coordinates, {
          latitude: place.location.latitude,
          longitude: place.location.longitude,
        });
      }

      return {
        place,
        distanceMeters,
      };
    })
    .filter(({ place, distanceMeters }) => {
      /**
       * Explicit rating is a hard requirement.
       */
      if (
        intent.minRating !== null &&
        (place.rating === undefined || place.rating < intent.minRating)
      ) {
        return false;
      }

      /**
       * Explicit distance is a hard requirement.
       */
      if (intent.maxDistanceKm !== null) {
        if (distanceMeters === null) {
          return false;
        }

        if (distanceMeters > intent.maxDistanceKm * 1000) {
          return false;
        }
      }

      /**
       * Explicit cuisine is a hard requirement.
       *
       * If Google returns real place metadata,
       * its search query should already strongly
       * constrain cuisine. For fallback data,
       * we additionally check available text.
       */
      if (intent.cuisine && !placeMatchesCuisine(place, intent.cuisine)) {
        return false;
      }

      /**
       * Explicit open-now requirement.
       */
      if (intent.openNow) {
        const openNow =
          place.currentOpeningHours?.openNow ??
          place.regularOpeningHours?.openNow ??
          null;

        if (openNow !== true) {
          return false;
        }
      }

      /**
       * Explicit price requirement.
       */
      if (intent.priceLevels.length > 0) {
        if (
          !place.priceLevel ||
          !intent.priceLevels.includes(place.priceLevel)
        ) {
          return false;
        }
      }

      return true;
    });
}

function scorePlace(
  place: GooglePlace,
  distanceMeters: number | null,
  intent: RestaurantIntent,
): number {
  let score = 0;

  /**
   * Rating is the strongest general signal.
   */
  if (typeof place.rating === 'number') {
    score += (place.rating / 5) * 50;
  }

  /**
   * Distance is important for nearby requests.
   */
  if (distanceMeters !== null) {
    const distanceKm = distanceMeters / 1000;

    /**
     * Nearby places receive a stronger score.
     * Score gradually decreases with distance.
     */
    score += Math.max(0, 30 - distanceKm * 4);
  }

  /**
   * Rating requirement gets an additional boost
   * when the restaurant exceeds it.
   */
  if (intent.minRating !== null && typeof place.rating === 'number') {
    const difference = place.rating - intent.minRating;

    if (difference > 0) {
      score += Math.min(10, difference * 10);
    }
  }

  /**
   * Explicit cuisine gets a boost after matching.
   */
  if (intent.cuisine && placeMatchesCuisine(place, intent.cuisine)) {
    score += 10;
  }

  /**
   * Soft preference matching.
   */
  for (const preference of intent.preferences) {
    if (placeMatchesPreference(place, preference)) {
      score += 5;
    }
  }

  return score;
}

function createReason(
  place: GooglePlace,
  distanceMeters: number | null,
  intent: RestaurantIntent,
  rank: number,
): string {
  const parts: string[] = [];

  if (intent.cuisine && placeMatchesCuisine(place, intent.cuisine)) {
    parts.push(`${intent.cuisine} restaurant`);
  } else {
    parts.push('restaurant');
  }

  if (typeof place.rating === 'number') {
    parts.push(`rated ${place.rating.toFixed(1)}/5`);
  }

  if (distanceMeters !== null) {
    const distanceKm = distanceMeters / 1000;

    if (distanceKm < 1) {
      parts.push(`${Math.round(distanceMeters)} m away`);
    } else {
      parts.push(`${distanceKm.toFixed(1)} km away`);
    }
  }

  if (intent.occasion) {
    parts.push(`a good option for ${intent.occasion}`);
  } else if (intent.meal) {
    parts.push(`suitable for ${intent.meal}`);
  }

  if (rank === 1) {
    return `Best overall match based on ${parts.join(', ')}.`;
  }

  if (rank === 2) {
    return `Strong alternative with ${parts.join(', ')}.`;
  }

  return `Good alternative offering ${parts.join(', ')}.`;
}

function createLabel(rank: number): string {
  if (rank === 1) {
    return 'Best Match';
  }

  if (rank === 2) {
    return 'Best Alternative';
  }

  return 'Best Value / Alternative';
}

function createRecommendation(
  place: GooglePlace,
  distanceMeters: number | null,
  intent: RestaurantIntent,
  rank: number,
): RestaurantRecommendation {
  const latitude =
    typeof place.location?.latitude === 'number'
      ? place.location.latitude
      : null;

  const longitude =
    typeof place.location?.longitude === 'number'
      ? place.location.longitude
      : null;

  const distanceKm = distanceMeters !== null ? distanceMeters / 1000 : null;

  const openNow =
    place.currentOpeningHours?.openNow ??
    place.regularOpeningHours?.openNow ??
    null;

  return {
    rank,
    label: createLabel(rank),

    reason: createReason(place, distanceMeters, intent, rank),

    placeId: place.id ?? null,

    name: place.displayName?.text ?? 'Unknown restaurant',

    address: place.formattedAddress ?? null,

    latitude,
    longitude,

    rating: typeof place.rating === 'number' ? place.rating : null,

    userRatingCount:
      typeof place.userRatingCount === 'number' ? place.userRatingCount : null,

    priceLevel: normalizePriceLevel(place.priceLevel),

    priceLevelLabel: priceLevelLabel(normalizePriceLevel(place.priceLevel)),

    openNow,

    distanceMeters: distanceMeters !== null ? Math.round(distanceMeters) : null,

    distanceKm: distanceKm !== null ? Number(distanceKm.toFixed(2)) : null,

    /**
     * Travel time will be populated when we add
     * Google routing summaries.
     *
     * For now we intentionally do not invent
     * a travel time from straight-line distance.
     */
    travelMinutes: null,

    websiteUri: place.websiteUri ?? null,

    googleMapsUri: place.googleMapsUri ?? null,

    editorialSummary: place.editorialSummary?.text ?? null,
  };
}

function generateRecommendations(
  places: GooglePlace[],
  intent: RestaurantIntent,
  coordinates: Coordinates | null,
): RestaurantRecommendation[] {
  const filtered = filterPlaces(places, intent, coordinates);

  const scored = filtered
    .map(({ place, distanceMeters }) => ({
      place,
      distanceMeters,
      score: scorePlace(place, distanceMeters, intent),
    }))
    .sort((a, b) => b.score - a.score);

  return scored
    .slice(0, 3)
    .map(({ place, distanceMeters }, index) =>
      createRecommendation(place, distanceMeters, intent, index + 1),
    );
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        success: false,
        error: 'Only POST requests are supported.',
      },
      405,
    );
  }

  try {
    const body = await req.json();

    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

    const latitude = typeof body.latitude === 'number' ? body.latitude : null;

    const longitude =
      typeof body.longitude === 'number' ? body.longitude : null;

    if (!prompt) {
      return jsonResponse(
        {
          success: false,
          error: 'Restaurant request is required.',
        },
        400,
      );
    }

    const openAiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAiKey) {
      throw new Error('OPENAI_API_KEY is not configured.');
    }

    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');

    if (!googleApiKey) {
      throw new Error('GOOGLE_PLACES_API_KEY is not configured.');
    }

    /**
     * STEP 1:
     * Understand the user's request.
     */
    const intent = await parseRestaurantIntent(prompt, openAiKey);

    const coordinates =
      latitude !== null && longitude !== null
        ? {
            latitude,
            longitude,
          }
        : null;

    /**
     * STEP 2:
     * Try Google Places first.
     */
    let places: GooglePlace[] = [];

    let dataSource: 'google_places' | 'fallback_sample' = 'google_places';

    let googleError: string | null = null;

    try {
      places = await searchGooglePlaces(intent, coordinates, googleApiKey);
    } catch (error) {
      /**
       * Google is currently failing because the
       * configured API key is invalid.
       *
       * We intentionally continue using the supplied
       * sample data so the rest of the recommendation
       * pipeline can be developed and tested.
       */
      googleError =
        error instanceof Error
          ? error.message
          : 'Google Places request failed.';

      console.error(
        'Google Places unavailable. Using fallback sample data.',
        googleError,
      );

      places = FALLBACK_PLACES;

      dataSource = 'fallback_sample';
    }

    /**
     * STEP 3:
     * Filter and rank the available candidates.
     */
    const recommendations = generateRecommendations(
      places,
      intent,
      coordinates,
    );

    /**
     * If explicit hard requirements resulted in
     * zero suitable restaurants, do NOT return
     * unrelated restaurants just to reach three.
     */
    return jsonResponse({
      success: true,

      intent,

      search: {
        query: buildGoogleTextQuery(intent),

        resultCount: places.length,

        suitableResultCount: filterPlaces(places, intent, coordinates).length,

        dataSource,

        ...(googleError
          ? {
              googleError,
            }
          : {}),
      },

      recommendations,
    });
  } catch (error) {
    console.error('recommend-restaurant error:', error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to find restaurant recommendations.',
      },
      500,
    );
  }
});
