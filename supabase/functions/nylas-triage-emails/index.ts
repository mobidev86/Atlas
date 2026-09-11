import OpenAI from 'https://esm.sh/openai@4.69.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface EmailInput {
  id: string;
  threadId?: string | null;
  subject?: string | null;
  from?: {
    name?: string | null;
    email?: string | null;
  } | null;
  snippet?: string | null;
  receivedAt?: number | null;
  unread?: boolean;
}

interface TriageResult {
  emailId: string;
  requiresAction: boolean;
  actionPoint: string | null;
  reason: string;
}

Deno.serve(async req => {
  try {
    // --------------------------------------------------
    // 1. Handle CORS
    // --------------------------------------------------

    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: corsHeaders,
      });
    }

    // --------------------------------------------------
    // 2. Only POST is supported
    // --------------------------------------------------

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Method not allowed.',
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // --------------------------------------------------
    // 3. OpenAI API key
    // --------------------------------------------------

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured.');
    }

    // --------------------------------------------------
    // 4. Parse request
    // --------------------------------------------------

    const body = await req.json();

    const emails: EmailInput[] = body?.emails;

    if (!Array.isArray(emails)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'emails must be an array.',
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

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          count: 0,
          actionableEmails: [],
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // --------------------------------------------------
    // 5. Limit the batch
    //
    // We currently fetch 20 emails, but keep the
    // function protected if a larger payload is sent.
    // --------------------------------------------------

    const limitedEmails = emails.slice(0, 20);

    // --------------------------------------------------
    // 6. Create a small payload for the model
    // --------------------------------------------------

    const emailPayload = limitedEmails.map(email => ({
      id: email.id,
      senderName: email.from?.name ?? null,
      senderEmail: email.from?.email ?? null,
      subject: email.subject ?? '',
      snippet: email.snippet ?? '',
      receivedAt: email.receivedAt ?? null,
      unread: email.unread ?? false,
    }));

    // --------------------------------------------------
    // 7. OpenAI client
    // --------------------------------------------------

    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // --------------------------------------------------
    // 8. Triage emails
    // --------------------------------------------------

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: {
        type: 'json_object',
      },
      messages: [
        {
          role: 'system',
          content: `
You are an email triage assistant.

Your job is to identify emails that genuinely require the user's attention or action.

IMPORTANT:
- Do NOT treat unread status alone as requiring action.
- Ignore marketing emails.
- Ignore advertisements.
- Ignore newsletters.
- Ignore promotional offers.
- Ignore generic product announcements.
- Ignore routine automated notifications that require no action.
- Ignore receipts, invoices, shipping notifications, and confirmations unless the email clearly asks the user to take an action.
- Ignore social notifications unless they clearly require a response or action.
- Ignore spam-like content.
- Prioritize emails from people, organizations, or services where the user needs to respond, decide, approve, provide information, complete something, attend something, or take another meaningful action.

An email should require action when there is a clear next step for the user.

For every email:
- requiresAction must be true or false.
- If requiresAction is true, provide a concise actionPoint describing what the user needs to do.
- If requiresAction is false, actionPoint must be null.
- Provide a short reason explaining the classification.

Do not invent information that is not present in the email.

Return ONLY valid JSON using this structure:

{
  "results": [
    {
      "emailId": "string",
      "requiresAction": true,
      "actionPoint": "string",
      "reason": "string"
    }
  ]
}
          `.trim(),
        },
        {
          role: 'user',
          content: JSON.stringify(emailPayload),
        },
      ],
    });

    // --------------------------------------------------
    // 9. Parse model response
    // --------------------------------------------------

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI returned an empty response.');
    }

    let parsed: {
      results?: TriageResult[];
    };

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error('OPENAI TRIAGE JSON PARSE ERROR:', error);
      console.error('OPENAI RAW RESPONSE:', content);

      throw new Error('Unable to parse email triage response.');
    }

    const results = Array.isArray(parsed.results) ? parsed.results : [];

    // --------------------------------------------------
    // 10. Keep only actionable emails
    // --------------------------------------------------

    const actionableEmails = results
      .filter(result => result.requiresAction === true)
      .map(result => ({
        emailId: result.emailId,
        actionPoint: result.actionPoint ?? null,
        reason: result.reason ?? '',
      }));

    // --------------------------------------------------
    // 11. Return compact response
    // --------------------------------------------------

    console.log(
      `NYLAS TRIAGE COMPLETE: ${actionableEmails.length} actionable emails`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        count: actionableEmails.length,
        actionableEmails,
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
    console.error('NYLAS TRIAGE ERROR:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unable to triage emails.';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
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
