import { authService } from '../services/auth-service.js';
import { profileService } from '../services/profile-service.js';
import { toAppError } from './errors.js';

let state = { ready: false, session: null, profile: null, profileError: null };
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener(state));
}

export const session = {
  get: () => state,
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async restore() {
    const current = await authService.getSession();
    let profile = null;
    let profileError = null;
    if (current?.user) {
      try {
        profile = await profileService.get(current.user.id);
      } catch (error) {
        profileError = toAppError(error, 'Your profile could not be loaded yet.');
      }
    }
    state = { ready: true, session: current, profile, profileError };
    emit();
    return state;
  },
  async refresh() {
    return this.restore();
  },
  async signOut() {
    await authService.signOut();
    state = { ready: true, session: null, profile: null, profileError: null };
    emit();
  },
  async saveProfile(values) {
    const user = state.session?.user;
    if (!user) {
      throw { code: 'unauthorized', message: 'Please sign in first.' };
    }
    state = { ...state, profile: await profileService.save(user.id, values) };
    emit();
    return state.profile;
  },
};
