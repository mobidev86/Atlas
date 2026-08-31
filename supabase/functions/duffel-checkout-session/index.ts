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
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Method not allowed',
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
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
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Authorization header is required.',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
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
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized.',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // ---------------------------------------------------------
    // Parse request
    // ---------------------------------------------------------
    let body: CheckoutSessionRequest;

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
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // ---------------------------------------------------------
    // Validate booking type
    // ---------------------------------------------------------
    if (body.type !== 'flight' && body.type !== 'hotel') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'type must be either "flight" or "hotel".',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // ---------------------------------------------------------
    // Generate a unique reference for this Atlas session
    // ---------------------------------------------------------
    const reference = `ATLAS_${body.type.toUpperCase()}_${
      user.id
    }_${crypto.randomUUID()}`;

    // ---------------------------------------------------------
    // URLs
    //
    // These should eventually point to your actual Atlas
    // success/failure/abandonment handling endpoints or
    // deep-link/web URLs.
    // ---------------------------------------------------------

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL is not configured.');
    }

    const successUrl = `${supabaseUrl}/functions/v1/duffel-checkout-callback?status=success`;

    const failureUrl = `${supabaseUrl}/functions/v1/duffel-checkout-callback?status=failure`;

    const abandonmentUrl = `${supabaseUrl}/functions/v1/duffel-checkout-callback?status=abandoned`;

    // ---------------------------------------------------------
    // Configure Duffel Links
    // ---------------------------------------------------------
    const isFlight = body.type === 'flight';

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
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unable to create Duffel checkout session.',
          details: duffelResponseData,
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
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

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Duffel returned an invalid session response.',
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // Duffel's Links response contains the hosted link.
    const checkoutUrl = session.url ?? session.link ?? session.href;

    if (!checkoutUrl) {
      console.error('Duffel session did not contain a hosted URL:', session);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Duffel session was created but no hosted URL was returned.',
          session,
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // ---------------------------------------------------------
    // Return only what the app needs
    // ---------------------------------------------------------
    return new Response(
      JSON.stringify({
        success: true,
        type: body.type,
        session_id: session.id ?? null,
        reference,
        url: checkoutUrl,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('duffel-checkout-session error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : 'Unexpected server error.',
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
