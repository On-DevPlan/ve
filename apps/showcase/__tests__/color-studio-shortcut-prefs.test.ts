import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setBearerProvider } from '../src/api/http/request';
import { ApiError } from '../src/api/services/base';

const KV_KEY = 've-color-key';
const TAGS = ['color-studio'];

describe('createShortcutPrefsStore', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setBearerProvider(() => 'jwt-xyz');
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

  it('load GETs /api/v1/kv/ve-color-key', async () => {
    const prefs = {
      schemaVersion: '1.0.0',
      shortcuts: { eyedropper: 'q', addColor: 'w', copy: 'e', clearHistory: 'r' },
      updatedAt: 42,
    };
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { key: KV_KEY, value: JSON.stringify(prefs) } }),
    );
    global.fetch = mockFetch;

    const { createShortcutPrefsStore } = await import(
      '../src/api/components/color-studio/createShortcutPrefsStore'
    );
    const store = createShortcutPrefsStore();
    const loaded = await store.load();
    expect(mockFetch).toHaveBeenCalled();
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/v1/kv/${KV_KEY}`);
    expect(loaded.shortcuts.eyedropper).toBe('q');
    expect(loaded.shortcuts.copy).toBe('e');
  });

  it('load falls back to DEFAULT_SHORTCUTS on code 50', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new ApiError(50, 'no default group'));
    global.fetch = mockFetch;

    const { createShortcutPrefsStore, DEFAULT_SHORTCUTS } = await import(
      '../src/api/components/color-studio/createShortcutPrefsStore'
    );
    const store = createShortcutPrefsStore();
    const loaded = await store.load();
    expect(loaded.shortcuts).toEqual(DEFAULT_SHORTCUTS);
  });

  it('load falls back to defaults on 404', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(404, { code: 404, message: 'nf' }));
    global.fetch = mockFetch;

    const { createShortcutPrefsStore, DEFAULT_SHORTCUTS } = await import(
      '../src/api/components/color-studio/createShortcutPrefsStore'
    );
    const store = createShortcutPrefsStore();
    const loaded = await store.load();
    expect(loaded.shortcuts).toEqual(DEFAULT_SHORTCUTS);
  });

  it('load falls back when stored value is garbage', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { key: KV_KEY, value: 'not-json' } }),
    );
    global.fetch = mockFetch;

    const { createShortcutPrefsStore, DEFAULT_SHORTCUTS } = await import(
      '../src/api/components/color-studio/createShortcutPrefsStore'
    );
    const store = createShortcutPrefsStore();
    const loaded = await store.load();
    expect(loaded.shortcuts).toEqual(DEFAULT_SHORTCUTS);
  });

  it('save POSTs with key/value/tags/ttl=0', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, message: 'ok' }));
    global.fetch = mockFetch;

    const { createShortcutPrefsStore, DEFAULT_SHORTCUTS } = await import(
      '../src/api/components/color-studio/createShortcutPrefsStore'
    );
    const store = createShortcutPrefsStore();
    await store.save({ schemaVersion: '1.0.0', shortcuts: { ...DEFAULT_SHORTCUTS }, updatedAt: 1 });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(url).toBe('/api/v1/kv');
    const body = JSON.parse(init.body as string);
    expect(body.key).toBe(KV_KEY);
    expect(body.tags).toEqual(TAGS);
    expect(body.ttl).toBe(0);
    const value = JSON.parse(body.value);
    expect(value.shortcuts.eyedropper).toBe('p');
  });

  it('parseShortcutPrefs rejects shortcut map with multi-char keys', async () => {
    const { parseShortcutPrefs } = await import(
      '../src/api/components/color-studio/createShortcutPrefsStore'
    );
    const bad = JSON.stringify({
      schemaVersion: '1.0.0',
      shortcuts: { eyedropper: 'ab', addColor: 'w', copy: 'e', clearHistory: 'r' },
      updatedAt: 1,
    });
    const out = parseShortcutPrefs(bad);
    expect(out.shortcuts.eyedropper).toBe('p'); // 默认值
  });
});
