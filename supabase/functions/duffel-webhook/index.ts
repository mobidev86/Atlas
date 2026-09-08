import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DUFFEL_BASE_URL = 'https://api.duffel.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-duffel-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/* ============================================================
 * Types
 * ============================================================ */

interface DuffelWebhookEvent {
  id?: string;
  type?: string;
  live_mode?: boolean;
  idempotency_key?: string;
  created_at?: string;
  api_version?: string;
  identity_organisation_id?: string;

  data?: {
    object?: any;
    [key: string]: any;
  };

  [key: string]: any;
}

/* ============================================================
 * Generic helpers
 * ============================================================ */

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const result = stringValue(value);

    if (result) {
      return result;
    }
  }

  return null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function dateOnly(value: unknown): string | null {
  const text = stringValue(value);

  if (!text) {
    return null;
  }

  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);

  return match ? match[1] : null;
}

/* ============================================================
 * Duffel webhook signature
 * ============================================================ */

/**
 * Duffel currently sends a signature header that may look like:
 *
 * t=<timestamp>,v2=<signature>
 *
 * We support both v1 and v2.
 *
 * The signed payload is:
 *
 * timestamp + "." + raw request body
 */
async function verifyDuffelSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  try {
    if (!signatureHeader) {
      console.error('Duffel signature header is empty');
      return false;
    }

    if (!secret) {
      console.error('Duffel webhook secret is empty');
      return false;
    }

    console.log(
      'Duffel signature raw diagnostics:',
      JSON.stringify({
        length: signatureHeader.length,
        first_char: signatureHeader.charAt(0),
        last_char: signatureHeader.charAt(signatureHeader.length - 1),
        comma_count: (signatureHeader.match(/,/g) ?? []).length,
        equals_count: (signatureHeader.match(/=/g) ?? []).length,
      }),
    );

    const parameters = signatureHeader
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);

    let timestamp: string | null = null;

    const receivedSignatures: Array<{
      version: string;
      signature: string;
    }> = [];

    for (const parameter of parameters) {
      const equalsIndex = parameter.indexOf('=');

      if (equalsIndex === -1) {
        continue;
      }

      const key = parameter.slice(0, equalsIndex).trim().toLowerCase();

      const value = parameter.slice(equalsIndex + 1).trim();

      console.log(
        'Duffel signature parameter:',
        JSON.stringify({
          key,
          value_length: value.length,
        }),
      );

      if (key === 't') {
        timestamp = value;
        continue;
      }

      if ((key === 'v1' || key === 'v2') && value.length > 0) {
        receivedSignatures.push({
          version: key,
          signature: value,
        });
      }
    }

    console.log(
      'Duffel signature parsed diagnostics:',
      JSON.stringify({
        parameter_count: parameters.length,
        has_timestamp: Boolean(timestamp),
        timestamp_length: timestamp?.length ?? 0,
        signature_count: receivedSignatures.length,
        signatures: receivedSignatures.map(item => ({
          version: item.version,
          length: item.signature.length,
        })),
      }),
    );

    if (!timestamp || receivedSignatures.length === 0) {
      console.error(
        'Invalid Duffel signature format.',
        JSON.stringify({
          parameter_count: parameters.length,
          has_timestamp: Boolean(timestamp),
          signature_count: receivedSignatures.length,
        }),
      );

      return false;
    }

    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      {
        name: 'HMAC',
        hash: 'SHA-256',
      },
      false,
      ['sign'],
    );

    const signedPayload = `${timestamp}.${rawBody}`;

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signedPayload),
    );

    const expectedSignature = bytesToHex(
      new Uint8Array(signatureBuffer),
    ).toLowerCase();

    for (const item of receivedSignatures) {
      const receivedSignature = item.signature.toLowerCase();

      if (secureCompare(expectedSignature, receivedSignature)) {
        console.log(
          `Duffel webhook signature verified successfully using ${item.version}.`,
        );

        return true;
      }
    }

    console.error(
      'Duffel webhook signature verification failed.',
      JSON.stringify({
        timestamp_length: timestamp.length,
        expected_signature_length: expectedSignature.length,
        received_signatures: receivedSignatures.map(item => ({
          version: item.version,
          length: item.signature.length,
        })),
      }),
    );

    return false;
  } catch (error) {
    console.error(
      'Duffel signature verification error:',
      error instanceof Error ? error.message : String(error),
    );

    return false;
  }
}

/* ============================================================
 * Atlas reference
 * ============================================================ */

/**
 * Current checkout-session reference:
 *
 * ATLAS_FLIGHT_<user_id>_<request_id>
 * ATLAS_HOTEL_<user_id>_<request_id>
 *
 * IMPORTANT:
 *
 * The second UUID is NOT a user_bookings.id.
 * It is only our checkout request/correlation ID.
 */
function parseAtlasReference(reference: string | null | undefined): {
  bookingType: 'flight' | 'hotel';
  userId: string;
  requestId: string;
} | null {
  if (!reference) {
    return null;
  }

  const flightMatch = reference.match(
    /^ATLAS_FLIGHT_([0-9a-fA-F-]{36})_([0-9a-fA-F-]{36})$/,
  );

  if (flightMatch) {
    return {
      bookingType: 'flight',
      userId: flightMatch[1],
      requestId: flightMatch[2],
    };
  }

  const hotelMatch = reference.match(
    /^ATLAS_HOTEL_([0-9a-fA-F-]{36})_([0-9a-fA-F-]{36})$/,
  );

  if (hotelMatch) {
    return {
      bookingType: 'hotel',
      userId: hotelMatch[1],
      requestId: hotelMatch[2],
    };
  }

  return null;
}

/**
 * Find an Atlas reference from the Duffel resource/event.
 */
function extractAtlasReference(resource: any, eventObject: any): string | null {
  return firstString(
    resource?.metadata?.checkout_reference,
    resource?.metadata?.booking_reference,
    resource?.metadata?.atlas_reference,

    resource?.reference,

    eventObject?.metadata?.checkout_reference,
    eventObject?.metadata?.booking_reference,
    eventObject?.metadata?.atlas_reference,

    eventObject?.reference,
  );
}

/* ============================================================
 * Supabase admin key
 * ============================================================ */

/**
 * Resolve the Supabase admin/service key.
 *
 * Supports:
 *
 * SUPABASE_SERVICE_ROLE_KEY
 * SUPABASE_SECRET_KEY
 * SUPABASE_SECRET_KEYS
 *
 * Some Supabase environments expose SUPABASE_SECRET_KEYS
 * as a JSON object. If so, try to extract the default value.
 */
function resolveSupabaseServiceKey(): string | null {
  const directServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (directServiceRoleKey) {
    return directServiceRoleKey;
  }

  const directSecretKey = Deno.env.get('SUPABASE_SECRET_KEY');

  if (directSecretKey) {
    return directSecretKey;
  }

  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');

  if (!secretKeys) {
    return null;
  }

  /*
   * First try it directly.
   */
  if (
    !secretKeys.trim().startsWith('{') &&
    !secretKeys.trim().startsWith('[')
  ) {
    return secretKeys;
  }

  /*
   * Otherwise attempt to parse JSON.
   */
  try {
    const parsed = JSON.parse(secretKeys);

    if (typeof parsed === 'string') {
      return parsed;
    }

    if (parsed && typeof parsed === 'object') {
      const possibleKeys = [
        parsed.default,
        parsed.service_role,
        parsed.serviceRole,
        parsed.SUPABASE_SERVICE_ROLE_KEY,
        parsed.SUPABASE_SECRET_KEY,
      ];

      for (const value of possibleKeys) {
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
    }
  } catch (error) {
    console.error(
      'Unable to parse SUPABASE_SECRET_KEYS.',
      error instanceof Error ? error.message : String(error),
    );
  }

  return null;
}

/* ============================================================
 * Duffel API
 * ============================================================ */

async function duffelGet(path: string, apiKey: string): Promise<any | null> {
  try {
    const response = await fetch(`${DUFFEL_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Duffel-Version': 'v2',
      },
    });

    const text = await response.text();

    if (!response.ok) {
      console.error(`Duffel GET ${path} failed:`, response.status, text);

      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      console.error(`Duffel GET ${path} returned invalid JSON`);

      return null;
    }
  } catch (error) {
    console.error(
      `Duffel GET ${path} network error:`,
      error instanceof Error ? error.message : String(error),
    );

    return null;
  }
}

/* ============================================================
 * Profile
 * ============================================================ */

async function getFullName(
  supabaseAdmin: any,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch profile:', error);

    return null;
  }

  return firstString(data?.full_name);
}

/* ============================================================
 * Flight details
 * ============================================================ */

function extractFlightDetails(order: any) {
  const slices = Array.isArray(order?.slices) ? order.slices : [];

  /*
   * ============================================================
   * FIRST FLIGHT / OUTBOUND
   * ============================================================
   */

  const firstSlice = slices[0] ?? null;

  const firstSliceSegments = Array.isArray(firstSlice?.segments)
    ? firstSlice.segments
    : [];

  const firstSegment =
    firstSliceSegments.length > 0 ? firstSliceSegments[0] : null;

  /*
   * Source:
   * First segment's origin.
   */
  const source = firstString(
    firstSegment?.origin?.iata_code,
    firstSegment?.origin?.iata,
    firstSlice?.origin?.iata_code,
    firstSlice?.origin?.iata,
  );

  /*
   * Destination:
   * Final segment's destination within the FIRST slice.
   *
   * Example:
   *
   * BOM -> DEL -> LHR
   *
   * source      = BOM
   * destination = LHR
   *
   * We do NOT look at the return slice here.
   */
  const lastFirstSliceSegment =
    firstSliceSegments.length > 0
      ? firstSliceSegments[firstSliceSegments.length - 1]
      : null;

  const destination = firstString(
    lastFirstSliceSegment?.destination?.iata_code,
    lastFirstSliceSegment?.destination?.iata,
    firstSlice?.destination?.iata_code,
    firstSlice?.destination?.iata,
  );

  /*
   * Departure date:
   * First segment of the FIRST slice.
   */
  const departureDate = dateOnly(
    firstString(firstSegment?.departing_at, firstSlice?.departing_at),
  );

  /*
   * ============================================================
   * RETURN FLIGHT
   * ============================================================
   *
   * We only store the RETURN DATE.
   *
   * We do NOT use the return flight to determine source
   * or destination.
   */

  let returnDate: string | null = null;

  if (slices.length > 1) {
    const returnSlice = slices[1];

    const returnSegments = Array.isArray(returnSlice?.segments)
      ? returnSlice.segments
      : [];

    /*
     * For the return date, use the first segment's
     * departure date.
     *
     * Example:
     *
     * Outbound:
     * BOM -> LHR
     * 2026-09-15
     *
     * Return:
     * LHR -> BOM
     * 2026-09-20
     *
     * return_date = 2026-09-20
     */
    const firstReturnSegment =
      returnSegments.length > 0 ? returnSegments[0] : null;

    returnDate = dateOnly(
      firstString(
        firstReturnSegment?.departing_at,
        returnSlice?.departing_at,

        /*
         * Fallbacks in case the slice structure provides
         * the date at another level.
         */
        firstReturnSegment?.arriving_at,
        returnSlice?.arriving_at,
      ),
    );
  }

  /*
   * ============================================================
   * PASSENGER
   * ============================================================
   */

  const passenger =
    Array.isArray(order?.passengers) && order.passengers.length > 0
      ? order.passengers[0]
      : null;

  const passengerName = firstString(
    passenger?.given_name && passenger?.family_name
      ? `${passenger.given_name} ${passenger.family_name}`
      : null,

    passenger?.name,
  );

  /*
   * ============================================================
   * AIRLINE
   * ============================================================
   */

  const airline = firstString(
    order?.owner?.name,
    order?.owner?.iata_code,
    firstSegment?.marketing_carrier?.name,
    firstSegment?.operating_carrier?.name,
  );

  /*
   * ============================================================
   * PRICE
   * ============================================================
   */

  const price = numberValue(
    firstString(order?.total_amount, order?.price?.amount),
  );

  /*
   * ============================================================
   * CURRENCY
   * ============================================================
   */

  const currency = firstString(order?.total_currency, order?.price?.currency);

  return {
    source,
    destination,

    departure_date: departureDate,
    return_date: returnDate,

    airline,
    passenger_name: passengerName,
    price,
    currency,
  };
}

/* ============================================================
 * Hotel details
 * ============================================================ */

function extractHotelDetails(booking: any, quote: any) {
  const accommodation =
    booking?.accommodation ??
    booking?.hotel ??
    quote?.accommodation ??
    quote?.hotel ??
    null;

  const rooms = Array.isArray(booking?.rooms) ? booking.rooms : [];

  const firstRoom = rooms[0] ?? null;

  const guests = Array.isArray(booking?.guests)
    ? booking.guests
    : Array.isArray(quote?.guests)
    ? quote.guests
    : [];

  const firstGuest = guests[0] ?? null;

  const hotelName = firstString(
    accommodation?.name,
    booking?.accommodation_name,
    booking?.hotel_name,
    quote?.accommodation_name,
    quote?.hotel_name,
    firstRoom?.accommodation?.name,
  );

  const city = firstString(
    accommodation?.location?.city,
    accommodation?.location?.city_name,
    booking?.city,
    quote?.city,
  );

  const passengerName = firstString(
    firstGuest?.given_name && firstGuest?.family_name
      ? `${firstGuest.given_name} ${firstGuest.family_name}`
      : null,

    firstGuest?.name,
    booking?.lead_guest?.name,
  );

  const price = numberValue(
    firstString(
      booking?.total_amount,
      booking?.total?.amount,
      quote?.total_amount,
      quote?.total?.amount,
    ),
  );

  const currency = firstString(
    booking?.total_currency,
    booking?.total?.currency,
    quote?.total_currency,
    quote?.total?.currency,
  );

  const departureDate = dateOnly(
    firstString(
      booking?.check_in_date,
      booking?.check_in,
      quote?.check_in_date,
      quote?.check_in,
    ),
  );

  const returnDate = dateOnly(
    firstString(
      booking?.check_out_date,
      booking?.check_out,
      quote?.check_out_date,
      quote?.check_out,
    ),
  );

  return {
    source: city,
    destination: city,
    departure_date: departureDate,
    return_date: returnDate,
    hotel_name: hotelName,
    passenger_name: passengerName,
    price,
    currency,
  };
}

/* ============================================================
 * Existing booking lookup
 * ============================================================ */

async function findByDuffelBookingId(supabaseAdmin: any, bookingId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_bookings')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (error) {
    console.error('Failed to find booking by Duffel booking_id:', error);

    return null;
  }

  return data;
}

/* ============================================================
 * Insert booking
 * ============================================================ */

async function insertBooking(
  supabaseAdmin: any,
  booking: Record<string, unknown>,
) {
  const { data, error } = await supabaseAdmin
    .from('user_bookings')
    .insert(booking)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Failed to insert user_bookings:', error);

    return null;
  }

  return data;
}

/* ============================================================
 * Flight: successful order
 * ============================================================ */

async function processFlightCreated(
  event: DuffelWebhookEvent,
  supabaseAdmin: any,
  duffelApiKey: string,
) {
  const eventObject = event.data?.object ?? {};

  let orderId = firstString(eventObject?.id, eventObject?.order_id);

  /*
   * If the event doesn't contain the order ID directly,
   * don't use the event id as booking_id.
   */
  if (!orderId) {
    console.warn('order.created event did not contain a Duffel order ID.');

    return {
      success: false,
      reason: 'missing_duffel_order_id',
    };
  }

  console.log('Processing Duffel flight order:', orderId);

  /*
   * Fetch the authoritative Duffel order.
   */
  const orderResponse = await duffelGet(
    `/air/orders/${encodeURIComponent(orderId)}`,
    duffelApiKey,
  );

  if (!orderResponse?.data) {
    throw new Error(`Unable to fetch Duffel flight order ${orderId}`);
  }

  const order = orderResponse.data;

  /*
   * Extract Atlas reference.
   */
  const reference = extractAtlasReference(order, eventObject);

  console.log('Duffel flight Atlas reference:', reference);

  const parsedReference = parseAtlasReference(reference);

  if (!parsedReference) {
    console.error('Unable to parse Atlas flight reference.', {
      orderId,
      reference,
    });

    return {
      success: false,
      reason: 'invalid_atlas_reference',
      order_id: orderId,
      reference,
    };
  }

  if (parsedReference.bookingType !== 'flight') {
    console.error('Atlas reference is not a flight reference.', {
      orderId,
      reference,
      bookingType: parsedReference.bookingType,
    });

    return {
      success: false,
      reason: 'reference_booking_type_mismatch',
      order_id: orderId,
      reference,
    };
  }

  /*
   * Idempotency:
   *
   * Duffel can deliver the same webhook more than once.
   *
   * Never create another user_bookings row for the same
   * actual Duffel order ID.
   */
  const existing = await findByDuffelBookingId(supabaseAdmin, orderId);

  if (existing) {
    console.log('Flight booking already exists. Skipping duplicate webhook.', {
      orderId,
      existingBookingId: existing.id,
    });

    return {
      success: true,
      duplicate: true,
      booking_type: 'flight',
      order_id: orderId,
      booking_id: existing.id,
    };
  }

  const fullName = await getFullName(supabaseAdmin, parsedReference.userId);

  if (!fullName) {
    throw new Error(
      `Unable to determine Atlas full name for user ${parsedReference.userId}`,
    );
  }

  const details = extractFlightDetails(order);

  const bookingReference = firstString(
    order?.booking_reference,
    order?.reference,
  );

  const row: Record<string, unknown> = {
    user_id: parsedReference.userId,

    booking_type: 'flight',

    source: details.source,

    destination: details.destination,

    /*
     * IMPORTANT:
     *
     * This is the REAL Duffel order ID.
     */
    booking_id: orderId,

    status: 'success',

    booking_reference: bookingReference,

    fullName,

    departure_date: details.departure_date,

    return_date: details.return_date,

    airline: details.airline,

    passenger_name: details.passenger_name,

    price: details.price,

    currency: details.currency,

    updated_at: new Date().toISOString(),
  };

  const inserted = await insertBooking(supabaseAdmin, row);

  if (!inserted) {
    throw new Error(`Unable to create flight booking ${orderId}`);
  }

  console.log('Flight booking successfully inserted into user_bookings.', {
    atlasUserId: parsedReference.userId,
    bookingId: inserted.id,
    duffelOrderId: orderId,
  });

  return {
    success: true,
    booking_type: 'flight',
    order_id: orderId,
    booking_id: inserted.id,
  };
}

/* ============================================================
 * Flight: failed creation
 * ============================================================ */

async function processFlightFailed(
  event: DuffelWebhookEvent,
  supabaseAdmin: any,
) {
  const eventObject = event.data?.object ?? {};

  const orderId = firstString(eventObject?.order_id, eventObject?.id);

  const reference = extractAtlasReference(eventObject, eventObject);

  const parsedReference = parseAtlasReference(reference);

  console.log('Processing failed Duffel flight order.', {
    orderId,
    reference,
  });

  /*
   * If there is no actual Duffel order ID,
   * we cannot satisfy the user_bookings.booking_id
   * requirement without inventing an ID.
   *
   * Therefore don't insert a fake booking_id.
   */
  if (!orderId) {
    console.warn(
      'Flight creation failed without a Duffel order ID. No user_bookings row created.',
      {
        reference,
      },
    );

    return {
      success: true,
      status: 'failure',
      stored: false,
      reason: 'missing_duffel_order_id',
    };
  }

  /*
   * If this order already exists, don't create another row.
   */
  const existing = await findByDuffelBookingId(supabaseAdmin, orderId);

  if (existing) {
    console.log('Failed flight event received for an existing booking.', {
      orderId,
      existingBookingId: existing.id,
    });

    return {
      success: true,
      status: 'failure',
      duplicate: true,
      booking_id: existing.id,
    };
  }

  if (!parsedReference) {
    console.error('Unable to parse Atlas reference for failed flight.', {
      orderId,
      reference,
    });

    return {
      success: false,
      status: 'failure',
      stored: false,
      reason: 'invalid_atlas_reference',
      order_id: orderId,
    };
  }

  if (parsedReference.bookingType !== 'flight') {
    return {
      success: false,
      status: 'failure',
      stored: false,
      reason: 'reference_booking_type_mismatch',
      order_id: orderId,
    };
  }

  const fullName = await getFullName(supabaseAdmin, parsedReference.userId);

  if (!fullName) {
    throw new Error(
      `Unable to determine Atlas full name for user ${parsedReference.userId}`,
    );
  }

  const bookingReference = firstString(
    eventObject?.booking_reference,
    eventObject?.reference,
  );

  const inserted = await insertBooking(supabaseAdmin, {
    user_id: parsedReference.userId,

    booking_type: 'flight',

    source: null,

    destination: null,

    booking_id: orderId,

    status: 'failure',

    booking_reference: bookingReference,

    fullName,

    updated_at: new Date().toISOString(),
  });

  if (!inserted) {
    throw new Error(`Unable to create failed flight booking ${orderId}`);
  }

  return {
    success: true,
    status: 'failure',
    stored: true,
    booking_id: inserted.id,
    order_id: orderId,
  };
}

/* ============================================================
 * Payment succeeded fallback
 * ============================================================ */

/**
 * Some Duffel flows can emit air.payment.succeeded.
 *
 * IMPORTANT:
 *
 * A payment event is not itself a booking ID.
 *
 * We therefore only process this event when we can resolve
 * the actual Duffel order ID from the payload.
 *
 * The actual booking is still stored using:
 *
 * booking_id = actual Duffel order ID
 */
async function processPaymentSucceeded(
  event: DuffelWebhookEvent,
  supabaseAdmin: any,
  duffelApiKey: string,
) {
  const eventObject = event.data?.object ?? {};

  const possibleOrderId = firstString(
    eventObject?.order_id,
    eventObject?.order?.id,
    eventObject?.order?.order_id,
    eventObject?.metadata?.order_id,
  );

  if (!possibleOrderId) {
    console.log(
      'air.payment.succeeded received without an order ID. No booking created.',
    );

    return {
      success: true,
      stored: false,
      reason: 'payment_event_without_order_id',
    };
  }

  /*
   * Only treat this as a flight order if the resolved
   * resource is actually an air order.
   */
  if (possibleOrderId.startsWith('ord_')) {
    console.log(
      'air.payment.succeeded resolved to Duffel order:',
      possibleOrderId,
    );

    return await processFlightOrderById(
      possibleOrderId,
      event,
      supabaseAdmin,
      duffelApiKey,
    );
  }

  console.log(
    'air.payment.succeeded did not resolve to a Duffel flight order.',
    {
      possibleOrderId,
    },
  );

  return {
    success: true,
    stored: false,
    reason: 'not_a_flight_order',
  };
}

/* ============================================================
 * Shared flight processing
 * ============================================================ */

async function processFlightOrderById(
  orderId: string,
  event: DuffelWebhookEvent,
  supabaseAdmin: any,
  duffelApiKey: string,
) {
  const eventObject = event.data?.object ?? {};

  const orderResponse = await duffelGet(
    `/air/orders/${encodeURIComponent(orderId)}`,
    duffelApiKey,
  );

  if (!orderResponse?.data) {
    throw new Error(`Unable to fetch Duffel flight order ${orderId}`);
  }

  const order = orderResponse.data;

  const reference = extractAtlasReference(order, eventObject);

  const parsedReference = parseAtlasReference(reference);

  if (!parsedReference) {
    console.error('Unable to parse Atlas reference from Duffel order.', {
      orderId,
      reference,
    });

    return {
      success: false,
      reason: 'invalid_atlas_reference',
      order_id: orderId,
      reference,
    };
  }

  if (parsedReference.bookingType !== 'flight') {
    return {
      success: false,
      reason: 'reference_booking_type_mismatch',
      order_id: orderId,
      reference,
    };
  }

  const existing = await findByDuffelBookingId(supabaseAdmin, orderId);

  if (existing) {
    console.log('Flight order already persisted.', {
      orderId,
      bookingId: existing.id,
    });

    return {
      success: true,
      duplicate: true,
      order_id: orderId,
      booking_id: existing.id,
    };
  }

  const fullName = await getFullName(supabaseAdmin, parsedReference.userId);

  if (!fullName) {
    throw new Error(
      `Unable to determine Atlas full name for user ${parsedReference.userId}`,
    );
  }

  const details = extractFlightDetails(order);

  const bookingReference = firstString(
    order?.booking_reference,
    order?.reference,
  );

  const inserted = await insertBooking(supabaseAdmin, {
    user_id: parsedReference.userId,

    booking_type: 'flight',

    source: details.source,

    destination: details.destination,

    booking_id: orderId,

    status: 'success',

    booking_reference: bookingReference,

    fullName,

    departure_date: details.departure_date,

    return_date: details.return_date,

    airline: details.airline,

    passenger_name: details.passenger_name,

    price: details.price,

    currency: details.currency,

    updated_at: new Date().toISOString(),
  });

  if (!inserted) {
    throw new Error(`Unable to insert flight booking ${orderId}`);
  }

  console.log('Flight order successfully persisted.', {
    orderId,
    bookingId: inserted.id,
    userId: parsedReference.userId,
  });

  return {
    success: true,
    booking_type: 'flight',
    order_id: orderId,
    booking_id: inserted.id,
  };
}

/* ============================================================
 * Stay: successful booking
 * ============================================================ */

async function processStayCreated(
  event: DuffelWebhookEvent,
  supabaseAdmin: any,
  duffelApiKey: string,
) {
  const eventObject = event.data?.object ?? {};

  const bookingId = firstString(eventObject?.id, eventObject?.booking_id);

  if (!bookingId) {
    throw new Error('Unable to determine Duffel stay booking ID');
  }

  console.log('Processing Duffel stay booking:', bookingId);

  const bookingResponse = await duffelGet(
    `/stays/bookings/${encodeURIComponent(bookingId)}`,
    duffelApiKey,
  );

  if (!bookingResponse?.data) {
    throw new Error(`Unable to fetch Duffel stay booking ${bookingId}`);
  }

  const booking = bookingResponse.data;

  const quoteId = firstString(booking?.quote_id, eventObject?.quote_id);

  let quote: any = null;

  if (quoteId) {
    const quoteResponse = await duffelGet(
      `/stays/quotes/${encodeURIComponent(quoteId)}`,
      duffelApiKey,
    );

    quote = quoteResponse?.data ?? null;
  }

  const reference = extractAtlasReference(booking, eventObject);

  const parsedReference = parseAtlasReference(reference);

  if (!parsedReference) {
    console.error('Unable to parse Atlas stay reference.', {
      bookingId,
      quoteId,
      reference,
    });

    return {
      success: false,
      reason: 'invalid_atlas_reference',
      booking_id: bookingId,
      quote_id: quoteId,
      reference,
    };
  }

  if (parsedReference.bookingType !== 'hotel') {
    return {
      success: false,
      reason: 'reference_booking_type_mismatch',
      booking_id: bookingId,
      reference,
    };
  }

  const existing = await findByDuffelBookingId(supabaseAdmin, bookingId);

  if (existing) {
    console.log('Stay booking already exists. Skipping duplicate webhook.', {
      bookingId,
      existingBookingId: existing.id,
    });

    return {
      success: true,
      duplicate: true,
      booking_id: bookingId,
      internal_booking_id: existing.id,
    };
  }

  const fullName = await getFullName(supabaseAdmin, parsedReference.userId);

  if (!fullName) {
    throw new Error(
      `Unable to determine Atlas full name for user ${parsedReference.userId}`,
    );
  }

  const details = extractHotelDetails(booking, quote);

  const bookingReference = firstString(
    booking?.reference,
    booking?.booking_reference,
  );

  const inserted = await insertBooking(supabaseAdmin, {
    user_id: parsedReference.userId,

    booking_type: 'hotel',

    source: details.source,

    destination: details.destination,

    /*
     * IMPORTANT:
     *
     * This is the REAL Duffel stay booking ID.
     */
    booking_id: bookingId,

    status: 'success',

    booking_reference: bookingReference,

    fullName,

    departure_date: details.departure_date,

    return_date: details.return_date,

    hotel_name: details.hotel_name,

    passenger_name: details.passenger_name,

    price: details.price,

    currency: details.currency,

    updated_at: new Date().toISOString(),
  });

  if (!inserted) {
    throw new Error(`Unable to insert hotel booking ${bookingId}`);
  }

  console.log('Stay booking successfully inserted into user_bookings.', {
    bookingId,
    internalBookingId: inserted.id,
    userId: parsedReference.userId,
  });

  return {
    success: true,
    booking_type: 'hotel',
    booking_id: bookingId,
    internal_booking_id: inserted.id,
    quote_id: quoteId,
  };
}

/* ============================================================
 * Stay: failed booking
 * ============================================================ */

async function processStayFailed(
  event: DuffelWebhookEvent,
  supabaseAdmin: any,
) {
  const eventObject = event.data?.object ?? {};

  const bookingId = firstString(eventObject?.booking_id, eventObject?.id);

  const quoteId = firstString(eventObject?.quote_id);

  const reference = extractAtlasReference(eventObject, eventObject);

  const parsedReference = parseAtlasReference(reference);

  /*
   * A failed stay event may not contain an actual
   * Duffel booking ID.
   *
   * Do not invent one.
   */
  if (!bookingId) {
    console.warn(
      'Stay creation failed without a Duffel booking ID. No user_bookings row created.',
      {
        quoteId,
        reference,
      },
    );

    return {
      success: true,
      status: 'failure',
      stored: false,
      reason: 'missing_duffel_booking_id',
      quote_id: quoteId,
    };
  }

  const existing = await findByDuffelBookingId(supabaseAdmin, bookingId);

  if (existing) {
    console.log('Failed stay event received for an existing booking.', {
      bookingId,
      existingBookingId: existing.id,
    });

    return {
      success: true,
      status: 'failure',
      duplicate: true,
      booking_id: existing.id,
    };
  }

  if (!parsedReference) {
    console.error('Unable to parse Atlas reference for failed stay.', {
      bookingId,
      quoteId,
      reference,
    });

    return {
      success: false,
      status: 'failure',
      stored: false,
      reason: 'invalid_atlas_reference',
      booking_id: bookingId,
    };
  }

  if (parsedReference.bookingType !== 'hotel') {
    return {
      success: false,
      status: 'failure',
      stored: false,
      reason: 'reference_booking_type_mismatch',
      booking_id: bookingId,
    };
  }

  const fullName = await getFullName(supabaseAdmin, parsedReference.userId);

  if (!fullName) {
    throw new Error(
      `Unable to determine Atlas full name for user ${parsedReference.userId}`,
    );
  }

  const bookingReference = firstString(
    eventObject?.booking_reference,
    eventObject?.reference,
  );

  const inserted = await insertBooking(supabaseAdmin, {
    user_id: parsedReference.userId,

    booking_type: 'hotel',

    source: null,

    destination: null,

    booking_id: bookingId,

    status: 'failure',

    booking_reference: bookingReference,

    fullName,

    updated_at: new Date().toISOString(),
  });

  if (!inserted) {
    throw new Error(`Unable to insert failed hotel booking ${bookingId}`);
  }

  return {
    success: true,
    status: 'failure',
    stored: true,
    booking_id: inserted.id,
    duffel_booking_id: bookingId,
    quote_id: quoteId,
  };
}

/* ============================================================
 * Main webhook handler
 * ============================================================ */

Deno.serve(async (req: Request) => {
  console.log('========== DUFFEL WEBHOOK RECEIVED ==========');

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        success: false,
        error: 'Method not allowed',
      },
      405,
    );
  }

  const webhookSecret = Deno.env.get('DUFFEL_WEBHOOK_SECRET');

  const duffelApiKey = Deno.env.get('DUFFEL_API_KEY');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  const supabaseServiceKey = resolveSupabaseServiceKey();

  if (!webhookSecret) {
    console.error('DUFFEL_WEBHOOK_SECRET is not configured');

    return jsonResponse(
      {
        success: false,
        error: 'Webhook secret is not configured',
      },
      500,
    );
  }

  if (!duffelApiKey) {
    console.error('DUFFEL_API_KEY is not configured');

    return jsonResponse(
      {
        success: false,
        error: 'Duffel API key is not configured',
      },
      500,
    );
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase admin credentials are not configured');

    return jsonResponse(
      {
        success: false,
        error: 'Supabase admin credentials are not configured',
      },
      500,
    );
  }

  /*
   * Read the raw body exactly once.
   */
  const rawBody = await req.text();

  const signature = req.headers.get('X-Duffel-Signature');

  if (!signature) {
    console.error('Missing X-Duffel-Signature header');

    return jsonResponse(
      {
        success: false,
        error: 'Missing Duffel signature',
      },
      401,
    );
  }

  /*
   * Verify signature before parsing JSON.
   */
  const signatureValid = await verifyDuffelSignature(
    rawBody,
    signature,
    webhookSecret,
  );

  if (!signatureValid) {
    console.error('Invalid Duffel webhook signature');

    return jsonResponse(
      {
        success: false,
        error: 'Invalid webhook signature',
      },
      401,
    );
  }

  let event: DuffelWebhookEvent;

  try {
    event = JSON.parse(rawBody);
  } catch (error) {
    console.error('Invalid webhook JSON:', error);

    return jsonResponse(
      {
        success: false,
        error: 'Invalid JSON payload',
      },
      400,
    );
  }

  console.log(
    'Received Duffel webhook:',
    JSON.stringify({
      id: event.id,
      type: event.type,
      live_mode: event.live_mode,
      idempotency_key: event.idempotency_key,
    }),
  );

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    switch (event.type) {
      /* ======================================================
       * Flight booking created
       * ====================================================== */

      case 'order.created': {
        const result = await processFlightCreated(
          event,
          supabaseAdmin,
          duffelApiKey,
        );

        return jsonResponse({
          success: true,
          event_type: event.type,
          result,
        });
      }

      /* ======================================================
       * Flight booking failed
       * ====================================================== */

      case 'order.creation_failed': {
        const result = await processFlightFailed(event, supabaseAdmin);

        return jsonResponse({
          success: true,
          event_type: event.type,
          result,
        });
      }

      /* ======================================================
       * Hotel booking created
       * ====================================================== */

      case 'stays.booking.created': {
        const result = await processStayCreated(
          event,
          supabaseAdmin,
          duffelApiKey,
        );

        return jsonResponse({
          success: true,
          event_type: event.type,
          result,
        });
      }

      /* ======================================================
       * Hotel booking failed
       * ====================================================== */

      case 'stays.booking_creation_failed': {
        const result = await processStayFailed(event, supabaseAdmin);

        return jsonResponse({
          success: true,
          event_type: event.type,
          result,
        });
      }

      /* ======================================================
       * Payment succeeded
       * ====================================================== */

      case 'air.payment.succeeded': {
        const result = await processPaymentSucceeded(
          event,
          supabaseAdmin,
          duffelApiKey,
        );

        return jsonResponse({
          success: true,
          event_type: event.type,
          result,
        });
      }

      /* ======================================================
       * Other events
       * ====================================================== */

      default: {
        console.log(`Ignoring unsupported Duffel event: ${event.type}`);

        return jsonResponse({
          success: true,
          ignored: true,
          event_type: event.type ?? null,
        });
      }
    }
  } catch (error) {
    console.error('========== DUFFEL WEBHOOK PROCESSING ERROR ==========');

    console.error(error instanceof Error ? error.message : String(error));

    /*
     * Return 500 so Duffel can retry the event.
     */
    return jsonResponse(
      {
        success: false,
        event_type: event.type ?? null,
        error:
          error instanceof Error ? error.message : 'Webhook processing failed',
      },
      500,
    );
  }
});
