import { ScreenName } from '../types';

export interface DeepLinkRoute {
  screen: ScreenName;
  params?: Record<string, string>;
}

export class DeepLinkService {
  /**
   * Parse URI scheme atlas://travel/123 -> { screen: 'travel', params: { id: '123' } }
   */
  static parseUrl(url: string): DeepLinkRoute | null {
    try {
      if (!url || !url.startsWith('atlas://')) return null;

      const path = url.replace('atlas://', '');
      const parts = path.split('?');
      const routePath = parts[0].split('/')[0];
      const queryString = parts[1] || '';

      const params: Record<string, string> = {};
      if (queryString) {
        queryString.split('&').forEach(param => {
          const [key, val] = param.split('=');
          if (key) params[key] = decodeURIComponent(val || '');
        });
      }

      switch (routePath) {
        case 'travel':
          return { screen: 'travel', params };
        case 'dining':
          return { screen: 'dining', params };
        case 'inbox':
        case 'reply':
          return { screen: 'reply', params };
        case 'profile':
          return { screen: 'profile', params };
        case 'subscribe':
          return { screen: 'subscribe', params };
        default:
          return { screen: 'home', params };
      }
    } catch {
      return null;
    }
  }
}
