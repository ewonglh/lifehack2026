import { supabase } from '../lib/supabase.js';
import { getMockState, updateMockState } from './mock-store.js';

const unsupported = () => {
  throw {
    code: 'not_implemented',
    message: 'Friend APIs are not available in this Supabase project yet.',
  };
};

export const friendsService = {
  async list() {
    if (supabase) return unsupported();
    return getMockState().friends;
  },
  async search(query) {
    if (supabase) return unsupported();
    const candidates = ['Aisha Rahman', 'Noah Tan', 'Priya Nair'].map((displayName, index) => ({
      id: `search-${index}`,
      displayName,
      country: 'Singapore',
    }));
    return candidates.filter((friend) =>
      friend.displayName.toLowerCase().includes(query.toLowerCase()),
    );
  },
  async request(friend) {
    if (supabase) return unsupported();
    updateMockState((state) => ({
      ...state,
      friends: [...state.friends, { ...friend, status: 'pending_outgoing' }],
    }));
  },
  async accept(id) {
    if (supabase) return unsupported();
    updateMockState((state) => ({
      ...state,
      friends: state.friends.map((friend) =>
        friend.id === id ? { ...friend, status: 'accepted' } : friend,
      ),
    }));
  },
  async decline(id) {
    if (supabase) return unsupported();
    updateMockState((state) => ({
      ...state,
      friends: state.friends.filter((friend) => friend.id !== id),
    }));
  },
  async remove(id) {
    return this.decline(id);
  },
};
