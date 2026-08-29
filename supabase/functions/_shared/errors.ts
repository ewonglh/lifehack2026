export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly safeMessage: string,
    options?: ErrorOptions,
  ) {
    super(safeMessage, options);
    this.name = 'ApiError';
  }
}

export const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

export function optionsResponse(): Response {
  return new Response('ok', { headers: corsHeaders });
}

export function errorResponse(error: unknown): Response {
  const correlationId = crypto.randomUUID();
  console.error(`[${correlationId}]`, error);

  if (error instanceof ApiError) {
    return jsonResponse(
      { code: error.code, message: error.safeMessage, correlationId },
      error.status,
    );
  }

  return jsonResponse(
    {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
      correlationId,
    },
    500,
  );
}
