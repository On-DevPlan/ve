import { describe, it, expect } from 'vitest';
import { createAdapters, selectAdapter } from '../src/AdapterFactory';

describe('AdapterFactory', () => {
  it('selects a Vue adapter for vue framework', () => {
    const adapters = createAdapters();
    const a = selectAdapter(adapters, 'vue');
    expect(a.canHandle('vue')).toBe(true);
  });

  it('selects a React adapter for react framework', () => {
    const adapters = createAdapters();
    const a = selectAdapter(adapters, 'react');
    expect(a.canHandle('react')).toBe(true);
  });

  it('throws for unsupported framework', () => {
    const adapters = createAdapters();
    expect(() => selectAdapter(adapters, 'svelte' as never)).toThrow();
  });
});
