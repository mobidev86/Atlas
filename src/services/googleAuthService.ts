import { supabase } from './supabase';

export class GoogleAuthService {
  static async startOAuth(): Promise<{
    authorizationUrl: string | null;
    error: string | null;
  }> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        return {
          authorizationUrl: null,
          error: 'You must be signed in to connect Google.',
        };
      }

      const { data, error } = await supabase.functions.invoke(
        'google-oauth-start',
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      if (error) {
        console.error('GOOGLE OAUTH START ERROR:', error);

        return {
          authorizationUrl: null,
          error: error.message || 'Unable to start Google connection.',
        };
      }

      if (!data?.authorizationUrl) {
        return {
          authorizationUrl: null,
          error: 'Google authorization URL was not returned.',
        };
      }

      return {
        authorizationUrl: data.authorizationUrl,
        error: null,
      };
    } catch (error: any) {
      console.error('GOOGLE OAUTH SERVICE ERROR:', error);

      return {
        authorizationUrl: null,
        error: error?.message || 'Unable to connect Google account.',
      };
    }
  }
}
