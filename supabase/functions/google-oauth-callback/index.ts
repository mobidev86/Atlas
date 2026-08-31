import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async req => {
  try {
    const url = new URL(req.url);

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      return new Response(`Google authorization failed: ${error}`, {
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    if (!code || !state) {
      return new Response('Missing authorization code or state.', {
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');

    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    const googleRedirectUri = Deno.env.get('GOOGLE_REDIRECT_URI');

    if (
      !supabaseUrl ||
      !supabaseServiceRoleKey ||
      !googleClientId ||
      !googleClientSecret ||
      !googleRedirectUri
    ) {
      throw new Error('Required environment variables are missing.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // --------------------------------------------------
    // 1. Validate OAuth state
    // --------------------------------------------------

    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('id, user_id, provider, state, expires_at')
      .eq('state', state)
      .eq('provider', 'google')
      .maybeSingle();

    if (stateError) {
      console.error('OAUTH STATE LOOKUP ERROR:', stateError);

      throw new Error('Unable to validate OAuth state.');
    }

    if (!oauthState) {
      return new Response('Invalid OAuth state.', {
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // --------------------------------------------------
    // 2. Check state expiration
    // --------------------------------------------------

    if (new Date(oauthState.expires_at).getTime() < Date.now()) {
      await supabase.from('oauth_states').delete().eq('id', oauthState.id);

      return new Response('OAuth session has expired. Please try again.', {
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // --------------------------------------------------
    // 3. Delete state immediately
    // --------------------------------------------------

    const { error: deleteStateError } = await supabase
      .from('oauth_states')
      .delete()
      .eq('id', oauthState.id);

    if (deleteStateError) {
      console.error('OAUTH STATE DELETE ERROR:', deleteStateError);

      throw new Error('Unable to complete OAuth validation.');
    }

    // --------------------------------------------------
    // 4. Exchange authorization code for tokens
    // --------------------------------------------------

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: googleRedirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('GOOGLE TOKEN ERROR:', tokenData);

      throw new Error(
        tokenData.error_description ||
          tokenData.error ||
          'Google token exchange failed.',
      );
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;
    const scope = tokenData.scope;

    if (!accessToken) {
      throw new Error('Google did not return an access token.');
    }

    // --------------------------------------------------
    // 5. Get Google user identity
    // --------------------------------------------------

    const userInfoResponse = await fetch(
      'https://openidconnect.googleapis.com/v1/userinfo',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const googleUser = await userInfoResponse.json();

    if (!userInfoResponse.ok) {
      console.error('GOOGLE USER INFO ERROR:', googleUser);

      throw new Error('Unable to retrieve Google account information.');
    }

    const googleUserId = googleUser.sub;
    const googleEmail = googleUser.email;

    if (!googleUserId || !googleEmail) {
      throw new Error('Google account information is incomplete.');
    }

    // --------------------------------------------------
    // 6. Store/update user's Google integration
    // --------------------------------------------------

    /*
     * Google may not return a new refresh_token when the
     * user reconnects an already-authorized application.
     *
     * Therefore, if no refresh token is returned, preserve
     * the existing one.
     */

    const { data: existingIntegration } = await supabase
      .from('google_integrations')
      .select('refresh_token')
      .eq('user_id', oauthState.user_id)
      .maybeSingle();

    const finalRefreshToken =
      refreshToken || existingIntegration?.refresh_token || null;

    const expiresAt = expiresIn
      ? new Date(Date.now() + Number(expiresIn) * 1000).toISOString()
      : null;

    const scopes = scope ? scope.split(' ') : [];

    const { error: integrationError } = await supabase
      .from('google_integrations')
      .upsert(
        {
          user_id: oauthState.user_id,
          google_user_id: googleUserId,
          google_email: googleEmail,
          access_token: accessToken,
          refresh_token: finalRefreshToken,
          expires_at: expiresAt,
          scopes,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        },
      );

    if (integrationError) {
      console.error('GOOGLE INTEGRATION SAVE ERROR:', integrationError);

      throw new Error('Unable to save Google account.');
    }

    console.log(
      `Google account connected successfully for Atlas user: ${oauthState.user_id}`,
    );

    // --------------------------------------------------
    // 7. Do NOT return OAuth tokens to the mobile app
    // --------------------------------------------------

    return new Response(
      `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Google Connected</title>
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />
          </head>

          <body>
            <h2>Google account connected successfully.</h2>
            <p>
              You can close this window and return to Atlas.
            </p>
          </body>
        </html>
      `,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      },
    );
  } catch (error) {
    console.error('GOOGLE OAUTH CALLBACK ERROR:', error);

    return new Response(
      `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Google Connection Failed</title>
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />
          </head>

          <body>
            <h2>Unable to connect Google account.</h2>
            <p>
              ${error instanceof Error ? error.message : 'Please try again.'}
            </p>
          </body>
        </html>
      `,
      {
        status: 500,
        headers: {
          'Content-Type': 'text/html',
        },
      },
    );
  }
});
