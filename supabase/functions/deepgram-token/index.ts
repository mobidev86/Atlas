Deno.serve(async _req => {
  try {
    const deepgramApiKey = Deno.env.get('DEEPGRAM_API_KEY');

    if (!deepgramApiKey) {
      return new Response(
        JSON.stringify({
          error: 'DEEPGRAM_API_KEY is not configured',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    const deepgramResponse = await fetch(
      'https://api.deepgram.com/v1/auth/grant',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${deepgramApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ttl_seconds: 60,
        }),
      },
    );

    const responseData = await deepgramResponse.json();

    if (!deepgramResponse.ok) {
      console.error('Deepgram error:', responseData);

      return new Response(
        JSON.stringify({
          success: false,
          deepgramError: responseData,
        }),
        {
          status: deepgramResponse.status,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        token: responseData.access_token,
        expiresIn: responseData.expires_in,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Unexpected error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
});
