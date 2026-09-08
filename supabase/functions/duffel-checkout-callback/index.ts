// supabase/functions/duffel-checkout-callback/index.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

Deno.serve(async (req: Request) => {
  console.log('========== DUFFEL CHECKOUT CALLBACK HIT ==========');
  console.log('METHOD:', req.method);
  console.log('URL:', req.url);

  // =========================================================
  // 1. CORS
  // =========================================================

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    });
  }

  // =========================================================
  // 2. ALLOW GET / POST ONLY
  // =========================================================

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse(
      {
        success: false,
        error: 'Method not allowed',
      },
      405,
    );
  }

  try {
    // =======================================================
    // 3. READ DUFFEL CALLBACK PARAMETERS
    //
    // Duffel redirects to this function with parameters such as:
    //
    // ?status=success
    // &order_id=...
    // &reference=...
    //
    // =======================================================

    const url = new URL(req.url);

    const status = url.searchParams.get('status');
    const orderId = url.searchParams.get('order_id');
    const reference = url.searchParams.get('reference');

    console.log('Callback status:', status);
    console.log('Callback order_id:', orderId);
    console.log('Callback reference:', reference);

    // =======================================================
    // 4. HANDLE SUCCESS
    //
    // IMPORTANT:
    //
    // We DO NOT create user_bookings here.
    //
    // The Duffel webhook is responsible for creating the
    // database record when Duffel sends order.created.
    //
    // =======================================================

    if (status === 'success') {
      console.log('Duffel checkout completed successfully.');

      if (!orderId) {
        console.warn('Checkout reported success but no order_id was provided.');

        return jsonResponse(
          {
            success: false,
            status: 'success',
            error: 'Missing order_id',
            reference,
            message:
              'Checkout completed, but the Duffel order ID was not provided. The booking will be handled by the Duffel webhook if received.',
          },
          200,
        );
      }

      if (!reference) {
        console.warn(
          'Checkout reported success but no reference was provided.',
        );

        return jsonResponse(
          {
            success: false,
            status: 'success',
            error: 'Missing reference',
            order_id: orderId,
            message:
              'Checkout completed, but the Atlas reference was not provided. The booking will be handled by the Duffel webhook if received.',
          },
          200,
        );
      }

      console.log('Returning successful checkout response.');

      console.log('Database persistence is handled by duffel-webhook.');

      return jsonResponse({
        success: true,
        status: 'success',
        order_id: orderId,
        reference,
        message:
          'Duffel checkout completed successfully. Booking processing is handled by the Duffel webhook.',
      });
    }

    // =======================================================
    // 5. HANDLE FAILURE
    // =======================================================

    if (status === 'failure') {
      console.log('Duffel checkout failed.');

      return jsonResponse({
        success: false,
        status: 'failure',
        order_id: orderId,
        reference,
        message: 'Duffel checkout failed.',
      });
    }

    // =======================================================
    // 6. HANDLE ABANDONMENT
    // =======================================================

    if (status === 'abandoned') {
      console.log('Duffel checkout was abandoned.');

      return jsonResponse({
        success: false,
        status: 'abandoned',
        order_id: orderId,
        reference,
        message: 'Duffel checkout was abandoned.',
      });
    }

    // =======================================================
    // 7. UNKNOWN / MISSING STATUS
    // =======================================================

    console.warn('Unknown or missing Duffel checkout status:', status);

    return jsonResponse({
      success: false,
      status: status ?? 'unknown',
      order_id: orderId,
      reference,
      message:
        'Duffel checkout callback received an unknown or missing status.',
    });
  } catch (error) {
    // =======================================================
    // 8. ERROR HANDLING
    // =======================================================

    console.error('========== DUFFEL CHECKOUT CALLBACK ERROR ==========');

    console.error(error);

    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
