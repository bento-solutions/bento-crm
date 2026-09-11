import { ApiClientError } from '../core/services/base-api.service';

/**
 * Extract a human-readable message from a value caught in a `catch` block, which TypeScript types
 * as `unknown`. Prefers the server's `detail` (via {@link ApiClientError}), then a plain
 * `Error.message`, then the given fallback.
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiClientError) {
    return err.detail || err.message || fallback;
  }
  if (err instanceof Error) {
    return err.message || fallback;
  }
  if (typeof err === 'string' && err.trim()) {
    return err;
  }
  return fallback;
}
