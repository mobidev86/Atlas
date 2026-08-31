import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async req => {
  console.log('========== ZOOM OAUTH FUNCTION HIT ==========');
  console.log('METHOD:', req.method);
  console.log('URL:', req.url);

  try {
    const url = new URL(req.url);

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('ZOOM OAUTH PARAMETERS:', {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error,
      error,
    });

    // --------------------------------------------------
    // OAuth provider error
    // --------------------------------------------------

    if (error) {
      console.error('ZOOM AUTHORIZATION ERROR:', error);

      return new Response(`Zoom authorization failed: ${error}`, {
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // --------------------------------------------------
    // Validate code/state
    // --------------------------------------------------

    if (!code || !state) {
      console.error('ZOOM OAUTH MISSING CODE OR STATE:', {
        hasCode: !!code,
        hasState: !!state,
      });

      return new Response('Missing authorization code or state.', {
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    console.log('ZOOM OAUTH CODE AND STATE RECEIVED');

    // --------------------------------------------------
    // Environment variables
    // --------------------------------------------------

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const zoomClientId = Deno.env.get('ZOOM_CLIENT_ID');
    const zoomClientSecret = Deno.env.get('ZOOM_CLIENT_SECRET');
    const zoomRedirectUri = Deno.env.get('ZOOM_REDIRECT_URI');

    console.log('ZOOM OAUTH ENVIRONMENT CHECK:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceRoleKey: !!supabaseServiceRoleKey,
      hasZoomClientId: !!zoomClientId,
      hasZoomClientSecret: !!zoomClientSecret,
      hasZoomRedirectUri: !!zoomRedirectUri,
      zoomRedirectUri,
    });

    if (
      !supabaseUrl ||
      !supabaseServiceRoleKey ||
      !zoomClientId ||
      !zoomClientSecret ||
      !zoomRedirectUri
    ) {
      throw new Error('Required environment variables are missing.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // --------------------------------------------------
    // 1. Validate OAuth state
    // --------------------------------------------------

    console.log('STEP 1: LOOKING UP OAUTH STATE');

    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('id, user_id, provider, state, expires_at')
      .eq('state', state)
      .eq('provider', 'zoom')
      .maybeSingle();

    if (stateError) {
      console.error('ZOOM OAUTH STATE LOOKUP ERROR:', stateError);

      throw new Error(`Unable to validate OAuth state: ${stateError.message}`);
    }

    console.log('ZOOM OAUTH STATE LOOKUP RESULT:', {
      found: !!oauthState,
      id: oauthState?.id,
      userId: oauthState?.user_id,
      provider: oauthState?.provider,
      expiresAt: oauthState?.expires_at,
    });

    if (!oauthState) {
      console.error('ZOOM OAUTH STATE NOT FOUND');

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

    console.log('STEP 2: CHECKING OAUTH STATE EXPIRATION');

    const expiresAtTimestamp = new Date(oauthState.expires_at).getTime();

    const currentTimestamp = Date.now();

    console.log('ZOOM OAUTH STATE EXPIRATION:', {
      expiresAt: oauthState.expires_at,
      expiresAtTimestamp,
      currentTimestamp,
      expired: expiresAtTimestamp < currentTimestamp,
    });

    if (expiresAtTimestamp < currentTimestamp) {
      console.log('ZOOM OAUTH STATE HAS EXPIRED');

      const { error: expiredStateDeleteError } = await supabase
        .from('oauth_states')
        .delete()
        .eq('id', oauthState.id);

      if (expiredStateDeleteError) {
        console.error(
          'ZOOM EXPIRED STATE DELETE ERROR:',
          expiredStateDeleteError,
        );
      }

      return new Response('OAuth session has expired. Please try again.', {
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    console.log('ZOOM OAUTH STATE IS VALID');

    // --------------------------------------------------
    // 3. Delete state immediately
    // --------------------------------------------------

    console.log('STEP 3: DELETING OAUTH STATE');

    const { error: deleteStateError } = await supabase
      .from('oauth_states')
      .delete()
      .eq('id', oauthState.id);

    if (deleteStateError) {
      console.error('ZOOM OAUTH STATE DELETE ERROR:', deleteStateError);

      throw new Error(
        `Unable to complete OAuth validation: ${deleteStateError.message}`,
      );
    }

    console.log('ZOOM OAUTH STATE DELETED SUCCESSFULLY');

    // --------------------------------------------------
    // 4. Exchange authorization code for tokens
    // --------------------------------------------------

    console.log('STEP 4: EXCHANGING ZOOM AUTHORIZATION CODE');

    const credentials = btoa(`${zoomClientId}:${zoomClientSecret}`);

    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: zoomRedirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    console.log('ZOOM TOKEN RESPONSE:', {
      ok: tokenResponse.ok,
      status: tokenResponse.status,
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
      error: tokenData.error,
      errorDescription: tokenData.error_description,
    });

    if (!tokenResponse.ok) {
      console.error('ZOOM TOKEN ERROR:', tokenData);

      throw new Error(
        tokenData.error_description ||
          tokenData.error ||
          'Zoom token exchange failed.',
      );
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;
    const scope = tokenData.scope;

    if (!accessToken) {
      throw new Error('Zoom did not return an access token.');
    }

    console.log('ZOOM TOKEN EXCHANGE SUCCESSFULLY COMPLETED');

    // --------------------------------------------------
    // 5. Get Zoom user identity
    // --------------------------------------------------

    console.log('STEP 5: FETCHING ZOOM USER INFORMATION');

    const userInfoResponse = await fetch('https://api.zoom.us/v2/users/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const zoomUser = await userInfoResponse.json();

    console.log('ZOOM USER INFO RESPONSE:', {
      ok: userInfoResponse.ok,
      status: userInfoResponse.status,
      id: zoomUser.id,
      email: zoomUser.email,
      firstName: zoomUser.first_name,
      lastName: zoomUser.last_name,
    });

    if (!userInfoResponse.ok) {
      console.error('ZOOM USER INFO ERROR:', zoomUser);

      throw new Error('Unable to retrieve Zoom account information.');
    }

    const zoomUserId = zoomUser.id;
    const zoomEmail = zoomUser.email;

    if (!zoomUserId || !zoomEmail) {
      throw new Error('Zoom account information is incomplete.');
    }

    console.log('ZOOM USER INFORMATION SUCCESSFULLY RETRIEVED:', {
      zoomUserId,
      zoomEmail,
    });

    // --------------------------------------------------
    // 6. Preserve existing refresh token if necessary
    // --------------------------------------------------

    console.log('STEP 6: CHECKING EXISTING ZOOM INTEGRATION');

    const { data: existingIntegration, error: existingIntegrationError } =
      await supabase
        .from('zoom_integrations')
        .select('refresh_token')
        .eq('user_id', oauthState.user_id)
        .maybeSingle();

    if (existingIntegrationError) {
      console.error(
        'EXISTING ZOOM INTEGRATION LOOKUP ERROR:',
        existingIntegrationError,
      );

      throw new Error(
        `Unable to check existing Zoom integration: ${existingIntegrationError.message}`,
      );
    }

    console.log('EXISTING ZOOM INTEGRATION:', {
      found: !!existingIntegration,
      hasRefreshToken: !!existingIntegration?.refresh_token,
    });

    const finalRefreshToken =
      refreshToken || existingIntegration?.refresh_token || null;

    const expiresAt = expiresIn
      ? new Date(Date.now() + Number(expiresIn) * 1000).toISOString()
      : null;

    const scopes = scope ? scope.split(' ') : [];

    console.log('ZOOM INTEGRATION DATA PREPARED:', {
      atlasUserId: oauthState.user_id,
      zoomUserId,
      zoomEmail,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!finalRefreshToken,
      expiresAt,
      scopes,
    });

    // --------------------------------------------------
    // 7. Store/update Zoom integration
    // --------------------------------------------------

    console.log('STEP 7: SAVING ZOOM INTEGRATION');

    const { data: savedIntegration, error: integrationError } = await supabase
      .from('zoom_integrations')
      .upsert(
        {
          user_id: oauthState.user_id,
          zoom_user_id: zoomUserId,
          zoom_email: zoomEmail,
          access_token: accessToken,
          refresh_token: finalRefreshToken,
          expires_at: expiresAt,
          scopes,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        },
      )
      .select()
      .single();

    if (integrationError) {
      console.error('ZOOM INTEGRATION SAVE ERROR:', integrationError);

      throw new Error(
        `Unable to save Zoom account: ${integrationError.message}`,
      );
    }

    console.log('ZOOM INTEGRATION SAVED:', JSON.stringify(savedIntegration));

    console.log(
      `Zoom account connected successfully for Atlas user: ${oauthState.user_id}`,
    );

    // --------------------------------------------------
    // 8. Return success HTML
    // --------------------------------------------------

    console.log('STEP 8: RETURNING SUCCESS RESPONSE');

    return new Response(
      `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Zoom Connected</title>
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />
          </head>

          <body>
            <h2>
              Zoom account connected successfully.
            </h2>

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
    console.error('========== ZOOM OAUTH CALLBACK ERROR ==========');

    console.error('ZOOM OAUTH CALLBACK ERROR:', error);

    return new Response(
      `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Zoom Connection Failed</title>
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />
          </head>

          <body>
            <h2>
              Unable to connect Zoom account.
            </h2>

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
