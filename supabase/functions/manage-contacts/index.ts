import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.97.0';
import { ApiError, errorResponse, jsonResponse, optionsResponse } from '../_shared/errors.ts';
import { createRequestContext } from '../_shared/supabase.ts';
import { requireObject, requireString } from '../_shared/validation.ts';

type Provider = 'google' | 'facebook';
type AdminClient = SupabaseClient;

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function createAdminClient(): AdminClient {
  return createClient(requireEnvironment('SUPABASE_URL'), requireEnvironment('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function providerValue(value: unknown): Provider {
  if (value === 'google' || value === 'facebook') return value;
  throw new ApiError(400, 'INVALID_PROVIDER', 'Choose Google or Facebook.');
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9@.+_-]/g, '');
}

async function hashIdentifiers(values: string[]): Promise<string[]> {
  const unique = [...new Set(values.map(normalize).filter(Boolean))];
  return Promise.all(unique.map(async (value) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }));
}

async function providerIdentifiers(provider: Provider, accessToken: string): Promise<{ own: string[]; contacts: string[] }> {
  if (provider === 'google') {
    const [selfResponse, contactsResponse] = await Promise.all([
      fetch('https://people.googleapis.com/v1/people/me?personFields=emailAddresses,phoneNumbers', { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch('https://people.googleapis.com/v1/people/me/connections?personFields=emailAddresses,phoneNumbers&pageSize=1000', { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);
    if (!selfResponse.ok || !contactsResponse.ok) throw new ApiError(502, 'CONTACT_PROVIDER_FAILED', 'Google Contacts could not be read.');
    const self = (await selfResponse.json()) as { emailAddresses?: Array<{ value?: string }>; phoneNumbers?: Array<{ value?: string }> };
    const contacts = (await contactsResponse.json()) as { connections?: Array<{ emailAddresses?: Array<{ value?: string }>; phoneNumbers?: Array<{ value?: string }> }> };
    return {
      own: [...(self.emailAddresses ?? []), ...(self.phoneNumbers ?? [])].map((item) => item.value ?? ''),
      contacts: (contacts.connections ?? []).flatMap((person) => [
        ...(person.emailAddresses ?? []).map((item) => item.value ?? ''),
        ...(person.phoneNumbers ?? []).map((item) => item.value ?? ''),
      ]),
    };
  }

  const ownResponse = await fetch(`https://graph.facebook.com/me?fields=id&access_token=${encodeURIComponent(accessToken)}`);
  const friendsResponse = await fetch(`https://graph.facebook.com/me/friends?fields=id&access_token=${encodeURIComponent(accessToken)}`);
  if (!ownResponse.ok || !friendsResponse.ok) throw new ApiError(502, 'CONTACT_PROVIDER_FAILED', 'Facebook contacts could not be read.');
  const own = (await ownResponse.json()) as { id?: string };
  const friends = (await friendsResponse.json()) as { data?: Array<{ id?: string }> };
  return { own: own.id ? [`facebook:${own.id}`] : [], contacts: (friends.data ?? []).map((friend) => `facebook:${friend.id ?? ''}`) };
}

async function saveProviderIdentifiers(admin: AdminClient, profileId: string, provider: Provider, accessToken: string): Promise<number> {
  const identifiers = await providerIdentifiers(provider, accessToken);
  const ownHashes = await hashIdentifiers(identifiers.own);
  const contactHashes = await hashIdentifiers(identifiers.contacts);
  const { error: ownDeleteError } = await admin.from('profile_contact_identifiers').delete().eq('profile_id', profileId).eq('provider', provider);
  if (ownDeleteError) throw ownDeleteError;
  if (ownHashes.length) {
    const { error } = await admin.from('profile_contact_identifiers').insert(ownHashes.map((identifier_hash) => ({ profile_id: profileId, provider, identifier_hash })));
    if (error) throw error;
  }
  const { error: contactsDeleteError } = await admin.from('contact_identifiers').delete().eq('profile_id', profileId).eq('provider', provider);
  if (contactsDeleteError) throw contactsDeleteError;
  if (contactHashes.length) {
    const { error } = await admin.from('contact_identifiers').insert(contactHashes.map((identifier_hash) => ({ profile_id: profileId, provider, identifier_hash })));
    if (error) throw error;
  }
  const { error: preferenceError } = await admin.from('contact_sync_preferences').upsert({ profile_id: profileId, [`${provider}_enabled`]: true, updated_at: new Date().toISOString() });
  if (preferenceError) throw preferenceError;
  return contactHashes.length;
}

function authorizationUrl(provider: Provider, state: string): string {
  const redirectUri = requireEnvironment(`CONTACT_${provider.toUpperCase()}_REDIRECT_URI`);
  const clientId = requireEnvironment(`CONTACT_${provider.toUpperCase()}_CLIENT_ID`);
  const endpoint = provider === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://www.facebook.com/v20.0/dialog/oauth';
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', state });
  params.set('scope', provider === 'google' ? 'https://www.googleapis.com/auth/contacts.readonly' : 'user_friends');
  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }
  return `${endpoint}?${params.toString()}`;
}

async function exchangeCode(provider: Provider, code: string): Promise<string> {
  const redirectUri = requireEnvironment(`CONTACT_${provider.toUpperCase()}_REDIRECT_URI`);
  const clientId = requireEnvironment(`CONTACT_${provider.toUpperCase()}_CLIENT_ID`);
  const clientSecret = requireEnvironment(`CONTACT_${provider.toUpperCase()}_CLIENT_SECRET`);
  if (provider === 'google') {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    if (!response.ok) throw new ApiError(502, 'CONTACT_PROVIDER_FAILED', 'Google authorization could not be completed.');
    const payload = (await response.json()) as { access_token?: string };
    if (!payload.access_token) throw new ApiError(502, 'CONTACT_PROVIDER_FAILED', 'Google did not return an access token.');
    return payload.access_token;
  }
  const url = new URL('https://graph.facebook.com/v20.0/oauth/access_token');
  url.search = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new ApiError(502, 'CONTACT_PROVIDER_FAILED', 'Facebook authorization could not be completed.');
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new ApiError(502, 'CONTACT_PROVIDER_FAILED', 'Facebook did not return an access token.');
  return payload.access_token;
}

async function callback(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return Response.redirect(`${requireEnvironment('CONTACTS_REDIRECT_URL')}#/friends?contacts=error`);
  const [stateHash] = await hashIdentifiers([state]);
  const admin = createAdminClient();
  const { data: stateRow, error } = await admin.from('contact_oauth_states').select('profile_id, provider').eq('state_hash', stateHash).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error || !stateRow) return Response.redirect(`${requireEnvironment('CONTACTS_REDIRECT_URL')}#/friends?contacts=error`);
  await admin.from('contact_oauth_states').delete().eq('state_hash', stateHash);
  try {
    const accessToken = await exchangeCode(stateRow.provider as Provider, code);
    await saveProviderIdentifiers(admin, stateRow.profile_id, stateRow.provider as Provider, accessToken);
    return Response.redirect(`${requireEnvironment('CONTACTS_REDIRECT_URL')}#/friends?contacts=connected`);
  } catch (error) {
    console.error('Contact OAuth callback failed.', error);
    return Response.redirect(`${requireEnvironment('CONTACTS_REDIRECT_URL')}#/friends?contacts=error`);
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'GET') return callback(request);
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return jsonResponse({ code: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const context = await createRequestContext(request);
    const body = requireObject(await request.json());
    const action = requireString(body, 'action', 3, 20);
    const provider = providerValue(body.provider);
    if (action === 'authorize') {
      const state = crypto.randomUUID() + crypto.randomUUID();
      const [stateHash] = await hashIdentifiers([state]);
      const { error } = await context.admin.from('contact_oauth_states').insert({ state_hash: stateHash, profile_id: context.user.id, provider, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
      if (error) throw new ApiError(500, 'CONTACT_AUTH_FAILED', 'Unable to start contact sync.', { cause: error });
      return jsonResponse({ provider, authorizeUrl: authorizationUrl(provider, state) });
    }
    if (action === 'disable') {
      const { error } = await context.admin.from('contact_sync_preferences').upsert({ profile_id: context.user.id, [`${provider}_enabled`]: false, updated_at: new Date().toISOString() });
      if (error) throw error;
      await context.admin.from('contact_identifiers').delete().eq('profile_id', context.user.id).eq('provider', provider);
      return jsonResponse({ provider, enabled: false });
    }
    if (action !== 'sync') throw new ApiError(400, 'INVALID_REQUEST', 'Unsupported contacts action.');
    const accessToken = requireString(body, 'accessToken', 20, 4096);
    const matchedIdentifiers = await saveProviderIdentifiers(context.admin, context.user.id, provider, accessToken);
    return jsonResponse({ provider, enabled: true, matchedIdentifiers });
  } catch (error) {
    return errorResponse(error);
  }
});
