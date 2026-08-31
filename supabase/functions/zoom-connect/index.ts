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

    const zoomClientId = Deno.env.get('ZOOM_CLIENT_ID');
    const zoomRedirectUri = Deno.env.get('ZOOM_REDIRECT_URI');

    if (!supabaseUrl || !supabaseAnonKey || !zoomClientId || !zoomRedirectUri) {
      throw new Error('Required environment variables are missing.');
    }

    // Get the authenticated Atlas user's access token.
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

    // Create a Supabase client that acts on behalf of
    // the currently authenticated Atlas user.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify the Atlas user.
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

    // Generate a cryptographically secure OAuth state.
    const stateBytes = new Uint8Array(32);
    crypto.getRandomValues(stateBytes);

    const state = Array.from(stateBytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');

    // State is valid for 10 minutes.
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Store the state against the authenticated Atlas user.
    const { error: stateError } = await supabase.from('oauth_states').insert({
      user_id: user.id,
      provider: 'zoom',
      state,
      expires_at: expiresAt,
    });

    if (stateError) {
      console.error(
        'ZOOM OAUTH STATE ERROR:',
        JSON.stringify(stateError, null, 2),
      );

      throw new Error(`Unable to initialize Zoom OAuth: ${stateError.message}`);
    }

    // Zoom OAuth scopes.
    //
    // user:read:user allows us to retrieve the
    // authenticated Zoom user's account information.
    //
    // openid and email allow us to identify the
    // connected Zoom account.
    const scopes = ['user:read:user', 'openid', 'email'].join(' ');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: zoomClientId,
      redirect_uri: zoomRedirectUri,
      state,
    });

    const authorizationUrl = `https://zoom.us/oauth/authorize?${params.toString()}`;

    console.log(`Zoom OAuth started for Atlas user: ${user.id}`);

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
    console.error('ZOOM OAUTH START ERROR:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to start Zoom OAuth.',
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
