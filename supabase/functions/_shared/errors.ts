export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'INVALID_IMAGE'
  | 'RATE_LIMITED'
  | 'MODEL_UNAVAILABLE'
  | 'DUPLICATE_REQUEST'
  | 'INTERNAL_ERROR';

export function apiError(
  code: ErrorCode,
  message: string,
  status: number,
  details?: unknown,
  headers: Record<string, string> = {},
) {
  const body = details === undefined ? { code, message } : { code, message, details };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...headers,
    },
  });
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};
