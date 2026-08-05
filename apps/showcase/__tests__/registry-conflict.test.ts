import { describe, it, expect } from 'vitest';
import { getRegistry, apiPaths } from '../src/api/registry';

describe('api/registry userV1 + kvV1 entries', () => {
  it('registers userV1 at /api/v1/user', () => {
    expect(apiPaths.userV1).toBe('/api/v1/user');
    expect(getRegistry().userV1.route).toBe('/api/v1/user');
  });

  it('registers kvV1 at /api/v1/kv', () => {
    expect(apiPaths.kvV1).toBe('/api/v1/kv');
    expect(getRegistry().kvV1.route).toBe('/api/v1/kv');
  });

  it('userV1 and kvV1 do not overlap', () => {
    // /api/v1/user vs /api/v1/kv — neither is a prefix of the other
    expect(apiPaths.userV1.startsWith(apiPaths.kvV1 + '/')).toBe(false);
    expect(apiPaths.kvV1.startsWith(apiPaths.userV1 + '/')).toBe(false);
  });

  it('userV1 and kvV1 share the same backend target', () => {
    const userV1 = getRegistry().userV1.target;
    const kvV1 = getRegistry().kvV1.target;
    expect(kvV1).toEqual(userV1);
  });
});
