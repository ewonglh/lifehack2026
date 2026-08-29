import { analyzePhoto } from '../_shared/photo-analyzer.ts';
import { downloadOwnedImage } from '../_shared/image.ts';
import { ApiError, errorResponse, jsonResponse, optionsResponse } from '../_shared/errors.ts';
import { createRequestContext, enforceRateLimit } from '../_shared/supabase.ts';
import { optionalString, requireObject, requireString } from '../_shared/validation.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const context = await createRequestContext(request);
    await enforceRateLimit(context.admin, context.user.id, 'analyze-submission', 10, 60);

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch (error) {
      throw new ApiError(400, 'INVALID_REQUEST', 'Send a valid JSON request body.', {
        cause: error,
      });
    }
    const body = requireObject(rawBody);
    const imagePath = requireString(body, 'imageStoragePath', 3, 500);
    const locale = optionalString(body, 'locale', 30) ?? 'en-SG';
    const localeRuleVersion = optionalString(body, 'localeRuleVersion', 80) ?? 'sg-demo-v1';
    const image = await downloadOwnedImage(context.userClient, context.user.id, imagePath);
    const classification = await analyzePhoto({
      ...image,
      imagePath,
      locale,
      localeRuleVersion,
    });

    return jsonResponse({ classification });
  } catch (error) {
    return errorResponse(error);
  }
});
