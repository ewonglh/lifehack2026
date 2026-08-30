/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import { avatar } from '../../src/components/avatar.js';

describe('shared avatar frames', () => {
  it('renders the known leaf frame around the avatar', () => {
    const rendered = avatar({ displayName: 'Irfan', frameId: 'leaf-frame' });

    expect(rendered).toContain('avatar-frame-wrap-sm');
    expect(rendered).toContain('avatar-frame-sm');
    expect(rendered).toContain('aria-hidden="true"');
  });

  it('falls back to the base avatar for an unknown frame', () => {
    const rendered = avatar({ displayName: 'Irfan', frameId: 'unknown-frame' });

    expect(rendered).not.toContain('avatar-frame-wrap');
    expect(rendered).toContain('avatar-sm');
  });

  it('renders the base avatar when no frame is selected', () => {
    const rendered = avatar({ displayName: 'Irfan', frameId: null });

    expect(rendered).not.toContain('avatar-frame-wrap');
    expect(rendered).toContain('avatar-sm');
  });
});
