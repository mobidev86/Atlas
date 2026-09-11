import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    const nylasClientId = Deno.env.get('NYLAS_CLIENT_ID');
    const nylasRedirectUri = Deno.env.get('NYLAS_REDIRECT_URI');

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !nylasClientId ||
      !nylasRedirectUri
    ) {
      throw new Error('Required environment variables are missing.');
    }

    // --------------------------------------------------
    // 1. Get authenticated Atlas user
    // --------------------------------------------------

    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({
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

    // --------------------------------------------------
    // 2. Generate secure OAuth state
    // --------------------------------------------------

    const stateBytes = new Uint8Array(32);

    crypto.getRandomValues(stateBytes);

    const state = Array.from(stateBytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // --------------------------------------------------
    // 3. Store OAuth state
    // --------------------------------------------------

    const { error: stateError } = await supabase.from('oauth_states').insert({
      user_id: user.id,
      provider: 'nylas',
      state,
      expires_at: expiresAt,
    });

    if (stateError) {
      console.error(
        'NYLAS OAUTH STATE ERROR:',
        JSON.stringify(stateError, null, 2),
      );

      throw new Error(
        `Unable to initialize Nylas OAuth: ${stateError.message}`,
      );
    }

    // --------------------------------------------------
    // 4. Build Nylas OAuth URL
    // --------------------------------------------------

    const params = new URLSearchParams({
      client_id: nylasClientId,
      redirect_uri: nylasRedirectUri,
      response_type: 'code',
      provider: 'google',
      access_type: 'offline',
      state,
    });

    const authorizationUrl = `https://api.us.nylas.com/v3/connect/auth?${params.toString()}`;

    console.log(`Nylas OAuth started for Atlas user: ${user.id}`);

    return new Response(
      JSON.stringify({
        authorizationUrl,
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
    console.error('NYLAS OAUTH START ERROR:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to start Nylas OAuth.',
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
