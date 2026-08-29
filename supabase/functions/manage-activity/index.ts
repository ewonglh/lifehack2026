import { ApiError, errorResponse, jsonResponse, optionsResponse } from '../_shared/errors.ts';
import { createRequestContext } from '../_shared/supabase.ts';
import { requireObject, requireString, requireUuid } from '../_shared/validation.ts';

const emojis = new Set(['🔥', '♻️', '👏', '🌱']);

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const context = await createRequestContext(request);
    const body = requireObject(await request.json());
    const action = requireString(body, 'action', 3, 20);
    if (action === 'react') {
      const activityId = requireUuid(body, 'activityId');
      const emoji = requireString(body, 'emoji', 1, 4);
      if (!emojis.has(emoji))
        throw new ApiError(400, 'INVALID_REQUEST', 'That reaction is not supported.');
      const { data: activity, error: activityError } = await context.admin
        .from('activity_events')
        .select('squad_id')
        .eq('id', activityId)
        .single();
      if (activityError || !activity)
        throw new ApiError(404, 'NOT_FOUND', 'Activity not found.', { cause: activityError });
      const { data: membership } = await context.admin
        .from('squad_members')
        .select('profile_id')
        .eq('squad_id', activity.squad_id)
        .eq('profile_id', context.user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (!membership) throw new ApiError(403, 'FORBIDDEN', 'You cannot react to this activity.');
      const { error } = await context.admin
        .from('activity_reactions')
        .insert({ activity_id: activityId, profile_id: context.user.id, emoji });
      if (error)
        throw new ApiError(409, 'DUPLICATE_REACTION', 'You already added that reaction.', {
          cause: error,
        });
      return jsonResponse({ activityId, emoji }, 201);
    }
    if (action === 'setPostVisibility') {
      const visibility = requireString(body, 'visibility', 4, 7);
      if (!['private', 'crew', 'public'].includes(visibility))
        throw new ApiError(400, 'INVALID_REQUEST', 'visibility is invalid.');
      const { error } = await context.admin
        .from('profile_posts')
        .update({ visibility })
        .eq('id', requireUuid(body, 'postId'))
        .eq('profile_id', context.user.id);
      if (error) throw error;
      return jsonResponse({ updated: true });
    }
    if (action === 'deletePost') {
      const { error } = await context.admin
        .from('profile_posts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', requireUuid(body, 'postId'))
        .eq('profile_id', context.user.id);
      if (error) throw error;
      return jsonResponse({ deleted: true });
    }
    throw new ApiError(400, 'INVALID_REQUEST', 'Unsupported activity action.');
  } catch (error) {
    return errorResponse(error);
  }
});
