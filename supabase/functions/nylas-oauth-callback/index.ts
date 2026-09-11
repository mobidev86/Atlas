import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async req => {
  try {
    console.log('NYLAS CALLBACK FUNCTION INVOKED');
    const url = new URL(req.url);

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // --------------------------------------------------
    // 1. Handle Nylas authorization error
    // --------------------------------------------------

    if (error) {
      return new Response(
        `Nylas authorization failed: ${errorDescription || error}`,
        {
          status: 400,
          headers: {
            'Content-Type': 'text/plain',
          },
        },
      );
    }

    if (!code || !state) {
      return new Response('Missing authorization code or state.', {
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // --------------------------------------------------
    // 2. Environment variables
    // --------------------------------------------------

    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const nylasClientId = Deno.env.get('NYLAS_CLIENT_ID');

    const nylasClientSecret = Deno.env.get('NYLAS_CLIENT_SECRET');

    const nylasRedirectUri = Deno.env.get('NYLAS_REDIRECT_URI');

    if (
      !supabaseUrl ||
      !supabaseServiceRoleKey ||
      !nylasClientId ||
      !nylasClientSecret ||
      !nylasRedirectUri
    ) {
      throw new Error('Required environment variables are missing.');
    }

    // --------------------------------------------------
    // 3. Create Supabase admin client
    // --------------------------------------------------

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // --------------------------------------------------
    // 4. Validate OAuth state
    // --------------------------------------------------

    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('id, user_id, provider, state, expires_at')
      .eq('state', state)
      .eq('provider', 'nylas')
      .maybeSingle();

    if (stateError) {
      console.error('NYLAS OAUTH STATE LOOKUP ERROR:', stateError);

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
    // 5. Check state expiration
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
    // 6. Delete OAuth state immediately
    // --------------------------------------------------

    const { error: deleteStateError } = await supabase
      .from('oauth_states')
      .delete()
      .eq('id', oauthState.id);

    if (deleteStateError) {
      console.error('NYLAS OAUTH STATE DELETE ERROR:', deleteStateError);

      throw new Error('Unable to complete OAuth validation.');
    }

    // --------------------------------------------------
    // 7. Exchange Nylas authorization code
    //
    // Nylas Hosted OAuth expects JSON here.
    // NYLAS_CLIENT_SECRET must contain the
    // Nylas API key used for this application.
    // --------------------------------------------------

    const tokenResponse = await fetch(
      'https://api.us.nylas.com/v3/connect/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: nylasClientId,
          client_secret: nylasClientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: nylasRedirectUri,
        }),
      },
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('NYLAS TOKEN ERROR:', tokenData);

      throw new Error(
        tokenData.error_description ||
          tokenData.error ||
          'Nylas token exchange failed.',
      );
    }

    // --------------------------------------------------
    // 8. Extract Nylas grant information
    // --------------------------------------------------

    const grantId = tokenData.grant_id;
    const provider = tokenData.provider;
    const email = tokenData.email;

    const scopes = tokenData.scope ? tokenData.scope.split(' ') : [];

    if (!grantId) {
      console.error('NYLAS TOKEN RESPONSE:', tokenData);

      throw new Error('Nylas did not return a grant ID.');
    }

    // --------------------------------------------------
    // 9. Save Nylas integration
    // --------------------------------------------------

    const { error: integrationError } = await supabase
      .from('nylas_integrations')
      .upsert(
        {
          user_id: oauthState.user_id,
          grant_id: grantId,
          provider: provider || 'unknown',
          email: email || null,
          scopes,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        },
      );

    if (integrationError) {
      console.error('NYLAS INTEGRATION SAVE ERROR:', integrationError);

      throw new Error('Unable to save Nylas account.');
    }

    // --------------------------------------------------
    // 10. OAuth completed successfully
    // --------------------------------------------------

    console.log(
      `Nylas account connected successfully for Atlas user: ${oauthState.user_id}`,
    );

    // --------------------------------------------------
    // 11. Return success page
    //
    // Do not expose grant ID, tokens, or other
    // sensitive information to the browser/WebView.
    // --------------------------------------------------

    return new Response(
      `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Nylas Connected</title>

            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />

            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont,
                  "Segoe UI", sans-serif;
                padding: 40px 20px;
                text-align: center;
              }

              h2 {
                margin-bottom: 12px;
              }

              p {
                color: #666;
              }
            </style>
          </head>

          <body>
            <h2>Nylas account connected successfully.</h2>

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
    console.error('NYLAS OAUTH CALLBACK ERROR:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Please try again.';

    return new Response(
      `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Nylas Connection Failed</title>

            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />

            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont,
                  "Segoe UI", sans-serif;
                padding: 40px 20px;
                text-align: center;
              }

              h2 {
                margin-bottom: 12px;
              }

              p {
                color: #666;
                word-break: break-word;
              }
            </style>
          </head>

          <body>
            <h2>Unable to connect email account.</h2>

            <p>
              ${errorMessage}
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
