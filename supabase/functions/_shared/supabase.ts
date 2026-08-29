import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.97.0';
import { ApiError } from './errors.ts';

type RequestContext = {
  admin: SupabaseClient;
  userClient: SupabaseClient;
  user: User;
};

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export async function createRequestContext(request: Request): Promise<RequestContext> {
  const authorization = request.headers.get('Authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!authorization || !token) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in again.');
  }

  const url = requireEnvironment('SUPABASE_URL');
  const publishableKey = requireEnvironment('SUPABASE_ANON_KEY');
  const serviceRoleKey = requireEnvironment('SUPABASE_SERVICE_ROLE_KEY');
  const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

  const userClient = createClient(url, publishableKey, {
    ...clientOptions,
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in again.', { cause: error });
  }

  const admin = createClient(url, serviceRoleKey, clientOptions);
  return { admin, userClient, user: data.user };
}

export async function enforceRateLimit(
  admin: SupabaseClient,
  actorId: string,
  endpoint: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<void> {
  const { data, error } = await admin.rpc('consume_edge_rate_limit', {
    p_actor_id: actorId,
    p_endpoint: endpoint,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });
  if (error)
    throw new ApiError(500, 'INTERNAL_ERROR', 'Unable to validate this request.', { cause: error });
  if (!data)
    throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again shortly.');
}
