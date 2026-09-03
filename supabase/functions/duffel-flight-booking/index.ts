import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async req => {
  console.log('========== DUFFEL FLIGHT BOOKING ==========');
  console.log('METHOD:', req.method);
  console.log('URL:', req.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Method not allowed. Use POST.',
      }),
      {
        status: 405,
        headers: corsHeaders,
      },
    );
  }

  try {
    // ============================================================
    // ENVIRONMENT
    // ============================================================

    const DUFFEL_API_KEY = Deno.env.get('DUFFEL_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SECRET_KEYS_RAW = Deno.env.get('SUPABASE_SECRET_KEYS');

    if (!DUFFEL_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'DUFFEL_API_KEY is not configured.',
        }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    if (!SUPABASE_URL) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'SUPABASE_URL is not configured.',
        }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    if (!SUPABASE_SECRET_KEYS_RAW) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'SUPABASE_SECRET_KEYS is not configured.',
        }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    // ============================================================
    // SUPABASE SECRET KEY
    // ============================================================

    let supabaseSecretKey: string | null = null;

    try {
      const parsedSecretKeys = JSON.parse(SUPABASE_SECRET_KEYS_RAW);

      if (
        parsedSecretKeys &&
        typeof parsedSecretKeys === 'object' &&
        typeof parsedSecretKeys.default === 'string'
      ) {
        supabaseSecretKey = parsedSecretKeys.default;
      }
    } catch (error) {
      console.error('Unable to parse SUPABASE_SECRET_KEYS:', error);
    }

    if (!supabaseSecretKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unable to resolve Supabase secret key.',
        }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, supabaseSecretKey);

    // ============================================================
    // REQUEST BODY
    // ============================================================

    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON request body.',
        }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const orderId =
      typeof body.order_id === 'string' ? body.order_id.trim() : '';

    const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';

    console.log('ORDER ID:', orderId);
    console.log('USER ID:', userId);

    // ============================================================
    // VALIDATION
    // ============================================================

    if (!orderId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'order_id is required.',
        }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    if (!orderId.startsWith('ord_')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid Duffel flight order_id.',
        }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    if (!/^ord_[A-Za-z0-9_-]+$/.test(orderId)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid Duffel flight order_id format.',
        }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'user_id is required.',
        }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        userId,
      )
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid user_id format.',
        }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    // ============================================================
    // GET DUFFEL ORDER
    // ============================================================

    const duffelUrl = `https://api.duffel.com/air/orders/${encodeURIComponent(
      orderId,
    )}`;

    console.log('Fetching Duffel order:', duffelUrl);

    const duffelResponse = await fetch(duffelUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'Duffel-Version': 'v2',
        Authorization: `Bearer ${DUFFEL_API_KEY}`,
      },
    });

    console.log(
      'DUFFEL STATUS:',
      duffelResponse.status,
      duffelResponse.statusText,
    );

    let duffelPayload: Record<string, unknown>;

    try {
      duffelPayload = await duffelResponse.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid response received from Duffel.',
        }),
        {
          status: 502,
          headers: corsHeaders,
        },
      );
    }

    if (!duffelResponse.ok) {
      console.error('Duffel API error:', JSON.stringify(duffelPayload));

      const duffelError =
        typeof duffelPayload.error === 'object' && duffelPayload.error !== null
          ? (duffelPayload.error as Record<string, unknown>)
          : null;

      return new Response(
        JSON.stringify({
          success: false,
          error:
            typeof duffelError?.message === 'string'
              ? duffelError.message
              : 'Unable to retrieve Duffel flight booking.',
          duffel_status: duffelResponse.status,
          duffel_error: duffelPayload.error ?? null,
        }),
        {
          status: duffelResponse.status,
          headers: corsHeaders,
        },
      );
    }

    // ============================================================
    // ORDER
    // ============================================================

    const order =
      typeof duffelPayload.data === 'object' && duffelPayload.data !== null
        ? (duffelPayload.data as Record<string, any>)
        : null;

    if (!order) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Duffel returned an empty booking response.',
        }),
        {
          status: 502,
          headers: corsHeaders,
        },
      );
    }

    const orderIdFromDuffel = typeof order.id === 'string' ? order.id : orderId;

    const bookingReference =
      typeof order.booking_reference === 'string'
        ? order.booking_reference
        : null;

    const bookingType = typeof order.type === 'string' ? order.type : null;

    const liveMode =
      typeof order.live_mode === 'boolean' ? order.live_mode : null;

    const createdAt =
      typeof order.created_at === 'string' ? order.created_at : null;

    const syncedAt =
      typeof order.synced_at === 'string' ? order.synced_at : null;

    const offerId = typeof order.offer_id === 'string' ? order.offer_id : null;

    // ============================================================
    // PAYMENT
    // ============================================================

    const paymentStatus =
      order.payment_status && typeof order.payment_status === 'object'
        ? order.payment_status
        : null;

    const awaitingPayment =
      typeof paymentStatus?.awaiting_payment === 'boolean'
        ? paymentStatus.awaiting_payment
        : null;

    // ============================================================
    // PRICE
    // ============================================================

    const totalAmount = order.total_amount ?? null;

    const totalCurrency = order.total_currency ?? null;

    const baseAmount = order.base_amount ?? null;

    const baseCurrency = order.base_currency ?? null;

    const taxAmount = order.tax_amount ?? null;

    const taxCurrency = order.tax_currency ?? null;

    // ============================================================
    // OWNER / AIRLINE
    // ============================================================

    const owner =
      order.owner && typeof order.owner === 'object' ? order.owner : null;

    const ownerDetails = owner
      ? {
          id: owner.id ?? null,
          name: owner.name ?? null,
          iata_code: owner.iata_code ?? null,
          logo_symbol_url: owner.logo_symbol_url ?? null,
          logo_lockup_url: owner.logo_lockup_url ?? null,
        }
      : null;

    // ============================================================
    // PASSENGERS
    // ============================================================

    const passengers = Array.isArray(order.passengers)
      ? order.passengers.map((passenger: any) => ({
          id: passenger?.id ?? null,
          type: passenger?.type ?? null,
          title: passenger?.title ?? null,
          given_name: passenger?.given_name ?? null,
          family_name: passenger?.family_name ?? null,
          gender: passenger?.gender ?? null,
          born_on: passenger?.born_on ?? null,
          email: passenger?.email ?? null,
          phone_number: passenger?.phone_number ?? null,
          identity_documents: Array.isArray(passenger?.identity_documents)
            ? passenger.identity_documents
            : [],
        }))
      : [];

    // ============================================================
    // SLICES / ITINERARY
    // ============================================================

    const slices = Array.isArray(order.slices) ? order.slices : [];

    const itinerary = slices.map((slice: any) => {
      const segments = Array.isArray(slice?.segments) ? slice.segments : [];

      const firstSegment = segments[0] ?? null;

      const lastSegment =
        segments.length > 0 ? segments[segments.length - 1] : null;

      return {
        id: slice?.id ?? null,

        origin: firstSegment?.origin
          ? {
              id: firstSegment.origin.id ?? null,
              iata_code: firstSegment.origin.iata_code ?? null,
              iata_city_code: firstSegment.origin.iata_city_code ?? null,
              city_name: firstSegment.origin.city_name ?? null,
              name: firstSegment.origin.name ?? null,
              latitude: firstSegment.origin.latitude ?? null,
              longitude: firstSegment.origin.longitude ?? null,
            }
          : null,

        destination: lastSegment?.destination
          ? {
              id: lastSegment.destination.id ?? null,
              iata_code: lastSegment.destination.iata_code ?? null,
              iata_city_code: lastSegment.destination.iata_city_code ?? null,
              city_name: lastSegment.destination.city_name ?? null,
              name: lastSegment.destination.name ?? null,
              latitude: lastSegment.destination.latitude ?? null,
              longitude: lastSegment.destination.longitude ?? null,
            }
          : null,

        departure_at: firstSegment?.departing_at ?? null,

        arrival_at: lastSegment?.arriving_at ?? null,

        duration: slice?.duration ?? null,

        segments: segments.map((segment: any) => ({
          id: segment?.id ?? null,

          departing_at: segment?.departing_at ?? null,

          arriving_at: segment?.arriving_at ?? null,

          duration: segment?.duration ?? null,

          flight_number:
            segment?.marketing_carrier_flight_number ??
            segment?.operating_carrier_flight_number ??
            null,

          marketing_carrier: segment?.marketing_carrier
            ? {
                id: segment.marketing_carrier.id ?? null,
                name: segment.marketing_carrier.name ?? null,
                iata_code: segment.marketing_carrier.iata_code ?? null,
                icao_code: segment.marketing_carrier.icao_code ?? null,
                logo_symbol_url:
                  segment.marketing_carrier.logo_symbol_url ?? null,
                logo_lockup_url:
                  segment.marketing_carrier.logo_lockup_url ?? null,
              }
            : null,

          operating_carrier: segment?.operating_carrier
            ? {
                id: segment.operating_carrier.id ?? null,
                name: segment.operating_carrier.name ?? null,
                iata_code: segment.operating_carrier.iata_code ?? null,
                icao_code: segment.operating_carrier.icao_code ?? null,
                logo_symbol_url:
                  segment.operating_carrier.logo_symbol_url ?? null,
                logo_lockup_url:
                  segment.operating_carrier.logo_lockup_url ?? null,
              }
            : null,

          origin: segment?.origin
            ? {
                id: segment.origin.id ?? null,
                iata_code: segment.origin.iata_code ?? null,
                iata_city_code: segment.origin.iata_city_code ?? null,
                city_name: segment.origin.city_name ?? null,
                name: segment.origin.name ?? null,
                terminal: segment.origin_terminal ?? null,
              }
            : null,

          destination: segment?.destination
            ? {
                id: segment.destination.id ?? null,
                iata_code: segment.destination.iata_code ?? null,
                iata_city_code: segment.destination.iata_city_code ?? null,
                city_name: segment.destination.city_name ?? null,
                name: segment.destination.name ?? null,
                terminal: segment.destination_terminal ?? null,
              }
            : null,

          cabin_class: segment?.passengers?.[0]?.cabin_class ?? null,

          passengers: Array.isArray(segment?.passengers)
            ? segment.passengers.map((segmentPassenger: any) => ({
                passenger_id: segmentPassenger?.passenger_id ?? null,

                cabin_class: segmentPassenger?.cabin_class ?? null,

                cabin_class_marketing_name:
                  segmentPassenger?.cabin_class_marketing_name ?? null,

                fare_basis_code: segmentPassenger?.fare_basis_code ?? null,

                baggages: Array.isArray(segmentPassenger?.baggages)
                  ? segmentPassenger.baggages.map((baggage: any) => ({
                      type: baggage?.type ?? null,
                      quantity: baggage?.quantity ?? null,
                      weight: baggage?.weight ?? null,
                      weight_unit: baggage?.weight_unit ?? null,
                    }))
                  : [],
              }))
            : [],
        })),
      };
    });

    // ============================================================
    // SERVICES
    // ============================================================

    const services = Array.isArray(order.services)
      ? order.services.map((service: any) => ({
          id: service?.id ?? null,
          type: service?.type ?? null,
          quantity: service?.quantity ?? null,
          total_amount: service?.total_amount ?? null,
          total_currency: service?.total_currency ?? null,
          segment_ids: Array.isArray(service?.segment_ids)
            ? service.segment_ids
            : [],
          passenger_ids: Array.isArray(service?.passenger_ids)
            ? service.passenger_ids
            : [],
          metadata: service?.metadata ?? null,
        }))
      : [];

    // ============================================================
    // DOCUMENTS
    // ============================================================

    const documents = Array.isArray(order.documents)
      ? order.documents.map((document: any) => ({
          id: document?.id ?? null,
          type: document?.type ?? null,
          unique_identifier: document?.unique_identifier ?? null,
          passenger_id: document?.passenger_id ?? null,
          expires_at: document?.expires_at ?? null,
        }))
      : [];

    // ============================================================
    // AVAILABLE ACTIONS
    // ============================================================

    const availableActions = Array.isArray(order.available_actions)
      ? order.available_actions
      : [];

    // ============================================================
    // DATABASE FIELDS
    // ============================================================

    const firstSlice = slices.length > 0 ? slices[0] : null;

    const lastSlice = slices.length > 0 ? slices[slices.length - 1] : null;

    const firstSliceSegments = Array.isArray(firstSlice?.segments)
      ? firstSlice.segments
      : [];

    const lastSliceSegments = Array.isArray(lastSlice?.segments)
      ? lastSlice.segments
      : [];

    const firstSegment = firstSliceSegments[0] ?? null;

    const lastSegmentOfFirstSlice =
      firstSliceSegments.length > 0
        ? firstSliceSegments[firstSliceSegments.length - 1]
        : null;

    const source =
      firstSegment?.origin?.iata_code ??
      firstSegment?.origin?.iata_city_code ??
      firstSegment?.origin?.name ??
      null;

    const destination =
      lastSegmentOfFirstSlice?.destination?.iata_code ??
      lastSegmentOfFirstSlice?.destination?.iata_city_code ??
      lastSegmentOfFirstSlice?.destination?.name ??
      null;

    const departureDateTime = firstSegment?.departing_at ?? null;

    const departureDate =
      typeof departureDateTime === 'string' && departureDateTime.length >= 10
        ? departureDateTime.substring(0, 10)
        : null;

    let returnDate: string | null = null;

    if (slices.length > 1) {
      const returnSlice = slices[1];

      const returnSegments = Array.isArray(returnSlice?.segments)
        ? returnSlice.segments
        : [];

      const firstReturnSegment = returnSegments[0] ?? null;

      const returnDateTime = firstReturnSegment?.departing_at ?? null;

      if (typeof returnDateTime === 'string' && returnDateTime.length >= 10) {
        returnDate = returnDateTime.substring(0, 10);
      }
    }

    const airline =
      firstSegment?.marketing_carrier?.name ??
      firstSegment?.operating_carrier?.name ??
      owner?.name ??
      null;

    const passengerNames = passengers
      .map((passenger: any) => {
        const givenName =
          typeof passenger?.given_name === 'string'
            ? passenger.given_name.trim()
            : '';

        const familyName =
          typeof passenger?.family_name === 'string'
            ? passenger.family_name.trim()
            : '';

        return `${givenName} ${familyName}`.trim();
      })
      .filter((name: string) => name.length > 0);

    const passengerName =
      passengerNames.length > 0 ? passengerNames.join(', ') : null;

    let price: number | null = null;

    if (totalAmount !== null) {
      const parsedPrice = Number(totalAmount);

      if (Number.isFinite(parsedPrice)) {
        price = parsedPrice;
      }
    }

    const currency = typeof totalCurrency === 'string' ? totalCurrency : null;

    // ============================================================
    // NORMALIZED RESPONSE
    // ============================================================

    const booking = {
      order_id: orderIdFromDuffel,

      booking_reference: bookingReference,

      type: bookingType,

      live_mode: liveMode,

      status: awaitingPayment === true ? 'awaiting_payment' : 'confirmed',

      created_at: createdAt,

      synced_at: syncedAt,

      offer_id: offerId,

      price: {
        total_amount: totalAmount,
        total_currency: totalCurrency,
        base_amount: baseAmount,
        base_currency: baseCurrency,
        tax_amount: taxAmount,
        tax_currency: taxCurrency,
      },

      payment: {
        awaiting_payment: awaitingPayment,

        payment_required_by: paymentStatus?.payment_required_by ?? null,

        price_guarantee_expires_at:
          paymentStatus?.price_guarantee_expires_at ?? null,
      },

      airline: ownerDetails,

      passengers,

      itinerary,

      services,

      documents,

      available_actions: availableActions,
    };

    // ============================================================
    // UPDATE USER BOOKINGS
    // ============================================================

    const updatePayload = {
      source,
      destination,
      departure_date: departureDate,
      return_date: returnDate,
      airline,
      passenger_name: passengerName,
      price,
      currency,
      booking_reference: bookingReference,

      status: awaitingPayment === true ? 'processing' : 'success',

      updated_at: new Date().toISOString(),
    };

    console.log('Updating user_bookings:', JSON.stringify(updatePayload));

    const { data: updatedBooking, error: updateBookingError } =
      await supabaseAdmin
        .from('user_bookings')
        .update(updatePayload)
        .eq('user_id', userId)
        .eq('booking_id', orderIdFromDuffel)
        .select(
          'id, user_id, booking_type, source, destination, booking_id, status, booking_reference, "fullName", departure_date, return_date, hotel_name, airline, passenger_name, price, currency, created_at, updated_at',
        )
        .maybeSingle();

    if (updateBookingError) {
      console.error('Unable to update user_bookings:', updateBookingError);

      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Booking was retrieved from Duffel, but the user booking could not be updated.',
          details: updateBookingError.message,
          booking,
        }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    // ============================================================
    // VERIFY MATCHING ROW
    // ============================================================

    if (!updatedBooking) {
      console.error('No matching user_bookings row found.');

      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Duffel booking was retrieved, but no matching user booking was found.',
          order_id: orderIdFromDuffel,
          user_id: userId,
          booking,
        }),
        {
          status: 404,
          headers: corsHeaders,
        },
      );
    }

    console.log('user_bookings updated successfully:', updatedBooking.id);

    // ============================================================
    // SUCCESS
    // ============================================================

    console.log(
      'Duffel booking retrieved and database updated successfully:',
      orderIdFromDuffel,
    );

    return new Response(
      JSON.stringify({
        success: true,
        booking,
        user_booking: updatedBooking,
      }),
      {
        status: 200,
        headers: corsHeaders,
      },
    );
  } catch (error) {
    console.error('DUFFEL FLIGHT BOOKING ERROR:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : 'Unexpected server error.',
      }),
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});
