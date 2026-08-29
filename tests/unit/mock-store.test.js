import { beforeEach, describe, expect, it } from 'vitest';
import { getMockState, resetMockState, setMockState } from '../../src/services/mock-store.js';

describe('mock store', () => {
  beforeEach(() => localStorage.clear());

  it('persists and resets local demo data', () => {
    setMockState({ user: { id: 'demo' }, profile: { display_name: 'Demo' }, friends: [] });
    expect(getMockState().profile.display_name).toBe('Demo');
    const reset = resetMockState();
    expect(reset.user).toBeNull();
    expect(getMockState().user).toBeNull();
  });
});
