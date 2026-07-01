import { describe, expect, it } from 'vitest';
import manifest from '../../public/manifest.json';

describe('extension manifest', () => {
  it('uses narrow College Board host permissions', () => {
    expect(manifest.host_permissions).toContain('https://satsuitequestionbank.collegeboard.org/*');
    expect(manifest.host_permissions).not.toContain('*://*.collegeboard.org/*');
  });

  it('runs as a Manifest V3 extension', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(expect.arrayContaining(['storage', 'identity']));
  });
});
