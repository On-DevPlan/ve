import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setBearerProvider } from '../src/api/http/request';
import { ApiError } from '../src/api/services/base';

const KV_KEY = 'color-studio';
const TAGS = ['color-studio'];

describe('createColorStudioStore', () => {
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

  it('load parses stored value and validates with Zod', async () => {
    const doc = {
      meta: { schemaVersion: '1.0.0', createdAt: 1, updatedAt: 1, authorEmail: 'x@y' },
      activePaletteId: 'p1',
      palettes: [{
        id: 'p1', name: 'A', colorIds: ['c1'], harmony: null, sortBy: 'manual',
        createdAt: 1, updatedAt: 1,
      }],
      colorEntries: [{
        id: 'c1', hex: '#FFFFFF', weight: 1, locked: false, note: '', tags: [],
        createdAt: 1, updatedAt: 1,
      }],
      pickHistory: [],
      viewState: { leftPane: 'palettes', showHarmony: false, selectedHarmony: null, brightness: 100 },
    };
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { key: KV_KEY, value: JSON.stringify(doc) } }),
    );
    global.fetch = mockFetch;

    const { createColorStudioStore } = await import(
      '../src/api/components/color-studio/createColorStudioStore'
    );
    const store = createColorStudioStore();
    const loaded = await store.load();
    expect(loaded.meta.schemaVersion).toBe('1.3.0');
    expect(loaded.palettes[0].id).toBe('p1');
  });

  it('load returns emptyDoc on ApiError code 50 (no default group)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(
      new ApiError(50, 'no default group'),
    );
    global.fetch = mockFetch;

    const { createColorStudioStore } = await import(
      '../src/api/components/color-studio/createColorStudioStore'
    );
    const store = createColorStudioStore();
    const loaded = await store.load();
    expect(loaded.meta.schemaVersion).toBe('1.3.0');
    expect(loaded.palettes.length).toBeGreaterThan(0);
  });

  it('load returns emptyDoc on 404 (key not found)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(404, { code: 404, message: 'not found' }));
    global.fetch = mockFetch;
    const { createColorStudioStore } = await import(
      '../src/api/components/color-studio/createColorStudioStore'
    );
    const store = createColorStudioStore();
    const loaded = await store.load();
    expect(loaded.colorEntries.length).toBeGreaterThan(0);
  });

  it('save POSTs with key/value/tags/ttl=0', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, message: 'ok' }));
    global.fetch = mockFetch;

    const { createColorStudioStore } = await import(
      '../src/api/components/color-studio/createColorStudioStore'
    );
    const { emptyDoc } = await import('../src/api/components/color-studio/types');
    const store = createColorStudioStore();
    const doc = emptyDoc();
    await store.save(doc);

    expect(mockFetch).toHaveBeenCalled();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(url).toBe('/api/v1/kv');
    const body = JSON.parse(init.body as string);
    expect(body.key).toBe(KV_KEY);
    expect(body.tags).toEqual(TAGS);
    expect(body.ttl).toBe(0);
  });

  it('importJson rejects malformed JSON', async () => {
    const { createColorStudioStore } = await import(
      '../src/api/components/color-studio/createColorStudioStore'
    );
    const store = createColorStudioStore();
    expect(() => store.importJson('not-json')).toThrow();
  });

  it('importJson rejects doc that fails Zod validation', async () => {
    const { createColorStudioStore } = await import(
      '../src/api/components/color-studio/createColorStudioStore'
    );
    const store = createColorStudioStore();
    expect(() => store.importJson(JSON.stringify({ totally: 'wrong' }))).toThrow();
  });

  it('exportJson returns pretty-printed JSON', async () => {
    const { createColorStudioStore } = await import(
      '../src/api/components/color-studio/createColorStudioStore'
    );
    const { emptyDoc } = await import('../src/api/components/color-studio/types');
    const store = createColorStudioStore();
    const out = store.exportJson(emptyDoc());
    expect(out).toContain('schemaVersion');
    expect(JSON.parse(out).meta.schemaVersion).toBe('1.3.0');
  });
});
