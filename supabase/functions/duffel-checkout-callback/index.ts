import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DUFFEL_API_URL = 'https://api.duffel.com';

Deno.serve(async (req: Request) => {
  try {
    // =========================================================
    // Read Duffel callback URL
    // =========================================================

    const url = new URL(req.url);

    const status = url.searchParams.get('status');
    const orderId = url.searchParams.get('order_id');
    const reference = url.searchParams.get('reference');

    console.log('========== DUFFEL CHECKOUT CALLBACK ==========');

    console.log('METHOD:', req.method);
    console.log('STATUS:', status);
    console.log('ORDER ID:', orderId);
    console.log('REFERENCE:', reference);

    // =========================================================
    // SUCCESS
    // =========================================================

    if (status === 'success') {
      // -------------------------------------------------------
      // Validate callback parameters
      // -------------------------------------------------------

      if (!orderId || !reference) {
        console.error(
          'Missing order_id or reference in successful Duffel callback.',
        );

        return new Response(
          JSON.stringify({
            success: false,
            status: 'success',
            error: 'Required booking information was not returned by Duffel.',
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
            },
          },
        );
      }

      // =======================================================
      // Parse Atlas reference
      //
      // Expected:
      //
      // ATLAS_FLIGHT_<user_id>_<uuid>
      // ATLAS_HOTEL_<user_id>_<uuid>
      // =======================================================

      const referenceParts = reference.split('_');

      if (referenceParts.length < 4) {
        throw new Error(`Invalid Atlas booking reference: ${reference}`);
      }

      const atlasPrefix = referenceParts[0];

      const bookingTypeFromReference = referenceParts[1]?.toLowerCase();

      const userId = referenceParts[2];

      if (atlasPrefix !== 'ATLAS') {
        throw new Error(`Invalid Atlas reference prefix: ${reference}`);
      }

      if (
        bookingTypeFromReference !== 'flight' &&
        bookingTypeFromReference !== 'hotel'
      ) {
        throw new Error(`Invalid booking type in reference: ${reference}`);
      }

      if (!userId) {
        throw new Error(
          `Unable to determine user ID from reference: ${reference}`,
        );
      }

      console.log('BOOKING TYPE:', bookingTypeFromReference);

      console.log('USER ID:', userId);

      // =======================================================
      // Environment variables
      // =======================================================

      const supabaseUrl = Deno.env.get('SUPABASE_URL');

      const supabaseSecretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS');

      const duffelApiKey = Deno.env.get('DUFFEL_API_KEY');

      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL is not configured.');
      }

      if (!supabaseSecretKeysRaw) {
        throw new Error('SUPABASE_SECRET_KEYS is not configured.');
      }

      if (!duffelApiKey) {
        throw new Error('DUFFEL_API_KEY is not configured.');
      }

      // =======================================================
      // Resolve Supabase secret key
      // =======================================================

      let supabaseSecretKey: string | null = null;

      try {
        const secretKeys = JSON.parse(supabaseSecretKeysRaw);

        supabaseSecretKey = secretKeys?.default ?? null;
      } catch (error) {
        console.error('Unable to parse SUPABASE_SECRET_KEYS:', error);

        throw new Error('Unable to parse Supabase secret keys.');
      }

      if (!supabaseSecretKey) {
        throw new Error('Default Supabase secret key is not configured.');
      }

      console.log('Supabase default secret key resolved successfully.');

      // =======================================================
      // Supabase admin client
      // =======================================================

      const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

      // =======================================================
      // Retrieve user profile
      //
      // profiles:
      //
      // full_name
      //
      // user_bookings:
      //
      // "fullName"
      // =======================================================

      console.log('Retrieving user profile...');

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Unable to fetch profile:', profileError);

        throw new Error(
          `Unable to fetch user profile: ${profileError.message}`,
        );
      }

      const fullName = profile?.full_name;

      if (!fullName) {
        throw new Error('User profile does not contain full_name.');
      }

      console.log('USER PROFILE FOUND:', fullName);

      // =======================================================
      // Booking details
      // =======================================================

      let source: string | null = null;

      let destination: string | null = null;

      let bookingReference: string | null = null;

      // =======================================================
      // FLIGHT
      // =======================================================

      if (bookingTypeFromReference === 'flight') {
        console.log('Retrieving Duffel flight order:', orderId);

        const duffelOrderResponse = await fetch(
          `${DUFFEL_API_URL}/air/orders/${encodeURIComponent(orderId)}`,
          {
            method: 'GET',

            headers: {
              Accept: 'application/json',

              'Accept-Encoding': 'gzip',

              'Duffel-Version': 'v2',

              Authorization: `Bearer ${duffelApiKey}`,
            },
          },
        );

        const responseText = await duffelOrderResponse.text();

        let duffelOrderData: any | null = null;

        try {
          duffelOrderData = JSON.parse(responseText);
        } catch {
          duffelOrderData = null;
        }

        if (!duffelOrderResponse.ok) {
          console.error('Duffel order retrieval failed:', {
            status: duffelOrderResponse.status,

            response: duffelOrderData ?? responseText,
          });

          throw new Error(
            `Duffel order retrieval failed with status ${duffelOrderResponse.status}.`,
          );
        }

        const order = duffelOrderData?.data;

        if (!order) {
          throw new Error('Duffel order response did not contain order data.');
        }

        console.log('Duffel order retrieved successfully.');

        // =====================================================
        // Booking reference / PNR
        // =====================================================

        bookingReference = order.booking_reference ?? null;

        console.log('BOOKING REFERENCE:', bookingReference);

        // =====================================================
        // Flight slices
        // =====================================================

        const slices = order.slices ?? [];

        if (!Array.isArray(slices) || slices.length === 0) {
          throw new Error('Duffel order does not contain any flight slices.');
        }

        // =====================================================
        // OUTBOUND SLICE
        //
        // We intentionally use the FIRST slice.
        //
        // Example:
        //
        // Slice 1:
        // BOM → DXB
        //
        // Slice 2:
        // DXB → BOM
        //
        // We want:
        //
        // source      = BOM
        // destination = DXB
        //
        // Therefore we use the first segment of the first
        // slice and do NOT use the final segment of the order.
        // =====================================================

        const outboundSlice = slices[0];

        const outboundSegments = outboundSlice?.segments ?? [];

        if (!Array.isArray(outboundSegments) || outboundSegments.length === 0) {
          throw new Error(
            'Duffel order does not contain segments for the outbound flight.',
          );
        }

        // -----------------------------------------------------
        // First segment of outbound journey
        // -----------------------------------------------------

        const firstOutboundSegment = outboundSegments[0];

        // -----------------------------------------------------
        // SOURCE
        // -----------------------------------------------------

        source =
          firstOutboundSegment?.origin?.iata_code ??
          firstOutboundSegment?.origin?.name ??
          null;

        // -----------------------------------------------------
        // DESTINATION
        //
        // IMPORTANT:
        //
        // Use the destination of the LAST segment of the
        // OUTBOUND slice.
        //
        // This correctly handles connecting flights:
        //
        // BOM → DEL → DXB
        //
        // source      = BOM
        // destination = DXB
        //
        // For a return trip:
        //
        // Slice 1: BOM → DXB
        // Slice 2: DXB → BOM
        //
        // we still use Slice 1, so:
        //
        // source      = BOM
        // destination = DXB
        // -----------------------------------------------------

        const lastOutboundSegment =
          outboundSegments[outboundSegments.length - 1];

        destination =
          lastOutboundSegment?.destination?.iata_code ??
          lastOutboundSegment?.destination?.name ??
          null;

        console.log('FLIGHT SOURCE:', source);

        console.log('FLIGHT DESTINATION:', destination);
      }

      // =======================================================
      // HOTEL
      // =======================================================

      if (bookingTypeFromReference === 'hotel') {
        console.log('Hotel booking callback received.');

        console.log('HOTEL BOOKING ID:', orderId);

        /*
         * Hotel-specific Duffel Stays mapping
         * remains intentionally unchanged for now.
         */
      }

      // =======================================================
      // Validate source
      // =======================================================

      if (!source) {
        console.error('Booking source could not be determined.');

        throw new Error('Unable to determine booking source.');
      }

      // =======================================================
      // Check duplicate booking
      // =======================================================

      console.log('Checking for existing booking...');

      const { data: existingBooking, error: existingBookingError } =
        await supabaseAdmin
          .from('user_bookings')
          .select('id')
          .eq('booking_id', orderId)
          .maybeSingle();

      if (existingBookingError) {
        console.error('Error checking existing booking:', existingBookingError);

        throw new Error(
          `Unable to check existing booking: ${existingBookingError.message}`,
        );
      }

      // =======================================================
      // INSERT BOOKING
      // =======================================================

      if (!existingBooking) {
        console.log('Creating user_bookings record...');

        const { data: insertedBooking, error: insertError } =
          await supabaseAdmin
            .from('user_bookings')
            .insert({
              user_id: userId,

              booking_type: bookingTypeFromReference,

              source,

              destination,

              booking_id: orderId,

              status: 'success',

              booking_reference: bookingReference,

              fullName,
            })
            .select()
            .single();

        if (insertError) {
          console.error('Unable to insert user booking:', insertError);

          throw new Error(`Unable to save booking: ${insertError.message}`);
        }

        console.log('Booking successfully stored in user_bookings.');

        console.log('DATABASE BOOKING ID:', insertedBooking.id);

        return new Response(
          JSON.stringify({
            success: true,

            status: 'success',

            order_id: orderId,

            reference,

            booking_type: bookingTypeFromReference,

            booking_reference: bookingReference,

            source,

            destination,

            booking_id: insertedBooking.id,
          }),
          {
            status: 200,

            headers: {
              'Content-Type': 'application/json; charset=utf-8',

              'Cache-Control': 'no-store',
            },
          },
        );
      }

      // =======================================================
      // DUPLICATE BOOKING
      // =======================================================

      console.log('Booking already exists. Skipping duplicate insert.');

      return new Response(
        JSON.stringify({
          success: true,

          status: 'success',

          already_exists: true,

          order_id: orderId,

          reference,

          booking_type: bookingTypeFromReference,

          booking_reference: bookingReference,

          source,

          destination,

          booking_id: existingBooking.id,
        }),
        {
          status: 200,

          headers: {
            'Content-Type': 'application/json; charset=utf-8',

            'Cache-Control': 'no-store',
          },
        },
      );
    }

    // =========================================================
    // FAILURE
    // =========================================================

    if (status === 'failure') {
      console.log('Duffel checkout failed.');

      return new Response(
        JSON.stringify({
          success: false,

          status: 'failure',

          order_id: orderId,

          reference,

          error: 'The booking could not be completed.',
        }),
        {
          status: 200,

          headers: {
            'Content-Type': 'application/json; charset=utf-8',

            'Cache-Control': 'no-store',
          },
        },
      );
    }

    // =========================================================
    // ABANDONED
    // =========================================================

    if (status === 'abandoned') {
      console.log('Duffel checkout abandoned.');

      return new Response(
        JSON.stringify({
          success: false,

          status: 'abandoned',

          order_id: orderId,

          reference,

          error: 'The checkout was cancelled.',
        }),
        {
          status: 200,

          headers: {
            'Content-Type': 'application/json; charset=utf-8',

            'Cache-Control': 'no-store',
          },
        },
      );
    }

    // =========================================================
    // UNKNOWN STATUS
    // =========================================================

    console.warn('Unknown Duffel callback status:', status);

    return new Response(
      JSON.stringify({
        success: false,

        status: status ?? 'unknown',

        order_id: orderId,

        reference,

        error: 'Unknown Duffel checkout status.',
      }),
      {
        status: 400,

        headers: {
          'Content-Type': 'application/json; charset=utf-8',

          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    // =========================================================
    // GLOBAL ERROR
    // =========================================================

    console.error('========== DUFFEL CHECKOUT CALLBACK ERROR ==========');

    console.error(error);

    return new Response(
      JSON.stringify({
        success: false,

        error:
          error instanceof Error
            ? error.message
            : 'Unable to finalize Duffel booking.',
      }),
      {
        status: 500,

        headers: {
          'Content-Type': 'application/json; charset=utf-8',

          'Cache-Control': 'no-store',
        },
      },
    );
  }
});
