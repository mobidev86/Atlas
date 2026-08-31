import { supabase } from './supabase';

export type DuffelCheckoutType = 'flight' | 'hotel';

interface DuffelCheckoutResponse {
  success: boolean;
  type?: DuffelCheckoutType;
  session_id?: string | null;
  reference?: string;
  url?: string;
  error?: string;
}

export class DuffelCheckoutService {
  static async createSession(
    type: DuffelCheckoutType,
  ): Promise<DuffelCheckoutResponse> {
    try {
      const { data, error } = await supabase.functions.invoke(
        'duffel-checkout-session',
        {
          body: {
            type,
          },
        },
      );

      // if (error) {
      //   console.error('Duffel checkout session error:', error);

      //   return {
      //     success: false,
      //     error: error.message,
      //   };
      // }

      if (error) {
        console.error('========== DUFFEL CHECKOUT SESSION ERROR ==========');

        console.error('Error:', error);
        console.error('Error message:', error.message);
        console.error('Error context:', error.context);

        try {
          if (error.context) {
            const responseText = await error.context.text();

            console.error('Edge Function response:', responseText);
          }
        } catch (readError) {
          console.error(
            'Unable to read Edge Function error response:',
            readError,
          );
        }

        return {
          success: false,
          error: error.message || 'Unable to create Duffel checkout session.',
        };
      }

      if (!data?.success || !data?.url) {
        return {
          success: false,
          error: data?.error || 'Unable to create Duffel checkout session.',
        };
      }

      return {
        success: true,
        type: data.type,
        session_id: data.session_id,
        reference: data.reference,
        url: data.url,
      };
    } catch (error) {
      console.error('Duffel checkout session exception:', error);

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to create Duffel checkout session.',
      };
    }
  }
}
