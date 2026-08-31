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

    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const googleRedirectUri = Deno.env.get('GOOGLE_REDIRECT_URI');

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !googleClientId ||
      !googleRedirectUri
    ) {
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
      provider: 'google',
      state,
      expires_at: expiresAt,
    });

    if (stateError) {
      console.error(
        'GOOGLE OAUTH STATE ERROR:',
        JSON.stringify(stateError, null, 2),
      );

      throw new Error(
        `Unable to initialize Google OAuth: ${stateError.message}`,
      );
    }

    // OAuth scopes.
    //
    // openid/email/profile are used to identify the
    // connected Google account.
    //
    // meetings.space.created will allow us to create
    // Google Meet spaces later using this user's account.
    const scopes = [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/meetings.space.created',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: googleRedirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    const authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    console.log(`Google OAuth started for Atlas user: ${user.id}`);

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
    console.error('GOOGLE OAUTH START ERROR:', error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unable to start Google OAuth.',
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
