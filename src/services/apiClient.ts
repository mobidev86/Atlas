import { ENV } from '../config/env';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
  isMock?: boolean;
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  isZeroRetention?: boolean;
}

/**
 * Robust API Client Wrapper for Project Atlas
 */
export async function apiRequest<T>(
  url: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    timeoutMs = ENV.API_TIMEOUT_MS,
    retries = ENV.MAX_RETRY_ATTEMPTS,
    isZeroRetention = ENV.ZERO_RETENTION_DEFAULT,
    headers = {},
    ...fetchOptions
  } = options;

  // Build custom headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  // Zero-retention privacy header injection
  if (isZeroRetention) {
    requestHeaders['X-Atlas-Zero-Retention'] = 'true';
  }

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: requestHeaders,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown HTTP error');
        return {
          data: null,
          error: `HTTP ${response.status}: ${errorText}`,
          status: response.status,
        };
      }

      const data = await response.json();
      return {
        data: data as T,
        error: null,
        status: response.status,
      };
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;
      if (err.name === 'AbortError') {
        return {
          data: null,
          error: `Request timed out after ${timeoutMs}ms`,
          status: 408,
        };
      }

      attempt++;
      if (attempt <= retries) {
        // Exponential backoff wait (e.g. 500ms, 1000ms, 2000ms)
        const delay = Math.pow(2, attempt) * 250;
        await new Promise<void>(resolve => setTimeout(() => resolve(), delay));
      }
    }
  }

  return {
    data: null,
    error: lastError?.message || 'Network request failed after multiple retries',
    status: 500,
  };
}
