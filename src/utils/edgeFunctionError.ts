// utils/edgeFunctionError.ts
import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * Supabase's functions.invoke() only gives a generic message like
 * "Edge Function returned a non-2xx status code" on `error`. The actual
 * message our functions return (e.g. "You already have an active
 * subscription.") lives in the response body. This pulls that out,
 * falling back gracefully if the body isn't readable/JSON for some reason.
 */
export async function extractEdgeFunctionErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // body wasn't JSON or wasn't readable — fall through to fallback
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
