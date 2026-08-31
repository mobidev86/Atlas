const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

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

  try {
    /**
     * -----------------------------------------
     * Validate OpenAI API key
     * -----------------------------------------
     */
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    /**
     * -----------------------------------------
     * Read request body
     * -----------------------------------------
     */
    const body = await req.json();

    const prompt = body?.prompt;

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'prompt is required',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    /**
     * -----------------------------------------
     * Get current date dynamically
     * -----------------------------------------
     *
     * The date automatically changes every day.
     *
     * Asia/Kolkata is used because the application
     * date should be based on India.
     */
    const currentDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
    }).format(new Date());

    console.log('--------------------------------');
    console.log('TRAVEL INTENT REQUEST');
    console.log('Current date:', currentDate);
    console.log('Prompt:', prompt);
    console.log('--------------------------------');

    /**
     * -----------------------------------------
     * System prompt
     * -----------------------------------------
     */
    const systemPrompt = `
You are a travel intent parser.

Your ONLY job is to understand the user's travel request
and convert it into structured JSON.

The application supports ONLY ONE type of search at a time:

1. HOTEL
2. FLIGHT

A request containing BOTH a flight and hotel request
must be classified as "unsupported".

Do NOT search for flights.

Do NOT search for hotels.

Do NOT call external APIs.

Do NOT invent information.

Today's date is:

${currentDate}

Use this date when resolving relative dates such as:

- today
- tomorrow
- day after tomorrow
- next Tuesday
- next Friday
- this weekend
- next weekend
- next week

Always return dates in:

YYYY-MM-DD

--------------------------------
HOTEL
--------------------------------

For hotel requests extract:

- destination
- check_in
- check_out
- adults
- rooms

IMPORTANT:

For HOTEL requests, destination MUST remain a
human-readable city/location name.

Do NOT convert hotel destinations to IATA codes.

Example:

User:
"Find me a hotel in Dubai from September 10 to September 13 for two adults"

Return:

destination = "Dubai"

If dates are provided, resolve them to YYYY-MM-DD.

If the user does not provide dates:

Do NOT invent dates.

Add the missing date fields to:

missing_fields

If adults are not specified:

adults = 1

If rooms are not specified:

rooms = 1

IMPORTANT:

For HOTEL requests, adults and rooms are optional.

Do NOT add "adults" or "rooms" to missing_fields
when they are not specified.

--------------------------------
FLIGHT
--------------------------------

For flight requests extract:

- origin
- destination
- departure_date
- return_date
- passengers
- cabin_class

IMPORTANT:

For FLIGHT requests, origin and destination MUST be
returned as IATA airport or city codes.

NEVER return a human-readable city name for a flight
origin or destination when the location can be identified.

Examples:

Mumbai -> BOM
Dubai -> DXB
Delhi -> DEL
Ahmedabad -> AMD
Bangalore -> BLR
Hyderabad -> HYD
Chennai -> MAA
Kolkata -> CCU
London -> LON
New York -> NYC
Paris -> PAR
Singapore -> SIN
Tokyo -> TYO

Examples:

User:
"Fly from Mumbai to Dubai"

Return:

origin = "BOM"
destination = "DXB"

User:
"Book a flight from Delhi to London"

Return:

origin = "DEL"
destination = "LON"

User:
"Book 2 business class tickets from Mumbai to Dubai"

Return:

origin = "BOM"
destination = "DXB"
passengers = 2
cabin_class = "business"

IMPORTANT:

Use the appropriate IATA CITY CODE when the user
refers to a city rather than a specific airport.

Examples:

London -> LON
New York -> NYC
Tokyo -> TYO
Paris -> PAR

If the user explicitly specifies a particular airport,
use that airport's IATA airport code instead.

Examples:

Heathrow -> LHR
Gatwick -> LGW
JFK -> JFK
Newark -> EWR
Charles de Gaulle -> CDG

Do NOT invent an airport code.

If a flight location cannot be identified confidently:

- Set the corresponding field to null
- Add the corresponding field to missing_fields

For example:

If origin cannot be identified:

origin = null

missing_fields = ["origin"]

If destination cannot be identified:

destination = null

missing_fields = ["destination"]

--------------------------------
FLIGHT CABIN CLASS
--------------------------------

Possible cabin classes:

- economy
- premium_economy
- business
- first

If cabin class is not specified:

cabin_class = null

Do NOT add cabin_class to missing_fields.

--------------------------------
FLIGHT RETURN DATE
--------------------------------

If return date is specified:

Resolve it to YYYY-MM-DD.

If return date is not specified:

return_date = null

Do NOT add return_date to missing_fields.

A return date is optional.

--------------------------------
FLIGHT PASSENGERS
--------------------------------

Passengers MUST be explicitly provided.

Do NOT assume the number of passengers.

Recognize explicit passenger counts from phrases such as:

- "2 tickets"
- "2 passengers"
- "2 people"
- "for two people"
- "two passengers"
- "two tickets"
- "for two"
- "we are two"
- "there are two of us"

Examples:

"Book 2 business class tickets from Mumbai to Dubai"

passengers = 2

"Book tickets from Mumbai to Dubai for two people"

passengers = 2

If the user does NOT provide a passenger count:

passengers = null

Add:

"passengers"

to missing_fields.

--------------------------------
FLIGHT REQUIRED FIELDS
--------------------------------

The required fields for a flight are:

- origin
- destination
- departure_date
- passengers

The following flight fields are optional:

- return_date
- cabin_class

Only add required missing flight fields to missing_fields.

Do NOT add these hotel-specific fields to missing_fields
for a flight:

- check_in
- check_out
- adults
- rooms

For example:

User:
"Book 2 business class tickets from Mumbai to Dubai on September 15"

This contains all required flight information.

Return:

missing_fields = []

The complete intent should be:

{
  "type": "flight",
  "origin": "BOM",
  "destination": "DXB",
  "departure_date": "2026-09-15",
  "return_date": null,
  "passengers": 2,
  "cabin_class": "business",
  "missing_fields": [],
  "reason": null
}

--------------------------------
HOTEL REQUIRED FIELDS
--------------------------------

The required fields for a hotel are:

- destination
- check_in
- check_out

The following hotel fields are optional and have defaults:

- adults
- rooms

If adults are not specified:

adults = 1

If rooms are not specified:

rooms = 1

Do NOT add "adults" or "rooms" to missing_fields.

If destination is missing:

Add:

"destination"

to missing_fields.

If check-in is missing:

Add:

"check_in"

to missing_fields.

If check-out is missing:

Add:

"check_out"

to missing_fields.

--------------------------------
MIXED REQUEST
--------------------------------

If the user requests BOTH:

flight

AND

hotel

return:

type = "unsupported"

Example:

"Book me a flight to Dubai and a hotel there"

must return:

type = "unsupported"

Set reason to explain that both flight and hotel
were requested in the same request.

Do not attempt to extract or complete a flight
or hotel search for a mixed request.

--------------------------------
NON-TRAVEL REQUEST
--------------------------------

If the request is unrelated to travel:

type = "unsupported"

Set reason to explain why the request is unsupported.

--------------------------------
MISSING INFORMATION
--------------------------------

IMPORTANT:

Only add fields to missing_fields that are required
for the CURRENT intent type.

For HOTEL:

Required fields:

- destination
- check_in
- check_out

For FLIGHT:

Required fields:

- origin
- destination
- departure_date
- passengers

Do NOT add optional fields to missing_fields.

Do NOT add hotel fields to a flight request.

Do NOT add flight fields to a hotel request.

Examples:

Hotel missing check-in:

[
  "check_in"
]

Hotel missing both dates:

[
  "check_in",
  "check_out"
]

Flight missing passengers:

[
  "passengers"
]

Flight missing origin:

[
  "origin"
]

Flight missing destination:

[
  "destination"
]

Flight missing origin and passengers:

[
  "origin",
  "passengers"
]

--------------------------------
IMPORTANT RULES
--------------------------------

Never invent information.

Never invent dates.

Never assume flight passengers.

For hotels:

- destination remains a human-readable name
- adults may default to 1
- rooms may default to 1
- adults and rooms are NOT required fields

For flights:

- origin MUST be an IATA airport/city code
- destination MUST be an IATA airport/city code
- passengers MUST be explicitly provided
- return_date is optional
- cabin_class is optional
- do NOT add adults or rooms to missing_fields

If a flight origin or destination cannot be confidently
identified, return null for that field and add the field
to missing_fields.

Return ONLY structured JSON.
`;

    /**
     * -----------------------------------------
     * Call OpenAI Responses API
     * -----------------------------------------
     */
    const openAIResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },

      body: JSON.stringify({
        model: 'gpt-4o-mini',

        input: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],

        text: {
          format: {
            type: 'json_schema',

            name: 'travel_intent',

            strict: true,

            schema: {
              type: 'object',

              properties: {
                type: {
                  type: 'string',
                  enum: ['hotel', 'flight', 'unsupported'],
                },

                destination: {
                  type: ['string', 'null'],
                },

                origin: {
                  type: ['string', 'null'],
                },

                check_in: {
                  type: ['string', 'null'],
                },

                check_out: {
                  type: ['string', 'null'],
                },

                departure_date: {
                  type: ['string', 'null'],
                },

                return_date: {
                  type: ['string', 'null'],
                },

                adults: {
                  type: ['integer', 'null'],
                },

                rooms: {
                  type: ['integer', 'null'],
                },

                passengers: {
                  type: ['integer', 'null'],
                },

                cabin_class: {
                  type: ['string', 'null'],
                },

                missing_fields: {
                  type: 'array',

                  items: {
                    type: 'string',
                  },
                },

                reason: {
                  type: ['string', 'null'],
                },
              },

              required: [
                'type',
                'destination',
                'origin',
                'check_in',
                'check_out',
                'departure_date',
                'return_date',
                'adults',
                'rooms',
                'passengers',
                'cabin_class',
                'missing_fields',
                'reason',
              ],

              additionalProperties: false,
            },
          },
        },
      }),
    });

    /**
     * -----------------------------------------
     * Read raw OpenAI response
     * -----------------------------------------
     */
    const rawResponse = await openAIResponse.text();

    console.log('--------------------------------');
    console.log('OPENAI HTTP STATUS');
    console.log(openAIResponse.status);
    console.log('--------------------------------');

    console.log('--------------------------------');
    console.log('OPENAI RAW RESPONSE');
    console.log(rawResponse);
    console.log('--------------------------------');

    /**
     * -----------------------------------------
     * Handle OpenAI HTTP errors
     * -----------------------------------------
     */
    if (!openAIResponse.ok) {
      let errorMessage = 'OpenAI request failed';

      try {
        const errorData = JSON.parse(rawResponse);

        errorMessage =
          errorData?.error?.message ?? errorData?.error?.code ?? errorMessage;

        console.error('OpenAI API error:', JSON.stringify(errorData, null, 2));
      } catch {
        console.error('OpenAI returned non-JSON error:', rawResponse);
      }

      throw new Error(`${errorMessage} (HTTP ${openAIResponse.status})`);
    }

    /**
     * -----------------------------------------
     * Parse OpenAI response
     * -----------------------------------------
     */
    let result: any;

    try {
      result = JSON.parse(rawResponse);
    } catch {
      throw new Error('OpenAI returned an invalid response');
    }

    console.log('OpenAI response ID:', result?.id);

    console.log('OpenAI response status:', result?.status);

    console.log('OpenAI output:', JSON.stringify(result?.output, null, 2));

    /**
     * -----------------------------------------
     * Handle incomplete response
     * -----------------------------------------
     */
    if (result?.status === 'incomplete') {
      const reason = result?.incomplete_details?.reason ?? 'unknown';

      throw new Error(`OpenAI response was incomplete: ${reason}`);
    }

    /**
     * -----------------------------------------
     * Handle refusal
     * -----------------------------------------
     */
    const outputItems = Array.isArray(result?.output) ? result.output : [];

    const refusalItem = outputItems
      .flatMap((item: any) =>
        Array.isArray(item?.content) ? item.content : [],
      )
      .find((content: any) => content?.type === 'refusal');

    if (refusalItem) {
      throw new Error(
        `OpenAI refused the request: ${
          refusalItem?.refusal ?? 'Unknown refusal'
        }`,
      );
    }

    /**
     * -----------------------------------------
     * Get output text
     * -----------------------------------------
     */
    let outputText =
      typeof result?.output_text === 'string' ? result.output_text : '';

    /**
     * Fallback:
     * Search output[].content[]
     */
    if (!outputText) {
      for (const outputItem of outputItems) {
        const contentItems = Array.isArray(outputItem?.content)
          ? outputItem.content
          : [];

        for (const contentItem of contentItems) {
          if (
            contentItem?.type === 'output_text' &&
            typeof contentItem?.text === 'string'
          ) {
            outputText = contentItem.text;

            break;
          }
        }

        if (outputText) {
          break;
        }
      }
    }

    /**
     * -----------------------------------------
     * Validate output
     * -----------------------------------------
     */
    if (typeof outputText !== 'string' || outputText.trim().length === 0) {
      console.error(
        'OpenAI returned no usable output:',
        JSON.stringify(result, null, 2),
      );

      throw new Error('OpenAI returned no usable structured output');
    }

    console.log('OpenAI final output:', outputText);

    /**
     * -----------------------------------------
     * Parse structured JSON
     * -----------------------------------------
     */
    let travelIntent: any;

    try {
      travelIntent = JSON.parse(outputText);
    } catch {
      console.error('Invalid structured JSON:', outputText);

      throw new Error('OpenAI returned invalid structured JSON');
    }

    console.log('Travel intent:', JSON.stringify(travelIntent, null, 2));

    /**
     * -----------------------------------------
     * UNSUPPORTED REQUEST
     * -----------------------------------------
     */
    if (travelIntent?.type === 'unsupported') {
      return new Response(
        JSON.stringify({
          success: false,

          error:
            travelIntent?.reason ?? 'This travel request is not supported.',

          code: 'UNSUPPORTED_TRAVEL_REQUEST',
        }),
        {
          status: 400,

          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    /**
     * -----------------------------------------
     * Validate supported intent
     * -----------------------------------------
     */
    if (travelIntent?.type !== 'hotel' && travelIntent?.type !== 'flight') {
      throw new Error('Invalid travel intent type returned by OpenAI');
    }

    /**
     * -----------------------------------------
     * SUCCESS
     * -----------------------------------------
     */
    return new Response(
      JSON.stringify({
        success: true,

        intent: travelIntent,
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
    /**
     * -----------------------------------------
     * ERROR
     * -----------------------------------------
     */
    console.error('--------------------------------');

    console.error('TRAVEL INTENT ERROR:', error);

    console.error('--------------------------------');

    return new Response(
      JSON.stringify({
        success: false,

        error:
          error instanceof Error
            ? error.message
            : 'Failed to process travel intent',
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
