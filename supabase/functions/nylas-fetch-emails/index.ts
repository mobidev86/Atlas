import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const NYLAS_BASE_URL = 'https://api.us.nylas.com';
const EMAIL_LIMIT = 20;

Deno.serve(async req => {
  // --------------------------------------------------
  // 1. Handle CORS preflight
  // --------------------------------------------------

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    // --------------------------------------------------
    // 2. Only allow POST
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 3. Environment variables
    // --------------------------------------------------

    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    // Your existing setup uses NYLAS_CLIENT_SECRET
    // as the Nylas API key.
    const nylasApiKey = Deno.env.get('NYLAS_CLIENT_SECRET');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are missing.');
    }

    if (!nylasApiKey) {
      throw new Error('NYLAS_CLIENT_SECRET is not configured.');
    }

    // --------------------------------------------------
    // 4. Get user's Supabase JWT
    // --------------------------------------------------

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

    // --------------------------------------------------
    // 5. Create Supabase client using user's JWT
    // --------------------------------------------------

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // --------------------------------------------------
    // 6. Verify authenticated user
    // --------------------------------------------------

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('AUTHENTICATION ERROR:', userError);

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

    console.log('Fetching Nylas emails for user:', user.id);

    // --------------------------------------------------
    // 7. Get existing Nylas integration
    // --------------------------------------------------

    const { data: integration, error: integrationError } = await supabase
      .from('nylas_integrations')
      .select('grant_id, provider, email')
      .eq('user_id', user.id)
      .maybeSingle();

    if (integrationError) {
      console.error('NYLAS INTEGRATION LOOKUP ERROR:', integrationError);

      throw new Error('Unable to retrieve Nylas integration.');
    }

    if (!integration) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Nylas account is not connected.',
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    const grantId = integration.grant_id;

    if (!grantId) {
      throw new Error('Nylas grant ID is missing.');
    }

    console.log('Nylas grant found:', grantId);

    // --------------------------------------------------
    // 8. Fetch latest 20 messages
    // --------------------------------------------------
    //
    // We intentionally do NOT fetch the entire mailbox.
    //
    // Nylas returns messages in reverse chronological order,
    // so limit=20 gives us the latest 20 messages.
    //
    // We are NOT using `in=inbox` here because Nylas expects
    // an actual folder ID for that filter.
    // --------------------------------------------------

    const nylasUrl = new URL(
      `${NYLAS_BASE_URL}/v3/grants/${encodeURIComponent(grantId)}/messages`,
    );

    nylasUrl.searchParams.set('limit', EMAIL_LIMIT.toString());

    const nylasResponse = await fetch(nylasUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${nylasApiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });

    const nylasData = await nylasResponse.json();

    // --------------------------------------------------
    // 9. Handle Nylas API error
    // --------------------------------------------------

    if (!nylasResponse.ok) {
      console.error('NYLAS API ERROR:', nylasData);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unable to fetch emails from Nylas.',
          details: nylasData?.message || nylasData?.error || nylasData,
        }),
        {
          status: nylasResponse.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // --------------------------------------------------
    // 10. Extract messages
    // --------------------------------------------------

    const messages = Array.isArray(nylasData?.data) ? nylasData.data : [];

    // --------------------------------------------------
    // 11. Return only fields needed by Atlas
    // --------------------------------------------------

    const emails = messages.map((message: any) => {
      const sender = Array.isArray(message.from) ? message.from[0] : null;

      return {
        id: message.id ?? null,

        threadId: message.thread_id ?? null,

        subject: message.subject ?? '',

        from: {
          name: sender?.name ?? '',
          email: sender?.email ?? '',
        },

        snippet: message.snippet ?? '',

        receivedAt: message.date
          ? new Date(message.date * 1000).toISOString()
          : null,

        unread: message.unread === true,
      };
    });

    // --------------------------------------------------
    // 12. Return response
    // --------------------------------------------------

    return new Response(
      JSON.stringify({
        success: true,
        count: emails.length,
        emails,
        nextCursor: nylasData?.next_cursor ?? null,
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
    console.error('NYLAS FETCH EMAILS ERROR:', error);

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
