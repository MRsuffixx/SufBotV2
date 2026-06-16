import { AppError } from '@bot/shared/errors';

/**
 * The single response shape used by every server action and route handler
 * in the web app.  `success: true` always implies `data` is set; `success:
 * false` always implies `error` is set.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function fail(error: string): ApiResponse<never> {
  return { success: false, error };
}

export function fromError(err: unknown): ApiResponse<never> {
  if (err instanceof AppError) return fail(err.message);
  if (err instanceof Error) return fail(err.message);
  return fail('Unexpected error');
}
