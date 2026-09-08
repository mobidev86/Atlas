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

    console.log('Authenticated user:', user.id);

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
    // Build a reference for the Duffel session.
    //
    // IMPORTANT:
    //
    // We are NOT creating a user_bookings record here.
    //
    // The actual booking/order does not exist yet.
    //
    // The reference contains the authenticated Atlas user ID
    // and a unique request ID. The webhook will use this
    // reference when the actual Duffel order is created.
    // ---------------------------------------------------------
    const requestId = crypto.randomUUID();

    const reference = `ATLAS_${body.type.toUpperCase()}_${
      user.id
    }_${requestId}`;

    console.log('Duffel checkout reference:', reference);

    // ---------------------------------------------------------
    // Checkout callback URLs
    // ---------------------------------------------------------
    //
    // These URLs are ONLY for redirecting the hosted checkout
    // back to Atlas.
    //
    // The callback does NOT become the source of truth for
    // booking creation.
    //
    // The Duffel webhook will handle the actual booking.
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
    //
    // 12% Atlas markup.
    //
    // Flights are enabled for flight checkout.
    // Stays are enabled for hotel checkout.
    // ---------------------------------------------------------

    const duffelPayload = {
      data: {
        reference,

        success_url: successUrl,

        failure_url: failureUrl,

        abandonment_url: abandonmentUrl,

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

        reference,
      });

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

      return jsonResponse(
        {
          success: false,

          error: 'Duffel session was created but no hosted URL was returned.',
        },
        502,
      );
    }

    // ---------------------------------------------------------
    // IMPORTANT
    // ---------------------------------------------------------
    //
    // We intentionally DO NOT:
    //
    // - create a user_bookings row
    // - generate a booking database ID
    // - store a Duffel session ID as booking_id
    // - mark anything as processing
    //
    // At this point there is no Duffel order yet.
    //
    // The actual booking record will be created by the
    // webhook after Duffel creates the real order.
    // ---------------------------------------------------------

    console.log('Duffel checkout session created successfully:', {
      user_id: user.id,

      type: body.type,

      reference,

      session_id: typeof session.id === 'string' ? session.id : null,
    });

    // ---------------------------------------------------------
    // Return checkout information to the mobile app
    // ---------------------------------------------------------

    return jsonResponse({
      success: true,

      type: body.type,

      // Hosted Duffel checkout URL
      url: checkoutUrl,

      // Keep this available for debugging / tracking,
      // but this is NOT the booking_id.
      session_id: typeof session.id === 'string' ? session.id : null,

      // Atlas reference used to associate the eventual
      // Duffel order with the authenticated user.
      reference,
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
