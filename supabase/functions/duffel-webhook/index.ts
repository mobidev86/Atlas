import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DUFFEL_BASE_URL = 'https://api.duffel.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-duffel-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Convert Uint8Array to lowercase hexadecimal.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time comparison.
 */
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

/**
 * Verify Duffel's webhook signature.
 *
 * Duffel sends:
 *
 * X-Duffel-Signature:
 * t=timestamp,v1=signature
 *
 * The signature is HMAC-SHA256 of:
 *
 * timestamp + "." + raw request body
 */
async function verifyDuffelSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  try {
    if (!signatureHeader || !secret) {
      return false;
    }

    const parts = signatureHeader.split(',');

    let timestamp: string | null = null;
    let receivedSignature: string | null = null;

    for (const part of parts) {
      const [key, ...valueParts] = part.split('=');

      if (!key || valueParts.length === 0) {
        continue;
      }

      const value = valueParts.join('=');

      if (key.trim() === 't') {
        timestamp = value.trim();
      }

      if (key.trim() === 'v1') {
        receivedSignature = value.trim();
      }
    }

    if (!timestamp || !receivedSignature) {
      console.error('Invalid Duffel signature format');
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

    const expectedSignature = bytesToHex(new Uint8Array(signatureBuffer));

    return secureCompare(
      expectedSignature.toLowerCase(),
      receivedSignature.toLowerCase(),
    );
  } catch (error) {
    console.error('Duffel signature verification error:', error);
    return false;
  }
}

/**
 * Extract our Atlas booking reference.
 *
 * Expected formats:
 *
 * ATLAS_FLIGHT_<user_id>_<uuid>
 * ATLAS_HOTEL_<user_id>_<uuid>
 *
 * The UUID at the end is our internal booking record ID.
 */
function parseAtlasReference(reference: string | null | undefined): {
  bookingType: 'flight' | 'hotel';
  userId: string;
  internalBookingId: string;
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
      internalBookingId: flightMatch[2],
    };
  }

  const hotelMatch = reference.match(
    /^ATLAS_HOTEL_([0-9a-fA-F-]{36})_([0-9a-fA-F-]{36})$/,
  );

  if (hotelMatch) {
    return {
      bookingType: 'hotel',
      userId: hotelMatch[1],
      internalBookingId: hotelMatch[2],
    };
  }

  return null;
}

/**
 * Extract a string safely.
 */
function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

/**
 * Extract the first available value from multiple possible paths.
 */
function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const result = stringValue(value);

    if (result) {
      return result;
    }
  }

  return null;
}

/**
 * Convert an amount to number.
 */
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

/**
 * Convert date/time into YYYY-MM-DD.
 */
function dateOnly(value: unknown): string | null {
  const text = stringValue(value);

  if (!text) {
    return null;
  }

  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);

  return match ? match[1] : null;
}

/**
 * Get Duffel API resource.
 */
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
    console.error(`Duffel GET ${path} network error:`, error);
    return null;
  }
}

/**
 * Get the internal Atlas booking record.
 */
async function getInternalBooking(
  supabaseAdmin: any,
  internalBookingId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('user_bookings')
    .select('*')
    .eq('id', internalBookingId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch internal booking:', error);
    return null;
  }

  return data;
}

/**
 * Get profile full name.
 */
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

/**
 * Extract flight details from Duffel order.
 */
function extractFlightDetails(order: any) {
  const slices = Array.isArray(order?.slices) ? order.slices : [];

  const firstSlice = slices[0];

  const lastSlice = slices.length > 0 ? slices[slices.length - 1] : null;

  const firstSegment =
    Array.isArray(firstSlice?.segments) && firstSlice.segments.length > 0
      ? firstSlice.segments[0]
      : null;

  const lastSliceSegments = Array.isArray(lastSlice?.segments)
    ? lastSlice.segments
    : [];

  const lastSegment =
    lastSliceSegments.length > 0
      ? lastSliceSegments[lastSliceSegments.length - 1]
      : null;

  const source = firstString(
    firstSegment?.origin?.iata_code,
    firstSegment?.origin?.iata,
    firstSlice?.origin?.iata_code,
    firstSlice?.origin?.iata,
  );

  const destination = firstString(
    lastSegment?.destination?.iata_code,
    lastSegment?.destination?.iata,
    lastSlice?.destination?.iata_code,
    lastSlice?.destination?.iata,
  );

  const departureDate = dateOnly(
    firstString(
      firstSegment?.departing_at,
      firstSlice?.departing_at,
      order?.slices?.[0]?.segments?.[0]?.departing_at,
    ),
  );

  let returnDate: string | null = null;

  if (slices.length > 1) {
    const returnSlice = slices[1];

    const returnSegments = Array.isArray(returnSlice?.segments)
      ? returnSlice.segments
      : [];

    const lastReturnSegment =
      returnSegments.length > 0
        ? returnSegments[returnSegments.length - 1]
        : null;

    returnDate = dateOnly(
      firstString(
        lastReturnSegment?.arriving_at,
        lastReturnSegment?.departing_at,
        returnSlice?.arriving_at,
        returnSlice?.departing_at,
      ),
    );
  }

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

  const airline = firstString(
    order?.owner?.name,
    order?.owner?.iata_code,
    firstSegment?.marketing_carrier?.name,
    firstSegment?.operating_carrier?.name,
  );

  const price = numberValue(
    firstString(order?.total_amount, order?.price?.amount),
  );

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

/**
 * Extract hotel/stay details.
 */
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
  );

  const source = firstString(
    accommodation?.location?.city,
    accommodation?.location?.city_name,
    booking?.city,
    quote?.city,
  );

  const destination = firstString(
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
    ),
  );

  const currency = firstString(
    booking?.total_currency,
    booking?.total?.currency,
    quote?.total_currency,
  );

  const departureDate = dateOnly(
    firstString(
      booking?.check_in_date,
      booking?.check_in,
      quote?.check_in_date,
    ),
  );

  const returnDate = dateOnly(
    firstString(
      booking?.check_out_date,
      booking?.check_out,
      quote?.check_out_date,
    ),
  );

  return {
    source,
    destination,
    departure_date: departureDate,
    return_date: returnDate,
    hotel_name: hotelName,
    passenger_name: passengerName,
    price,
    currency,
  };
}

/**
 * Find an internal booking by Duffel booking/order ID.
 */
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

/**
 * Update a booking record.
 */
async function updateBooking(
  supabaseAdmin: any,
  id: string,
  updates: Record<string, unknown>,
) {
  const { data, error } = await supabaseAdmin
    .from('user_bookings')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Failed to update user_bookings:', error);
    return null;
  }

  return data;
}

/**
 * Process successful flight order.
 */
async function processFlightCreated(
  event: DuffelWebhookEvent,
  supabaseAdmin: any,
  duffelApiKey: string,
) {
  const eventObject = event.data?.object ?? {};

  const orderId = firstString(
    eventObject?.id,
    eventObject?.order_id,
    event?.idempotency_key,
  );

  if (!orderId) {
    throw new Error('Unable to determine Duffel flight order ID');
  }

  console.log('Processing flight order:', orderId);

  const orderResponse = await duffelGet(
    `/air/orders/${encodeURIComponent(orderId)}`,
    duffelApiKey,
  );

  const order = orderResponse?.data ?? eventObject;

  const bookingReference = firstString(
    order?.booking_reference,
    order?.reference,
  );

  const metadataReference = firstString(
    order?.metadata?.checkout_reference,
    order?.metadata?.booking_reference,
    eventObject?.metadata?.checkout_reference,
    eventObject?.metadata?.booking_reference,
  );

  const reference = metadataReference ?? bookingReference ?? null;

  /*
   * First try our known internal booking ID.
   */
  let internalBooking = await findByDuffelBookingId(supabaseAdmin, orderId);

  /*
   * Then try our Atlas reference.
   */
  let parsedReference = parseAtlasReference(reference);

  if (!internalBooking && parsedReference) {
    internalBooking = await getInternalBooking(
      supabaseAdmin,
      parsedReference.internalBookingId,
    );
  }

  /*
   * If we cannot associate the Duffel order with a user,
   * don't create an orphan booking.
   */
  if (!internalBooking) {
    console.error(
      'Unable to associate Duffel flight order with an Atlas booking.',
      {
        orderId,
        reference,
      },
    );

    return {
      success: false,
      reason: 'internal_booking_not_found',
      order_id: orderId,
      reference,
    };
  }

  const details = extractFlightDetails(order);

  const updates: Record<string, unknown> = {
    booking_id: orderId,
    booking_type: 'flight',
    status: 'success',
  };

  if (details.source) {
    updates.source = details.source;
  }

  if (details.destination) {
    updates.destination = details.destination;
  }

  if (bookingReference) {
    updates.booking_reference = bookingReference;
  }

  if (details.departure_date) {
    updates.departure_date = details.departure_date;
  }

  if (details.return_date) {
    updates.return_date = details.return_date;
  }

  if (details.airline) {
    updates.airline = details.airline;
  }

  if (details.passenger_name) {
    updates.passenger_name = details.passenger_name;
  }

  if (details.price !== null) {
    updates.price = details.price;
  }

  if (details.currency) {
    updates.currency = details.currency;
  }

  const updated = await updateBooking(
    supabaseAdmin,
    internalBooking.id,
    updates,
  );

  if (!updated) {
    throw new Error(`Unable to update flight booking ${internalBooking.id}`);
  }

  return {
    success: true,
    booking_type: 'flight',
    order_id: orderId,
    internal_booking_id: internalBooking.id,
  };
}

/**
 * Process failed flight creation.
 */
async function processFlightFailed(
  event: DuffelWebhookEvent,
  supabaseAdmin: any,
) {
  const eventObject = event.data?.object ?? {};

  const orderId = firstString(
    eventObject?.order_id,
    eventObject?.id,
    event?.idempotency_key,
  );

  const reference = firstString(
    eventObject?.metadata?.checkout_reference,
    eventObject?.metadata?.booking_reference,
    eventObject?.reference,
  );

  let internalBooking = orderId
    ? await findByDuffelBookingId(supabaseAdmin, orderId)
    : null;

  const parsedReference = parseAtlasReference(reference);

  if (!internalBooking && parsedReference) {
    internalBooking = await getInternalBooking(
      supabaseAdmin,
      parsedReference.internalBookingId,
    );
  }

  if (!internalBooking) {
    console.error(
      'Unable to associate failed flight booking with Atlas booking.',
      {
        orderId,
        reference,
      },
    );

    return {
      success: false,
      reason: 'internal_booking_not_found',
      order_id: orderId,
    };
  }

  await updateBooking(supabaseAdmin, internalBooking.id, {
    status: 'failure',
    ...(orderId ? { booking_id: orderId } : {}),
  });

  return {
    success: true,
    booking_type: 'flight',
    status: 'failure',
    internal_booking_id: internalBooking.id,
    order_id: orderId,
  };
}

/**
 * Process successful hotel/stay booking.
 */
async function processStayCreated(
  event: DuffelWebhookEvent,
  supabaseAdmin: any,
  duffelApiKey: string,
) {
  const eventObject = event.data?.object ?? {};

  const bookingId = firstString(
    eventObject?.id,
    eventObject?.booking_id,
    event?.idempotency_key,
  );

  if (!bookingId) {
    throw new Error('Unable to determine Duffel stay booking ID');
  }

  console.log('Processing stay booking:', bookingId);

  const bookingResponse = await duffelGet(
    `/stays/bookings/${encodeURIComponent(bookingId)}`,
    duffelApiKey,
  );

  const booking = bookingResponse?.data ?? eventObject;

  const quoteId = firstString(booking?.quote_id, eventObject?.quote_id);

  let quote: any = null;

  if (quoteId) {
    const quoteResponse = await duffelGet(
      `/stays/quotes/${encodeURIComponent(quoteId)}`,
      duffelApiKey,
    );

    quote = quoteResponse?.data ?? null;
  }

  const bookingReference = firstString(
    booking?.reference,
    booking?.booking_reference,
  );

  /*
   * Our checkout reference may be stored in
   * Duffel booking metadata.
   */
  const reference = firstString(
    booking?.metadata?.checkout_reference,
    booking?.metadata?.booking_reference,
    eventObject?.metadata?.checkout_reference,
    eventObject?.metadata?.booking_reference,
  );

  let internalBooking = await findByDuffelBookingId(supabaseAdmin, bookingId);

  const parsedReference = parseAtlasReference(reference);

  if (!internalBooking && parsedReference) {
    internalBooking = await getInternalBooking(
      supabaseAdmin,
      parsedReference.internalBookingId,
    );
  }

  if (!internalBooking) {
    console.error(
      'Unable to associate Duffel stay booking with Atlas booking.',
      {
        bookingId,
        quoteId,
        reference,
      },
    );

    return {
      success: false,
      reason: 'internal_booking_not_found',
      booking_id: bookingId,
      quote_id: quoteId,
    };
  }

  const details = extractHotelDetails(booking, quote);

  const updates: Record<string, unknown> = {
    booking_id: bookingId,
    booking_type: 'hotel',
    status: 'success',
  };

  if (bookingReference) {
    updates.booking_reference = bookingReference;
  }

  if (details.source) {
    updates.source = details.source;
  }

  if (details.destination) {
    updates.destination = details.destination;
  }

  if (details.departure_date) {
    updates.departure_date = details.departure_date;
  }

  if (details.return_date) {
    updates.return_date = details.return_date;
  }

  if (details.hotel_name) {
    updates.hotel_name = details.hotel_name;
  }

  if (details.passenger_name) {
    updates.passenger_name = details.passenger_name;
  }

  if (details.price !== null) {
    updates.price = details.price;
  }

  if (details.currency) {
    updates.currency = details.currency;
  }

  const updated = await updateBooking(
    supabaseAdmin,
    internalBooking.id,
    updates,
  );

  if (!updated) {
    throw new Error(`Unable to update hotel booking ${internalBooking.id}`);
  }

  return {
    success: true,
    booking_type: 'hotel',
    booking_id: bookingId,
    quote_id: quoteId,
    internal_booking_id: internalBooking.id,
  };
}

/**
 * Process failed hotel/stay booking.
 */
async function processStayFailed(
  event: DuffelWebhookEvent,
  supabaseAdmin: any,
) {
  const eventObject = event.data?.object ?? {};

  const bookingId = firstString(eventObject?.booking_id, eventObject?.id);

  const quoteId = firstString(eventObject?.quote_id);

  const reference = firstString(
    eventObject?.metadata?.checkout_reference,
    eventObject?.metadata?.booking_reference,
  );

  let internalBooking = bookingId
    ? await findByDuffelBookingId(supabaseAdmin, bookingId)
    : null;

  const parsedReference = parseAtlasReference(reference);

  if (!internalBooking && parsedReference) {
    internalBooking = await getInternalBooking(
      supabaseAdmin,
      parsedReference.internalBookingId,
    );
  }

  /*
   * For stays.booking_creation_failed Duffel's payload
   * may only contain quote_id, so we cannot always identify
   * the internal record from the webhook alone.
   */
  if (!internalBooking && quoteId) {
    console.warn(
      'Stay creation failed but no internal booking could be matched.',
      {
        bookingId,
        quoteId,
      },
    );

    return {
      success: false,
      reason: 'internal_booking_not_found',
      booking_id: bookingId,
      quote_id: quoteId,
    };
  }

  if (!internalBooking) {
    return {
      success: false,
      reason: 'internal_booking_not_found',
      booking_id: bookingId,
      quote_id: quoteId,
    };
  }

  await updateBooking(supabaseAdmin, internalBooking.id, {
    status: 'failure',
    ...(bookingId ? { booking_id: bookingId } : {}),
  });

  return {
    success: true,
    booking_type: 'hotel',
    status: 'failure',
    internal_booking_id: internalBooking.id,
    booking_id: bookingId,
    quote_id: quoteId,
  };
}

Deno.serve(async (req: Request) => {
  /*
   * Duffel sends POST requests.
   */
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

  const supabaseServiceKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SECRET_KEY') ??
    Deno.env.get('SUPABASE_SECRET_KEYS');

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
   * IMPORTANT:
   * Read the body exactly once and before JSON parsing.
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

  /*
   * Ignore unsupported events but return 200.
   *
   * Duffel retries failed deliveries, so returning 200
   * for events we intentionally don't process prevents
   * unnecessary retries.
   */
  switch (event.type) {
    case 'order.created': {
      try {
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
      } catch (error) {
        console.error('Failed to process order.created:', error);

        return jsonResponse(
          {
            success: false,
            event_type: event.type,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to process flight booking',
          },
          500,
        );
      }
    }

    case 'order.creation_failed': {
      try {
        const result = await processFlightFailed(event, supabaseAdmin);

        return jsonResponse({
          success: true,
          event_type: event.type,
          result,
        });
      } catch (error) {
        console.error('Failed to process order.creation_failed:', error);

        return jsonResponse(
          {
            success: false,
            event_type: event.type,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to process failed flight booking',
          },
          500,
        );
      }
    }

    case 'stays.booking.created': {
      try {
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
      } catch (error) {
        console.error('Failed to process stays.booking.created:', error);

        return jsonResponse(
          {
            success: false,
            event_type: event.type,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to process hotel booking',
          },
          500,
        );
      }
    }

    case 'stays.booking_creation_failed': {
      try {
        const result = await processStayFailed(event, supabaseAdmin);

        return jsonResponse({
          success: true,
          event_type: event.type,
          result,
        });
      } catch (error) {
        console.error(
          'Failed to process stays.booking_creation_failed:',
          error,
        );

        return jsonResponse(
          {
            success: false,
            event_type: event.type,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to process failed hotel booking',
          },
          500,
        );
      }
    }

    default: {
      console.log(`Ignoring unsupported Duffel event: ${event.type}`);

      return jsonResponse({
        success: true,
        ignored: true,
        event_type: event.type ?? null,
      });
    }
  }
});
