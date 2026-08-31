const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DUFFEL_API_KEY = Deno.env.get('DUFFEL_API_KEY');

const DUFFEL_BASE_URL = 'https://api.duffel.com';

/**
 * -----------------------------------------
 * JSON response helper
 * -----------------------------------------
 */
const jsonResponse = (body: Record<string, unknown>, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
};

/**
 * -----------------------------------------
 * Edge Function
 * -----------------------------------------
 */
Deno.serve(async req => {
  /**
   * -----------------------------------------
   * CORS
   * -----------------------------------------
   */
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  /**
   * -----------------------------------------
   * Only POST
   * -----------------------------------------
   */
  if (req.method !== 'POST') {
    return jsonResponse(
      {
        success: false,
        error: 'Method not allowed.',
        code: 'METHOD_NOT_ALLOWED',
      },
      405,
    );
  }

  try {
    /**
     * -----------------------------------------
     * Check Duffel API key
     * -----------------------------------------
     */
    if (!DUFFEL_API_KEY) {
      console.error('DUFFEL_API_KEY is not configured.');

      return jsonResponse(
        {
          success: false,
          error: 'Duffel API key is not configured.',
          code: 'MISSING_DUFFEL_API_KEY',
        },
        500,
      );
    }

    /**
     * -----------------------------------------
     * Create Component Client Key
     * -----------------------------------------
     *
     * We intentionally create an UNSCOPED
     * component client key for this first test.
     *
     * Later we can scope it to the logged-in
     * Duffel Customer User.
     *
     * Duffel endpoint:
     *
     * POST /identity/component_client_keys
     */
    const duffelResponse = await fetch(
      `${DUFFEL_BASE_URL}/identity/component_client_keys`,
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${DUFFEL_API_KEY}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Duffel-Version': 'v2',
        },

        /**
         * IMPORTANT:
         *
         * Duffel accepts an empty JSON object
         * when no user/order/booking scope is
         * required.
         */
        body: JSON.stringify({}),
      },
    );

    /**
     * -----------------------------------------
     * Read response
     * -----------------------------------------
     */
    const responseText = await duffelResponse.text();

    console.log('DUFFEL CLIENT KEY STATUS:', duffelResponse.status);

    console.log('DUFFEL CLIENT KEY RAW RESPONSE:', responseText);

    /**
     * -----------------------------------------
     * Handle Duffel API error
     * -----------------------------------------
     */
    if (!duffelResponse.ok) {
      let errorMessage = 'Unable to create Duffel client key.';

      let errorDetails: unknown = null;

      try {
        const errorBody = JSON.parse(responseText);

        errorDetails = errorBody;

        errorMessage =
          errorBody?.errors?.[0]?.message ??
          errorBody?.error?.message ??
          errorBody?.message ??
          errorMessage;
      } catch {
        // Response wasn't valid JSON.
      }

      console.error(
        'DUFFEL CLIENT KEY API ERROR:',
        JSON.stringify({
          status: duffelResponse.status,
          response: errorDetails ?? responseText,
        }),
      );

      return jsonResponse(
        {
          success: false,
          error: errorMessage,
          code: 'DUFFEL_CLIENT_KEY_ERROR',
          duffelStatus: duffelResponse.status,
        },
        502,
      );
    }

    /**
     * -----------------------------------------
     * Parse successful response
     * -----------------------------------------
     */
    let duffelData: any;

    try {
      duffelData = JSON.parse(responseText);
    } catch {
      console.error('Invalid Duffel JSON response:', responseText);

      return jsonResponse(
        {
          success: false,
          error: 'Invalid response received from Duffel.',
          code: 'INVALID_DUFFEL_RESPONSE',
        },
        502,
      );
    }

    /**
     * -----------------------------------------
     * Extract component client key
     * -----------------------------------------
     */
    const clientKey = duffelData?.data?.component_client_key;

    if (!clientKey) {
      console.error(
        'component_client_key missing from Duffel response:',
        JSON.stringify(duffelData),
      );

      return jsonResponse(
        {
          success: false,
          error: 'Duffel did not return a component client key.',
          code: 'MISSING_COMPONENT_CLIENT_KEY',
        },
        502,
      );
    }

    /**
     * -----------------------------------------
     * Success
     * -----------------------------------------
     *
     * NEVER return DUFFEL_API_KEY.
     */
    return jsonResponse({
      success: true,
      clientKey,
    });
  } catch (error) {
    console.error('DUFFEL CLIENT KEY EXCEPTION:', error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create Duffel client key.',
        code: 'DUFFEL_CLIENT_KEY_EXCEPTION',
      },
      500,
    );
  }
});
