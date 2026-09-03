import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async req => {
  console.log('========== DUFFEL CHECKOUT CALLBACK HIT ==========');
  console.log('METHOD:', req.method);
  console.log('URL:', req.url);

  // =========================================================
  // CORS
  // =========================================================

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // =======================================================
    // 1. READ CALLBACK PARAMETERS
    // =======================================================

    const url = new URL(req.url);

    const status = url.searchParams.get('status');
    const orderId = url.searchParams.get('order_id');
    const reference = url.searchParams.get('reference');

    console.log('Callback status:', status);
    console.log('Callback order_id:', orderId);
    console.log('Callback reference:', reference);

    // =======================================================
    // 2. HANDLE NON-SUCCESS CALLBACKS
    // =======================================================

    if (status !== 'success') {
      console.log('Checkout did not complete successfully.', 'status:', status);

      return new Response(
        JSON.stringify({
          success: false,
          status,
          message: 'Duffel checkout was not completed successfully.',
        }),
        {
          status: 200,
          headers: corsHeaders,
        },
      );
    }

    // =======================================================
    // 3. VALIDATE REQUIRED PARAMETERS
    // =======================================================

    if (!orderId) {
      console.error('Missing order_id');

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing order_id',
        }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    if (!reference) {
      console.error('Missing reference');

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing reference',
        }),
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    // =======================================================
    // 4. PARSE ATLAS REFERENCE
    //
    // Expected:
    //
    // ATLAS_FLIGHT_<user_id>_<uuid>
    // ATLAS_HOTEL_<user_id>_<uuid>
    //
    // =======================================================

    let bookingType: 'flight' | 'hotel';
    let userId: string;

    if (reference.startsWith('ATLAS_FLIGHT_')) {
      bookingType = 'flight';

      const remainder = reference.substring('ATLAS_FLIGHT_'.length);

      const separatorIndex = remainder.indexOf('_');

      if (separatorIndex === -1) {
        throw new Error('Invalid ATLAS_FLIGHT reference format.');
      }

      userId = remainder.substring(0, separatorIndex);
    } else if (reference.startsWith('ATLAS_HOTEL_')) {
      bookingType = 'hotel';

      const remainder = reference.substring('ATLAS_HOTEL_'.length);

      const separatorIndex = remainder.indexOf('_');

      if (separatorIndex === -1) {
        throw new Error('Invalid ATLAS_HOTEL reference format.');
      }

      userId = remainder.substring(0, separatorIndex);
    } else {
      throw new Error(`Unknown booking reference format: ${reference}`);
    }

    console.log('Booking type:', bookingType);
    console.log('User ID:', userId);

    // =======================================================
    // 5. GET SUPABASE CONFIGURATION
    // =======================================================

    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL is not configured.');
    }

    const supabaseSecretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS');

    if (!supabaseSecretKeysRaw) {
      throw new Error('SUPABASE_SECRET_KEYS is not configured.');
    }

    let supabaseSecretKey: string | null = null;

    try {
      const parsed = JSON.parse(supabaseSecretKeysRaw);

      supabaseSecretKey =
        parsed?.default ?? parsed?.service_role ?? parsed?.serviceRole ?? null;
    } catch (error) {
      console.error('Failed to parse SUPABASE_SECRET_KEYS:', error);
    }

    if (!supabaseSecretKey) {
      throw new Error('Unable to resolve Supabase secret key.');
    }

    // =======================================================
    // 6. CREATE ADMIN SUPABASE CLIENT
    // =======================================================

    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // =======================================================
    // 7. FETCH USER PROFILE
    // =======================================================

    console.log('Fetching profile:', userId);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Failed to fetch profile:', profileError);

      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }

    if (!profile) {
      throw new Error(`No profile found for user ${userId}`);
    }

    const fullName = profile.full_name;

    console.log('Profile full name:', fullName);

    // =======================================================
    // 8. CHECK WHETHER THIS ORDER ALREADY EXISTS
    // =======================================================

    console.log('Checking existing user_bookings row:', orderId);

    const { data: existingBooking, error: existingError } = await supabaseAdmin
      .from('user_bookings')
      .select('*')
      .eq('booking_id', orderId)
      .maybeSingle();

    if (existingError) {
      console.error('Failed checking existing booking:', existingError);

      throw new Error(
        `Failed checking existing booking: ${existingError.message}`,
      );
    }

    let userBooking = existingBooking;

    // =======================================================
    // 9. CREATE INITIAL BOOKING ROW IF NEEDED
    //
    // At this point we intentionally do NOT know the Duffel
    // booking reference / PNR yet.
    //
    // duffel-flight-booking will retrieve it and update
    // this SAME row.
    // =======================================================

    if (!existingBooking) {
      console.log('Creating initial user_bookings row...');

      const { data: insertedBooking, error: insertError } = await supabaseAdmin
        .from('user_bookings')
        .insert({
          user_id: userId,
          booking_type: bookingType,
          booking_id: orderId,
          booking_reference: null,
          status: 'processing',
          fullName,
        })
        .select('*')
        .single();

      if (insertError) {
        console.error('Failed to create user_booking:', insertError);

        throw new Error(
          `Failed to create user_booking: ${insertError.message}`,
        );
      }

      userBooking = insertedBooking;

      console.log('Initial user_booking created:', userBooking);
    } else {
      console.log('user_booking already exists:', existingBooking);
    }

    // =======================================================
    // 10. FLIGHT BOOKING
    //
    // Call duffel-flight-booking SERVER-TO-SERVER.
    //
    // IMPORTANT:
    // The callback passes:
    //
    // {
    //   order_id,
    //   user_id
    // }
    //
    // duffel-flight-booking will:
    //   - retrieve the Duffel order
    //   - extract booking details
    //   - update the SAME user_bookings row
    // =======================================================

    if (bookingType === 'flight') {
      console.log('Calling duffel-flight-booking...');

      const flightBookingUrl = `${supabaseUrl}/functions/v1/duffel-flight-booking`;

      const flightBookingResponse = await fetch(flightBookingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',

          // Authenticate the internal Edge Function call.
          Authorization: `Bearer ${supabaseSecretKey}`,
          apikey: supabaseSecretKey,
        },
        body: JSON.stringify({
          order_id: orderId,
          user_id: userId,
        }),
      });

      const flightBookingText = await flightBookingResponse.text();

      let flightBookingData: any = null;

      try {
        flightBookingData = JSON.parse(flightBookingText);
      } catch {
        flightBookingData = {
          raw: flightBookingText,
        };
      }

      console.log(
        'duffel-flight-booking HTTP status:',
        flightBookingResponse.status,
      );

      console.log('duffel-flight-booking response:', flightBookingData);

      // =====================================================
      // 11. HANDLE DOWNSTREAM BOOKING FAILURE
      // =====================================================

      if (!flightBookingResponse.ok) {
        console.error(
          'duffel-flight-booking returned HTTP error:',
          flightBookingResponse.status,
          flightBookingData,
        );

        return new Response(
          JSON.stringify({
            success: false,
            status: 'processing',
            message:
              'Checkout succeeded, but booking details could not be processed yet.',
            order_id: orderId,
            user_id: userId,
            user_booking: userBooking,
            booking_error: flightBookingData,
          }),
          {
            status: 200,
            headers: corsHeaders,
          },
        );
      }

      if (!flightBookingData?.success) {
        console.error(
          'duffel-flight-booking reported failure:',
          flightBookingData,
        );

        return new Response(
          JSON.stringify({
            success: false,
            status: 'processing',
            message:
              'Checkout succeeded, but booking details could not be processed yet.',
            order_id: orderId,
            user_id: userId,
            user_booking: userBooking,
            booking_error: flightBookingData,
          }),
          {
            status: 200,
            headers: corsHeaders,
          },
        );
      }

      // =====================================================
      // 12. SUCCESS
      // =====================================================

      console.log('duffel-flight-booking completed successfully.');

      return new Response(
        JSON.stringify({
          success: true,
          status: 'success',
          message: 'Checkout and booking processing completed successfully.',
          order_id: orderId,
          user_id: userId,
          booking: flightBookingData.booking ?? null,
          user_booking: flightBookingData.user_booking ?? userBooking,
        }),
        {
          status: 200,
          headers: corsHeaders,
        },
      );
    }

    // =======================================================
    // 13. HOTEL
    //
    // For now we only connect the flight flow.
    // The hotel flow remains at processing until we create
    // the corresponding hotel-booking function.
    // =======================================================

    console.log(
      'Hotel booking detected. No hotel booking processor connected yet.',
    );

    return new Response(
      JSON.stringify({
        success: true,
        status: 'processing',
        message:
          'Hotel checkout completed and initial booking record was created.',
        order_id: orderId,
        user_id: userId,
        booking_type: bookingType,
        user_booking: userBooking,
      }),
      {
        status: 200,
        headers: corsHeaders,
      },
    );
  } catch (error) {
    console.error('========== DUFFEL CHECKOUT CALLBACK ERROR ==========');
    console.error(error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});
