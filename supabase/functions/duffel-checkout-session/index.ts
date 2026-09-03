import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DUFFEL_API_URL = 'https://api.duffel.com/links/sessions';

interface CheckoutSessionRequest {
  type: 'flight' | 'hotel';
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

Deno.serve(async (req: Request) => {
  // ---------------------------------------------------------
  // CORS
  // ---------------------------------------------------------
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
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

  try {
    // ---------------------------------------------------------
    // Environment variables
    // ---------------------------------------------------------
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const duffelApiKey = Deno.env.get('DUFFEL_API_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are not configured.');
    }

    if (!duffelApiKey) {
      throw new Error('DUFFEL_API_KEY is not configured.');
    }

    // ---------------------------------------------------------
    // Authenticate current Supabase user
    // ---------------------------------------------------------
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return jsonResponse(
        {
          success: false,
          error: 'Authorization header is required.',
        },
        401,
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Unable to authenticate user:', userError);

      return jsonResponse(
        {
          success: false,
          error: 'Unauthorized.',
        },
        401,
      );
    }

    // ---------------------------------------------------------
    // Parse request
    // ---------------------------------------------------------
    let body: CheckoutSessionRequest;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error: 'Invalid JSON request body.',
        },
        400,
      );
    }

    // ---------------------------------------------------------
    // Validate booking type
    // ---------------------------------------------------------
    if (body.type !== 'flight' && body.type !== 'hotel') {
      return jsonResponse(
        {
          success: false,
          error: 'type must be either "flight" or "hotel".',
        },
        400,
      );
    }

    const isFlight = body.type === 'flight';

    // ---------------------------------------------------------
    // Get user's profile
    //
    // Your profiles table uses full_name.
    // user_bookings requires "fullName".
    // ---------------------------------------------------------
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Failed to fetch profile:', profileError);

      return jsonResponse(
        {
          success: false,
          error: 'Unable to fetch user profile.',
          details: profileError.message,
        },
        500,
      );
    }

    const fullName =
      typeof profile?.full_name === 'string' ? profile.full_name.trim() : '';

    if (!fullName) {
      return jsonResponse(
        {
          success: false,
          error: 'Your profile does not contain a full name.',
        },
        400,
      );
    }

    // ---------------------------------------------------------
    // Generate the UUID that will become user_bookings.id
    //
    // We explicitly supply this UUID during INSERT so that
    // the same ID can be embedded in the Duffel reference.
    // ---------------------------------------------------------
    const bookingRecordId = crypto.randomUUID();

    // ---------------------------------------------------------
    // Temporary booking_id
    //
    // booking_id is NOT NULL in your schema.
    //
    // We initially use the internal Atlas booking ID.
    // Once Duffel creates the Links session, this field is
    // updated to the actual Duffel session ID.
    // ---------------------------------------------------------
    const temporaryBookingId = `ATLAS_${body.type.toUpperCase()}_${bookingRecordId}`;

    // ---------------------------------------------------------
    // Create initial processing booking
    // ---------------------------------------------------------
    const { data: bookingRecord, error: bookingInsertError } = await supabase
      .from('user_bookings')
      .insert({
        id: bookingRecordId,
        user_id: user.id,
        booking_type: body.type,
        booking_id: temporaryBookingId,
        status: 'processing',
        fullName: fullName,
      })
      .select()
      .single();

    if (bookingInsertError || !bookingRecord) {
      console.error(
        'Failed to create user_bookings record:',
        bookingInsertError,
      );

      return jsonResponse(
        {
          success: false,
          error: 'Unable to create booking record.',
          details: bookingInsertError?.message ?? 'Unknown database error.',
        },
        500,
      );
    }

    // ---------------------------------------------------------
    // Build Atlas reference
    //
    // This UUID is now guaranteed to exist in
    // user_bookings.id.
    // ---------------------------------------------------------
    const reference = `ATLAS_${body.type.toUpperCase()}_${user.id}_${
      bookingRecord.id
    }`;

    // ---------------------------------------------------------
    // Checkout callback URLs
    // ---------------------------------------------------------
    const successUrl =
      `${supabaseUrl}/functions/v1/duffel-checkout-callback` +
      `?status=success`;

    const failureUrl =
      `${supabaseUrl}/functions/v1/duffel-checkout-callback` +
      `?status=failure`;

    const abandonmentUrl =
      `${supabaseUrl}/functions/v1/duffel-checkout-callback` +
      `?status=abandoned`;

    // ---------------------------------------------------------
    // Configure Duffel Links
    // ---------------------------------------------------------
    const duffelPayload = {
      data: {
        reference,

        success_url: successUrl,
        failure_url: failureUrl,
        abandonment_url: abandonmentUrl,

        // 12% Atlas markup
        markup_rate: '0.12',

        flights: {
          enabled: isFlight,
        },

        stays: {
          enabled: !isFlight,
        },
      },
    };

    console.log('Creating Duffel checkout session:', {
      user_id: user.id,
      booking_record_id: bookingRecord.id,
      type: body.type,
      reference,
    });

    // ---------------------------------------------------------
    // Create Duffel Links session
    // ---------------------------------------------------------
    const duffelResponse = await fetch(DUFFEL_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'Content-Type': 'application/json',
        'Duffel-Version': 'v2',
        Authorization: `Bearer ${duffelApiKey}`,
      },
      body: JSON.stringify(duffelPayload),
    });

    const duffelResponseText = await duffelResponse.text();

    let duffelResponseData: any;

    try {
      duffelResponseData = JSON.parse(duffelResponseText);
    } catch {
      duffelResponseData = null;
    }

    // ---------------------------------------------------------
    // Handle Duffel error
    // ---------------------------------------------------------
    if (!duffelResponse.ok) {
      console.error('Duffel Links API error:', {
        status: duffelResponse.status,
        response: duffelResponseData ?? duffelResponseText,
        booking_record_id: bookingRecord.id,
        reference,
      });

      // Mark our booking as failed because the
      // checkout session itself could not be created.
      await supabase
        .from('user_bookings')
        .update({
          status: 'failure',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingRecord.id);

      return jsonResponse(
        {
          success: false,
          error: 'Unable to create Duffel checkout session.',
          details: duffelResponseData,
        },
        502,
      );
    }

    // ---------------------------------------------------------
    // Extract Duffel session
    // ---------------------------------------------------------
    const session = duffelResponseData?.data;

    if (!session) {
      console.error(
        'Duffel response did not contain session data:',
        duffelResponseData,
      );

      await supabase
        .from('user_bookings')
        .update({
          status: 'failure',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingRecord.id);

      return jsonResponse(
        {
          success: false,
          error: 'Duffel returned an invalid session response.',
        },
        502,
      );
    }

    // ---------------------------------------------------------
    // Extract hosted checkout URL
    // ---------------------------------------------------------
    const checkoutUrl = session.url ?? session.link ?? session.href;

    if (!checkoutUrl) {
      console.error('Duffel session did not contain a hosted URL:', session);

      await supabase
        .from('user_bookings')
        .update({
          status: 'failure',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingRecord.id);

      return jsonResponse(
        {
          success: false,
          error: 'Duffel session was created but no hosted URL was returned.',
        },
        502,
      );
    }

    // ---------------------------------------------------------
    // Get actual Duffel session ID
    // ---------------------------------------------------------
    const duffelSessionId = typeof session.id === 'string' ? session.id : null;

    if (!duffelSessionId) {
      console.error('Duffel session did not contain an ID:', session);

      await supabase
        .from('user_bookings')
        .update({
          status: 'failure',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingRecord.id);

      return jsonResponse(
        {
          success: false,
          error: 'Duffel session was created but no session ID was returned.',
        },
        502,
      );
    }

    // ---------------------------------------------------------
    // Update booking_id with actual Duffel session ID
    // ---------------------------------------------------------
    const { error: bookingUpdateError } = await supabase
      .from('user_bookings')
      .update({
        booking_id: duffelSessionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingRecord.id);

    if (bookingUpdateError) {
      console.error(
        'Failed to update booking with Duffel session ID:',
        bookingUpdateError,
      );

      /*
       * We deliberately mark the booking as failure here.
       *
       * The Duffel session exists, but Atlas was unable to
       * persist its session ID.
       */
      await supabase
        .from('user_bookings')
        .update({
          status: 'failure',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingRecord.id);

      return jsonResponse(
        {
          success: false,
          error:
            'Duffel session was created but the booking record could not be updated.',
        },
        500,
      );
    }

    // ---------------------------------------------------------
    // Final response to the mobile app
    // ---------------------------------------------------------
    console.log('Duffel checkout session created successfully:', {
      user_id: user.id,
      booking_record_id: bookingRecord.id,
      duffel_session_id: duffelSessionId,
      reference,
      type: body.type,
    });

    return jsonResponse({
      success: true,
      type: body.type,

      // Duffel Links session ID
      session_id: duffelSessionId,

      // Atlas booking row ID
      booking_id: bookingRecord.id,

      // Reference passed to Duffel
      reference,

      // Hosted checkout URL
      url: checkoutUrl,
    });
  } catch (error) {
    console.error('duffel-checkout-session error:', error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unexpected server error.',
      },
      500,
    );
  }
});
