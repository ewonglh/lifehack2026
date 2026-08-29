import { ApiError, errorResponse, jsonResponse, optionsResponse } from '../_shared/errors.ts';
import { createRequestContext, enforceRateLimit } from '../_shared/supabase.ts';
import { optionalString, requireObject, requireString } from '../_shared/validation.ts';

type ProfilePayload = {
  displayName: string;
  handle: string | null;
  about: string;
  location: string;
  timezone: string;
  ageVisibility: string;
  leaderboardVisible: boolean;
};

function parseProfilePayload(source: Record<string, unknown>): ProfilePayload {
  return {
    displayName: requireString(source, 'displayName', 1, 40),
    handle: optionalString(source, 'handle', 30) ?? null,
    about: optionalString(source, 'about', 280) ?? '',
    location: optionalString(source, 'location', 80) ?? 'Singapore',
    timezone: optionalString(source, 'timezone', 80) ?? 'Asia/Singapore',
    ageVisibility: optionalString(source, 'ageVisibility', 20) ?? 'private',
    leaderboardVisible: source.leaderboardVisible === undefined ? true : Boolean(source.leaderboardVisible),
  };
}

function extensionFor(contentType: string): string {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[contentType] ?? '';
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const context = await createRequestContext(request);
    await enforceRateLimit(context.admin, context.user.id, 'manage-profile', 20, 60);
    const contentType = request.headers.get('content-type') ?? '';
    let payload: ProfilePayload;
    let avatarFile: File | null = null;
    if (contentType.toLowerCase().startsWith('multipart/form-data')) {
      const form = await request.formData();
      const values: Record<string, unknown> = Object.fromEntries(form.entries());
      values.leaderboardVisible = values.leaderboardVisible !== 'false';
      payload = parseProfilePayload(values);
      const file = form.get('avatar');
      if (file !== null && !(file instanceof File)) throw new ApiError(400, 'INVALID_AVATAR', 'Choose a valid profile photo.');
      avatarFile = file instanceof File && file.size > 0 ? file : null;
    } else {
      payload = parseProfilePayload(requireObject(await request.json()));
    }

    if (avatarFile) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(avatarFile.type)) throw new ApiError(415, 'UNSUPPORTED_AVATAR_TYPE', 'Use a JPEG, PNG, or WebP profile photo.');
      if (avatarFile.size > 2 * 1024 * 1024) throw new ApiError(413, 'AVATAR_TOO_LARGE', 'Profile photos must be 2 MB or smaller.');
    }
    const { data: current, error: currentError } = await context.admin.from('profiles').select('avatar_path').eq('id', context.user.id).maybeSingle();
    if (currentError) throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to load your profile.', { cause: currentError });
    let newAvatarPath: string | null = null;
    if (avatarFile) {
      const extension = extensionFor(avatarFile.type);
      newAvatarPath = `${context.user.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await context.userClient.storage.from('avatars').upload(newAvatarPath, avatarFile, {
        contentType: avatarFile.type,
        upsert: false,
      });
      if (error) throw new ApiError(500, 'AVATAR_UPLOAD_FAILED', 'Unable to save your profile photo.', { cause: error });
    }

    const { data: profile, error } = await context.admin.rpc('save_profile_for_actor', {
      p_actor_id: context.user.id,
      p_display_name: payload.displayName,
      p_handle: payload.handle,
      p_about: payload.about,
      p_location: payload.location,
      p_timezone: payload.timezone,
      p_age_visibility: payload.ageVisibility,
      p_leaderboard_visible: payload.leaderboardVisible,
      p_avatar_path: newAvatarPath,
    });
    if (error || !profile) {
      if (newAvatarPath) await context.admin.storage.from('avatars').remove([newAvatarPath]);
      throw new ApiError(400, 'PROFILE_UPDATE_FAILED', 'Unable to update your profile.', { cause: error });
    }
    if (newAvatarPath && current?.avatar_path) await context.admin.storage.from('avatars').remove([current.avatar_path]);
    const avatarUrl = profile.avatar_path
      ? (await context.admin.storage.from('avatars').createSignedUrl(profile.avatar_path, 3600)).data?.signedUrl ?? null
      : null;
    return jsonResponse({ profile, avatarUrl });
  } catch (error) {
    return errorResponse(error);
  }
});
