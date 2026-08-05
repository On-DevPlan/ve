import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, setBearerProvider } from '../src/api/http/request';

describe('api/http/request Bearer provider', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setBearerProvider(() => null);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockJSON(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  it('does not inject Authorization when provider returns null', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, data: {} }));
    global.fetch = mockFetch;

    await api.get('/api/v1/user/test');

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('injects Bearer header when provider returns token', async () => {
    setBearerProvider(() => 'jwt-abc-123');
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, data: {} }));
    global.fetch = mockFetch;

    await api.get('/api/v1/user/test');

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-abc-123' });
  });

  it('updates token when provider value changes between calls', async () => {
    let token = 'first-token';
    setBearerProvider(() => token);
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, data: {} }));
    global.fetch = mockFetch;

    await api.get('/api/v1/user/test');
    token = 'second-token';
    await api.get('/api/v1/user/test');

    const first = (mockFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    const second = (mockFetch.mock.calls[1][1] as RequestInit).headers as Record<string, string>;
    expect(first.Authorization).toBe('Bearer first-token');
    expect(second.Authorization).toBe('Bearer second-token');
  });

  it('does not break the existing cookie credentials: include', async () => {
    setBearerProvider(() => 'jwt');
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, data: {} }));
    global.fetch = mockFetch;

    await api.get('/api/v1/user/test');

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('include');
  });
});
