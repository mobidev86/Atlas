import { supabase } from './supabase';

export class ZoomAuthService {
  static async startOAuth(): Promise<{
    authorizationUrl: string | null;
    error: string | null;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('zoom-connect');

      if (error) {
        console.error('ZOOM OAUTH START ERROR:', error);

        return {
          authorizationUrl: null,
          error: error.message || 'Unable to start Zoom OAuth.',
        };
      }

      if (!data?.authorizationUrl) {
        return {
          authorizationUrl: null,
          error: 'Zoom authorization URL was not returned.',
        };
      }

      return {
        authorizationUrl: data.authorizationUrl,
        error: null,
      };
    } catch (error) {
      console.error('ZOOM OAUTH ERROR:', error);

      return {
        authorizationUrl: null,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to start Zoom OAuth.',
      };
    }
  }
}
