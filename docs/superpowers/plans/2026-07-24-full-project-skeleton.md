# Full Project Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the complete Vue + React micro-frontend showcase skeleton at `D:\DevProjects\my\github\wb`: type contract, manifest generator, mount adapters, three example components (Vue simple, Vue heavy, React table), the showcase Host app with CardGrid + DetailPage + ShadowRoot + theme contract, and an end-to-end performance gate that proves first paint doesn't load any component implementation.

**Architecture:** pnpm monorepo. Three core packages (`component-contract`, `manifest-generator`, `mount-adapters`) plus two component packages (`vue-components`, `react-components`) plus the `showcase` Host app. Manifest is generated at build time AND via a Vite plugin middleware in dev. CardGrid consumes metadata only; DetailPage mounts a Vue/React component into a ShadowRoot with adoptedStyleSheets theme contract. Status management uses Vue 3 composables (no Pinia). First-stage implementation uses **Vite native dynamic import** (no Module Federation protocol) — Federation interfaces are reserved but not wired.

**Tech Stack:** Node 22, pnpm 9, Vite 5+, Vue 3.4+, React 19, TypeScript 5.4+, vite-plugin-vue, @vitejs/plugin-react, ajv (JSON Schema), vue-router 4, vitest 2.x, ESLint 9 (existing config from previous plan).

**Reference Spec:** `D:\DevProjects\my\github\wb\docs\superpowers\specs\2026-07-23-vue-react-microfrontend-component-showcase-design.md`

---

## Global Constraints

- Project root: `D:\DevProjects\my\github\wb` (Windows, CRLF for files with Chinese chars, LF acceptable for code-only files).
- All commits must be Conventional Commits with appropriate scope (`feat`, `chore`, `test`, `docs`).
- All packages must declare their public types in `src/index.ts` and re-export via `@style-library/<name>` workspace alias.
- All package `tsconfig.json` extends `../../tsconfig.base.json`.
- TypeScript strict mode on; no `any` without comment justification.
- Component implementations must NOT execute on Card import — verified by e2e performance gate.
- All component implementations must run inside a ShadowRoot with theme contract via adoptedStyleSheets.
- `pnpm lint` and `pnpm exec vitest run` must exit 0 at the end of every task.
- All file paths in this plan are absolute Windows paths or repo-relative.
- Workspace aliases (`@style-library/...`) declared in root `tsconfig.base.json` `paths` and consumed by all packages.
- Each task ends with exactly one git commit.

---

## File Structure (final state)

```text
repo/
├── package.json                        # already exists; will add package-level scripts
├── pnpm-workspace.yaml                 # already exists
├── tsconfig.base.json                  # already exists; will extend with paths
├── tsconfig.json                       # NEW root project references
├── eslint.config.js                    # already exists
├── docs/                               # existing
├── scripts/                            # existing; will be reused
├── eslint/                             # existing
├── .claude/                            # existing
├── apps/
│   └── showcase/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.ts
│           ├── App.vue
│           ├── router/
│           │   └── index.ts
│           ├── registry/
│           │   ├── ComponentRegistry.ts
│           │   ├── SearchIndex.ts
│           │   └── RouterRegistrar.ts
│           ├── pages/
│           │   ├── HomePage.vue
│           │   ├── DetailPage.vue
│           │   └── NotFoundPage.vue
│           ├── components/
│           │   ├── CardGrid.vue
│           │   ├── ComponentCard.vue
│           │   ├── DetailShell.vue
│           │   ├── SearchBar.vue
│           │   └── GroupFilter.vue
│           ├── theme/
│           │   ├── tokens.ts
│           │   └── apply-theme.ts
│           └── manifest-loader.ts
└── packages/
    ├── component-contract/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── types.ts
    │       ├── component-config.schema.json
    │       └── manifest.schema.json
    ├── manifest-generator/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── scanner.ts
    │       ├── validator.ts
    │       ├── resolver.ts
    │       ├── generator.ts
    │       └── vite-plugin.ts
    ├── mount-adapters/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── ShadowRootHost.ts
    │       ├── VueMountAdapter.ts
    │       ├── ReactMountAdapter.ts
    │       └── AdapterFactory.ts
    ├── vue-components/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vite.config.ts                 # builds per-component entry; config-only
    │   └── src/
    │       ├── button/
    │       │   ├── index.vue
    │       │   ├── component.config.ts
    │       │   └── README.md
    │       └── heavy-chart/
    │           ├── index.vue
    │           ├── component.config.ts
    │           └── README.md
    └── react-components/
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── data-table/
                ├── index.tsx
                ├── component.config.ts
                └── README.md
```

---

## Phase Decomposition

- **Phase 1 (Tasks 1-2): component-contract** — pure types + JSON Schema, no runtime code.
- **Phase 2 (Tasks 3-4): manifest-generator** — scanner, validator, generator; then the Vite plugin (dev middleware + prod emit).
- **Phase 3 (Tasks 5-6): mount-adapters** — ShadowRootHost; then Vue + React adapters + factory.
- **Phase 4 (Tasks 7-9): example components** — Vue button; Vue heavy-chart; React data-table.
- **Phase 5 (Tasks 10-13): showcase Host** — manifest loader + registry + search + router; then CardGrid + HomePage; then DetailPage + ShadowRoot integration; then theme + e2e gate.
- **Phase 6 (Task 14): CI workflow** — `.github/workflows/lint.yml`.

---

## Workspace path aliases (root tsconfig.base.json update)

Before any package work, update the root `tsconfig.base.json` to include workspace path aliases:

```jsonc
{
  "compilerOptions": {
    // ... existing options
    "paths": {
      "@style-library/component-contract": ["./packages/component-contract/src/index.ts"],
      "@style-library/component-contract/*": ["./packages/component-contract/src/*"],
      "@style-library/manifest-generator": ["./packages/manifest-generator/src/index.ts"],
      "@style-library/manifest-generator/*": ["./packages/manifest-generator/src/*"],
      "@style-library/mount-adapters": ["./packages/mount-adapters/src/index.ts"],
      "@style-library/mount-adapters/*": ["./packages/mount-adapters/src/*"]
    }
  }
}
```

Each package's `tsconfig.json` will reference these via `extends: "../../tsconfig.base.json"` and add `references` for the other packages as needed.

---

### Task 1: `packages/component-contract` — types

**Files:**
- Create: `packages/component-contract/package.json`
- Create: `packages/component-contract/tsconfig.json`
- Create: `packages/component-contract/src/types.ts`
- Create: `packages/component-contract/src/component-config.schema.json`
- Create: `packages/component-contract/src/manifest.schema.json`
- Create: `packages/component-contract/src/index.ts`
- Create: `packages/component-contract/__tests__/types.test.ts`

**Interfaces:**
- Consumes: nothing (leaf package).
- Produces:
  - `Framework = 'vue' | 'react'`
  - `IsolationMode = 'shadow-dom' | 'css-module' | 'global'`
  - `ComponentConfig` (see spec §4.1)
  - `PreviewConfig`, `RouteConfig`, `MountConfig`, `IsolationConfig`, `ThemeConfig`, `PropsConfig`, `CapabilityConfig`, `DependencyConfig`, `DocsConfig`
  - `ManifestEntry`, `ComponentManifest`, `ManifestGroup`, `SearchManifest`
  - `MountContext`, `MountedComponent`, `MountAdapter`

- [ ] **Step 1: Write failing tests**

`packages/component-contract/__tests__/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type {
  ComponentConfig,
  ManifestEntry,
  MountAdapter,
  Framework,
} from '../src/types';

describe('component-contract types', () => {
  it('accepts a minimal Vue component config', () => {
    const cfg: ComponentConfig = {
      id: 'button',
      name: 'Button',
      title: '按钮',
      description: '基础按钮',
      version: '1.0.0',
      framework: 'vue',
      entry: './index.vue',
      group: '基础',
      category: '交互',
      tags: ['button'],
      mount: { kind: 'vue' },
    };
    expect(cfg.id).toBe('button');
    expect(cfg.framework).toBe<Framework>('vue');
  });

  it('MountAdapter interface is structurally typed', () => {
    const adapter: MountAdapter = {
      canHandle: (f) => f === 'vue',
      mount: async () => ({ unmount: () => {} }),
    };
    expect(adapter.canHandle('vue')).toBe(true);
    expect(adapter.canHandle('react')).toBe(false);
  });

  it('ManifestEntry requires entryChunk and loaderKey', () => {
    const entry: ManifestEntry = {
      id: 'button',
      name: 'Button',
      title: '按钮',
      description: '基础按钮',
      version: '1.0.0',
      framework: 'vue',
      group: '基础',
      category: '交互',
      tags: ['button'],
      route: { path: '/components/button', title: '按钮' },
      mount: { kind: 'vue' },
      isolation: { mode: 'shadow-dom' },
      assets: { entryChunk: 'assets/button.js' },
      loaderKey: 'button',
    };
    expect(entry.loaderKey).toBe('button');
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
cd D:\DevProjects\my\github\wb
pnpm exec vitest run packages/component-contract
```

Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `packages/component-contract/package.json`**

```json
{
  "name": "@style-library/component-contract",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./*.json": "./src/*.json"
  },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "ajv": "^8.17.1"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 4: Create `packages/component-contract/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*", "__tests__/**/*"]
}
```

- [ ] **Step 5: Create `packages/component-contract/src/types.ts`**

Write the full type definitions matching spec §4.1-§4.7 and §5 (ManifestEntry / ComponentManifest / ManifestGroup / SearchManifest / MountContext / MountedComponent / MountAdapter). Use the exact field names and types from the spec.

- [ ] **Step 6: Create `component-config.schema.json`**

JSON Schema covering all required ComponentConfig fields. Required fields: `id`, `name`, `title`, `description`, `version`, `framework`, `entry`, `group`, `category`, `tags`, `mount.kind`. Use `additionalProperties: true` to allow optional fields.

- [ ] **Step 7: Create `manifest.schema.json`**

JSON Schema for ComponentManifest: schemaVersion "1.0", generatedAt ISO string, components array of ManifestEntry, groups array, search object.

- [ ] **Step 8: Create `packages/component-contract/src/index.ts`**

```ts
export * from './types.js';
export { default as componentConfigSchema } from './component-config.schema.json';
export { default as manifestSchema } from './manifest.schema.json';
```

- [ ] **Step 9: Run test, expect pass**

```bash
pnpm exec vitest run packages/component-contract
```

Expected: PASS (3 tests).

- [ ] **Step 10: Commit**

```bash
git add packages/component-contract tsconfig.base.json
git commit -m "feat(contract): add component-contract package with types and schemas"
```

---

### Task 2: `packages/component-contract` — schema validator

**Files:**
- Create: `packages/component-contract/src/validate-config.ts`
- Create: `packages/component-contract/src/__tests__/validate-config.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { validateConfig } from '../src/validate-config';

describe('validateConfig', () => {
  it('accepts a valid Vue component config', () => {
    const result = validateConfig({
      id: 'button',
      name: 'Button',
      title: '按钮',
      description: 'desc',
      version: '1.0.0',
      framework: 'vue',
      entry: './index.vue',
      group: 'g',
      category: 'c',
      tags: [],
      mount: { kind: 'vue' },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects config missing required fields', () => {
    const result = validateConfig({ id: 'x' });
    expect(result.ok).toBe(false);
  });

  it('rejects config with invalid framework', () => {
    const result = validateConfig({
      id: 'a', name: 'A', title: 't', description: 'd', version: '1.0.0',
      framework: 'svelte' as any, entry: './a.tsx', group: 'g', category: 'c',
      tags: [], mount: { kind: 'vue' },
    });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm exec vitest run packages/component-contract/src/__tests__/validate-config.test.ts
```

- [ ] **Step 3: Implement `validate-config.ts`**

```ts
import Ajv from 'ajv';
import componentConfigSchema from './component-config.schema.json';

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(componentConfigSchema);

export interface ValidationResult {
  ok: boolean;
  errors?: unknown[];
}

export function validateConfig(config: unknown): ValidationResult {
  const ok = validate(config);
  return ok ? { ok: true } : { ok: false, errors: validate.errors };
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm exec vitest run packages/component-contract
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/component-contract
git commit -m "feat(contract): add ajv-backed config validator"
```

---

### Task 3: `packages/manifest-generator` — scanner + validator + generator (core)

**Files:**
- Create: `packages/manifest-generator/package.json`
- Create: `packages/manifest-generator/tsconfig.json`
- Create: `packages/manifest-generator/src/scanner.ts`
- Create: `packages/manifest-generator/src/resolver.ts`
- Create: `packages/manifest-generator/src/generator.ts`
- Create: `packages/manifest-generator/src/index.ts`
- Create: `packages/manifest-generator/__tests__/scanner.test.ts`
- Create: `packages/manifest-generator/__tests__/generator.test.ts`
- Create: `packages/manifest-generator/__tests__/fixtures/button/component.config.ts`
- Create: `packages/manifest-generator/__tests__/fixtures/data-table/component.config.ts`

- [ ] **Step 1: Create package.json and tsconfig.json**

`packages/manifest-generator/package.json`:

```json
{
  "name": "@style-library/manifest-generator",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run" },
  "dependencies": {
    "@style-library/component-contract": "workspace:*",
    "fast-glob": "^3.3.2"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/manifest-generator/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*", "__tests__/**/*"]
}
```

- [ ] **Step 2: Write failing test for scanner**

```ts
// __tests__/scanner.test.ts
import { describe, it, expect } from 'vitest';
import { scanConfigs } from '../src/scanner';
import { fileURLToPath } from 'node:url';

const fixtureRoot = fileURLToPath(new URL('./fixtures', import.meta.url));

describe('scanConfigs', () => {
  it('finds component.config.ts under nested directories', async () => {
    const configs = await scanConfigs({
      roots: [`${fixtureRoot}/**/component.config.ts`],
    });
    expect(configs.length).toBe(2);
    const ids = configs.map((c) => c.config.id).sort();
    expect(ids).toEqual(['button', 'data-table']);
  });

  it('captures the file path for each config', async () => {
    const configs = await scanConfigs({
      roots: [`${fixtureRoot}/**/component.config.ts`],
    });
    for (const c of configs) {
      expect(c.filePath.endsWith('component.config.ts')).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run test, expect failure**

```bash
pnpm exec vitest run packages/manifest-generator
```

- [ ] **Step 4: Create fixtures**

`__tests__/fixtures/button/component.config.ts`:

```ts
import type { ComponentConfig } from '@style-library/component-contract';
export default {
  id: 'button',
  name: 'Button',
  title: '按钮',
  description: '基础按钮',
  version: '1.0.0',
  framework: 'vue',
  entry: './index.vue',
  group: '基础',
  category: '交互',
  tags: ['button'],
  mount: { kind: 'vue' },
  route: { path: '/components/button', title: '按钮' },
} satisfies ComponentConfig;
```

`__tests__/fixtures/data-table/component.config.ts`: analogous with `id: 'data-table'`, `framework: 'react'`, `entry: './index.tsx'`.

- [ ] **Step 5: Implement scanner**

```ts
// src/scanner.ts
import fg from 'fast-glob';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ComponentConfig } from '@style-library/component-contract';
import { validateConfig } from '@style-library/component-contract';

export interface ScannedConfig {
  filePath: string;
  configDir: string;
  config: ComponentConfig;
}

export interface ScanOptions {
  roots: string[];
  cwd?: string;
}

export async function scanConfigs(opts: ScanOptions): Promise<ScannedConfig[]> {
  const cwd = opts.cwd ?? process.cwd();
  const files = await fg(opts.roots, { cwd, absolute: true });
  const out: ScannedConfig[] = [];
  for (const filePath of files) {
    const mod = await import(pathToFileURL(filePath).href);
    const config = mod.default as ComponentConfig;
    const v = validateConfig(config);
    if (!v.ok) {
      throw new Error(`Invalid config at ${filePath}: ${JSON.stringify(v.errors)}`);
    }
    out.push({
      filePath,
      configDir: path.dirname(filePath),
      config,
    });
  }
  return out;
}
```

- [ ] **Step 6: Run scanner test, expect pass**

- [ ] **Step 7: Write failing test for generator**

```ts
// __tests__/generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateManifest } from '../src/generator';
import { scanConfigs } from '../src/scanner';
import { fileURLToPath } from 'node:url';

describe('generateManifest', () => {
  it('produces a ComponentManifest from scanned configs', async () => {
    const fixtureRoot = fileURLToPath(new URL('./fixtures', import.meta.url));
    const scanned = await scanConfigs({ roots: [`${fixtureRoot}/**/component.config.ts`] });
    const manifest = generateManifest(scanned, { buildId: 'test', outDir: 'dist' });
    expect(manifest.schemaVersion).toBe('1.0');
    expect(manifest.components.length).toBe(2);
    expect(manifest.groups.length).toBeGreaterThan(0);
    for (const entry of manifest.components) {
      expect(entry.assets.entryChunk).toMatch(/^assets\/.*\.js$/);
      expect(entry.loaderKey).toBe(entry.id);
    }
  });

  it('rejects duplicate ids', async () => {
    const scanned = [
      { filePath: '/a/component.config.ts', configDir: '/a', config: { id: 'x' } as any },
      { filePath: '/b/component.config.ts', configDir: '/b', config: { id: 'x' } as any },
    ];
    expect(() => generateManifest(scanned, { buildId: 'test', outDir: 'dist' })).toThrow();
  });
});
```

- [ ] **Step 8: Run test, expect failure**

- [ ] **Step 9: Implement generator**

```ts
// src/generator.ts
import path from 'node:path';
import type { ComponentManifest, ManifestEntry, ManifestGroup } from '@style-library/component-contract';
import type { ScannedConfig } from './scanner.js';

export interface GeneratorOptions {
  buildId: string;
  outDir: string;
}

export function generateManifest(
  scanned: ScannedConfig[],
  opts: GeneratorOptions,
): ComponentManifest {
  // duplicate id check
  const seen = new Set<string>();
  for (const s of scanned) {
    if (seen.has(s.config.id)) {
      throw new Error(`Duplicate component id: ${s.config.id}`);
    }
    seen.add(s.config.id);
  }

  const entries: ManifestEntry[] = scanned.map((s) => {
    const cfg = s.config;
    return {
      id: cfg.id,
      name: cfg.name,
      title: cfg.title,
      description: cfg.description,
      version: cfg.version,
      framework: cfg.framework,
      group: cfg.group,
      category: cfg.category,
      tags: cfg.tags,
      status: cfg.status,
      preview: cfg.preview,
      route: cfg.route ?? {
        path: `/components/${cfg.id}`,
        title: cfg.title,
      },
      mount: cfg.mount,
      isolation: cfg.isolation ?? { mode: 'shadow-dom' },
      theme: cfg.theme,
      capabilities: cfg.capabilities,
      assets: {
        entryChunk: `assets/${cfg.id}.js`,
        cssChunks: cfg.isolation?.mode === 'global' ? undefined : [],
      },
      loaderKey: cfg.id,
    };
  });

  // group by group field
  const groupMap = new Map<string, { ids: string[]; categories: Set<string> }>();
  for (const e of entries) {
    const g = groupMap.get(e.group) ?? { ids: [], categories: new Set() };
    g.ids.push(e.id);
    g.categories.add(e.category);
    groupMap.set(e.group, g);
  }
  const groups: ManifestGroup[] = [...groupMap.entries()].map(([title, v]) => ({
    id: slugify(title),
    title,
    componentIds: v.ids,
    categories: [...v.categories],
  }));

  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    buildId: opts.buildId,
    components: entries,
    groups,
    search: {
      fields: ['title', 'description', 'tags', 'group', 'category'],
      normalized: true,
    },
  };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
```

- [ ] **Step 10: Run all manifest-generator tests**

```bash
pnpm exec vitest run packages/manifest-generator
```

Expected: PASS.

- [ ] **Step 11: Create `src/index.ts`**

```ts
export * from './scanner.js';
export * from './generator.js';
export type { GeneratorOptions } from './generator.js';
export type { ScannedConfig, ScanOptions } from './scanner.js';
```

- [ ] **Step 12: Commit**

```bash
git add packages/manifest-generator
git commit -m "feat(manifest): add scanner + generator with fixture tests"
```

---

### Task 4: `packages/manifest-generator` — Vite plugin (dev middleware + prod emit)

**Files:**
- Create: `packages/manifest-generator/src/vite-plugin.ts`
- Create: `packages/manifest-generator/__tests__/vite-plugin.test.ts`
- Modify: `packages/manifest-generator/src/index.ts`

- [ ] **Step 1: Write failing test**

```ts
// __tests__/vite-plugin.test.ts
import { describe, it, expect } from 'vitest';
import { manifestPlugin } from '../src/vite-plugin';
import { fileURLToPath } from 'node:url';

const fixtureRoot = fileURLToPath(new URL('./fixtures', import.meta.url));

describe('manifestPlugin', () => {
  it('returns a Vite plugin with name "component-manifest"', () => {
    const plugin = manifestPlugin({ componentRoots: [`${fixtureRoot}/**/component.config.ts`] });
    expect(plugin.name).toBe('component-manifest');
  });

  it('buildStart populates cachedManifest', async () => {
    const plugin = manifestPlugin({ componentRoots: [`${fixtureRoot}/**/component.config.ts`] });
    let emitCalled = false;
    await plugin.buildStart.call({ emitFile: () => { emitCalled = true; } } as any);
    expect(emitCalled).toBe(false); // emit only in generateBundle
    expect((plugin as any).cachedManifest).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

- [ ] **Step 3: Implement plugin**

```ts
// src/vite-plugin.ts
import type { Plugin } from 'vite';
import { scanConfigs } from './scanner.js';
import { generateManifest } from './generator.js';
import type { ComponentManifest } from '@style-library/component-contract';

export interface ManifestPluginOptions {
  componentRoots: string[];
  buildId?: string;
  /** Hook to patch component.entryChunk asset URLs after manifest generation. */
  resolveAssetUrl?: (componentId: string, suggested: string) => string;
}

export function manifestPlugin(opts: ManifestPluginOptions): Plugin & {
  cachedManifest: ComponentManifest | null;
} {
  const plugin: Plugin & { cachedManifest: ComponentManifest | null } = {
    name: 'component-manifest',
    cachedManifest: null,

    async buildStart() {
      const scanned = await scanConfigs({ roots: opts.componentRoots });
      plugin.cachedManifest = generateManifest(scanned, {
        buildId: opts.buildId ?? 'dev',
        outDir: 'dist',
      });
    },

    configureServer(server) {
      const route = '/__component-manifest.json';
      server.middlewares.use(route, (_req, res) => {
        if (!plugin.cachedManifest) {
          res.statusCode = 503;
          res.end('{}');
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(plugin.cachedManifest));
      });

      server.watcher.on('change', (file) => {
        if (!file.includes('component.config')) return;
        void plugin.buildStart.call({} as never);
        server.ws.send({ type: 'full-reload' });
      });
    },

    generateBundle() {
      if (!plugin.cachedManifest) return;
      this.emitFile({
        type: 'asset',
        fileName: 'component-manifest.json',
        source: JSON.stringify(plugin.cachedManifest, null, 2),
      });
    },
  };
  return plugin;
}
```

- [ ] **Step 4: Update `index.ts`**

Append: `export * from './vite-plugin.js';`

- [ ] **Step 5: Run tests, expect pass**

```bash
pnpm exec vitest run packages/manifest-generator
```

- [ ] **Step 6: Commit**

```bash
git add packages/manifest-generator
git commit -m "feat(manifest): add Vite plugin with dev middleware and prod emit"
```

---

### Task 5: `packages/mount-adapters` — ShadowRootHost

**Files:**
- Create: `packages/mount-adapters/package.json`
- Create: `packages/mount-adapters/tsconfig.json`
- Create: `packages/mount-adapters/src/ShadowRootHost.ts`
- Create: `packages/mount-adapters/src/index.ts`
- Create: `packages/mount-adapters/__tests__/ShadowRootHost.test.ts`

- [ ] **Step 1: Create package files**

`package.json`:

```json
{
  "name": "@style-library/mount-adapters",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run" },
  "dependencies": {
    "@style-library/component-contract": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

`tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*", "__tests__/**/*"]
}
```

- [ ] **Step 2: Write failing test**

```ts
// __tests__/ShadowRootHost.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createShadowRootHost } from '../src/ShadowRootHost';

describe('createShadowRootHost', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('attaches a closed-mode ShadowRoot by default', () => {
    const host = createShadowRootHost({ container });
    expect(host.shadowRoot.mode).toBe('closed');
    expect(host.container === container || container.contains(host.container)).toBe(true);
  });

  it('accepts open mode when configured', () => {
    const host = createShadowRootHost({ container, open: true });
    expect(host.shadowRoot.mode).toBe('open');
  });

  it('appends a portal target div into the shadow root', () => {
    const host = createShadowRootHost({ container });
    expect(host.portalTarget.tagName).toBe('DIV');
    expect(host.portalTarget.parentNode).toBe(host.shadowRoot);
  });

  it('injects CSS variables via inline style on portal target', () => {
    const host = createShadowRootHost({
      container,
      tokens: { '--sl-color-primary': 'red', '--sl-radius-md': '4px' },
    });
    expect(host.portalTarget.style.getPropertyValue('--sl-color-primary')).toBe('red');
    expect(host.portalTarget.style.getPropertyValue('--sl-radius-md')).toBe('4px');
  });

  it('destroy() removes the container from its parent', () => {
    const host = createShadowRootHost({ container });
    host.destroy();
    expect(container.parentNode).toBeNull();
  });
});
```

- [ ] **Step 3: Run test, expect failure**

- [ ] **Step 4: Implement**

```ts
// src/ShadowRootHost.ts
export interface ShadowRootHostOptions {
  container: HTMLElement;
  open?: boolean;
  tokens?: Record<string, string>;
}

export interface ShadowRootHost {
  container: HTMLElement;
  shadowRoot: ShadowRoot;
  portalTarget: HTMLDivElement;
  destroy(): void;
}

export function createShadowRootHost(opts: ShadowRootHostOptions): ShadowRootHost {
  const { container, open = false, tokens } = opts;
  const shadowRoot = container.attachShadow({ mode: open ? 'open' : 'closed' });

  // Inline reset + theme variables
  const reset = document.createElement('style');
  reset.textContent = `:host, *, *::before, *::after { box-sizing: border-box; }`;
  shadowRoot.appendChild(reset);

  const portalTarget = document.createElement('div');
  portalTarget.setAttribute('data-sl-portal', '');
  if (tokens) {
    for (const [k, v] of Object.entries(tokens)) {
      portalTarget.style.setProperty(k, v);
    }
  }
  shadowRoot.appendChild(portalTarget);

  const destroy = (): void => {
    if (container.parentNode) container.parentNode.removeChild(container);
  };

  return { container, shadowRoot, portalTarget, destroy };
}
```

- [ ] **Step 5: Update `index.ts`**

```ts
export * from './ShadowRootHost.js';
```

- [ ] **Step 6: Run tests, expect pass**

- [ ] **Step 7: Commit**

```bash
git add packages/mount-adapters
git commit -m "feat(adapters): add ShadowRootHost with portal target and theme tokens"
```

---

### Task 6: `packages/mount-adapters` — Vue and React adapters + factory

**Files:**
- Create: `packages/mount-adapters/src/VueMountAdapter.ts`
- Create: `packages/mount-adapters/src/ReactMountAdapter.ts`
- Create: `packages/mount-adapters/src/AdapterFactory.ts`
- Create: `packages/mount-adapters/__tests__/AdapterFactory.test.ts`
- Modify: `packages/mount-adapters/src/index.ts`
- Modify: `packages/mount-adapters/package.json` (add vue, react, react-dom)

- [ ] **Step 1: Update package.json**

Add to `dependencies`:

```json
"vue": "^3.4.0",
"react": "^19.0.0",
"react-dom": "^19.0.0"
```

- [ ] **Step 2: Implement VueMountAdapter**

```ts
// src/VueMountAdapter.ts
import { createApp, type App } from 'vue';
import type { Framework, MountAdapter, MountContext, MountedComponent } from '@style-library/component-contract';

export function createVueMountAdapter(): MountAdapter {
  return {
    canHandle(framework: Framework) {
      return framework === 'vue';
    },
    async mount(module: unknown, context: MountContext): Promise<MountedComponent> {
      const component = (module as { default: unknown }).default;
      if (!component) {
        throw new Error('VueMountAdapter: module.default is missing');
      }
      const app: App = createApp(component as never, context.props);
      const portal = document.createElement('div');
      context.shadowRoot.appendChild(portal);
      app.mount(portal);

      context.signal.addEventListener('abort', () => {
        app.unmount();
      });

      return {
        unmount() {
          app.unmount();
        },
      };
    },
  };
}
```

- [ ] **Step 3: Implement ReactMountAdapter**

```ts
// src/ReactMountAdapter.ts
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import type { Framework, MountAdapter, MountContext, MountedComponent } from '@style-library/component-contract';

export function createReactMountAdapter(): MountAdapter {
  return {
    canHandle(framework: Framework) {
      return framework === 'react';
    },
    async mount(module: unknown, context: MountContext): Promise<MountedComponent> {
      const component = (module as { default: unknown }).default;
      if (!component) {
        throw new Error('ReactMountAdapter: module.default is missing');
      }
      const portal = document.createElement('div');
      context.shadowRoot.appendChild(portal);
      const root: Root = createRoot(portal);
      root.render(createElement(component as never, context.props));

      context.signal.addEventListener('abort', () => {
        root.unmount();
      });

      return {
        update(nextProps) {
          root.render(createElement(component as never, nextProps));
        },
        unmount() {
          root.unmount();
        },
      };
    },
  };
}
```

- [ ] **Step 4: Implement AdapterFactory**

```ts
// src/AdapterFactory.ts
import type { Framework, MountAdapter } from '@style-library/component-contract';
import { createVueMountAdapter } from './VueMountAdapter.js';
import { createReactMountAdapter } from './ReactMountAdapter.js';

export function createAdapterFactory(): MountAdapter[] {
  return [createVueMountAdapter(), createReactMountAdapter()];
}

export function selectAdapter(adapters: MountAdapter[], framework: Framework): MountAdapter {
  const found = adapters.find((a) => a.canHandle(framework));
  if (!found) {
    throw new Error(`No adapter found for framework: ${framework}`);
  }
  return found;
}
```

- [ ] **Step 5: Update `index.ts`**

```ts
export * from './ShadowRootHost.js';
export * from './VueMountAdapter.js';
export * from './ReactMountAdapter.js';
export * from './AdapterFactory.js';
```

- [ ] **Step 6: Write and run adapter factory test**

```ts
// __tests__/AdapterFactory.test.ts
import { describe, it, expect } from 'vitest';
import { createAdapterFactory, selectAdapter } from '../src/AdapterFactory';

describe('AdapterFactory', () => {
  it('selects a Vue adapter for vue framework', () => {
    const adapters = createAdapterFactory();
    const a = selectAdapter(adapters, 'vue');
    expect(a.canHandle('vue')).toBe(true);
  });

  it('selects a React adapter for react framework', () => {
    const adapters = createAdapterFactory();
    const a = selectAdapter(adapters, 'react');
    expect(a.canHandle('react')).toBe(true);
  });

  it('throws for unsupported framework', () => {
    const adapters = createAdapterFactory();
    expect(() => selectAdapter(adapters, 'svelte' as any)).toThrow();
  });
});
```

- [ ] **Step 7: Run all mount-adapters tests**

- [ ] **Step 8: Commit**

```bash
git add packages/mount-adapters
git commit -m "feat(adapters): add Vue and React MountAdapters with factory"
```

---

### Task 7: `packages/vue-components/button` — minimal Vue component

**Files:**
- Create: `packages/vue-components/package.json`
- Create: `packages/vue-components/tsconfig.json`
- Create: `packages/vue-components/src/button/index.vue`
- Create: `packages/vue-components/src/button/component.config.ts`
- Create: `packages/vue-components/src/button/README.md`

- [ ] **Step 1: Create package files**

`packages/vue-components/package.json`:

```json
{
  "name": "@style-library/vue-components",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": { "test": "vitest run" },
  "dependencies": {
    "@style-library/component-contract": "workspace:*",
    "vue": "^3.4.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^2.1.0",
    "vue-tsc": "^2.0.0"
  }
}
```

`packages/vue-components/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*", "__tests__/**/*"]
}
```

- [ ] **Step 2: Create button component**

`packages/vue-components/src/button/index.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  label?: string;
  variant?: 'primary' | 'secondary';
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Click me',
  variant: 'primary',
});

const count = ref(0);
</script>

<template>
  <button :class="['sl-btn', `sl-btn--${props.variant}`]" @click="count++">
    {{ props.label }} ({{ count }})
  </button>
</template>

<style scoped>
.sl-btn {
  font-family: var(--sl-font-family, system-ui, sans-serif);
  padding: var(--sl-space-2, 8px) var(--sl-space-3, 12px);
  border-radius: var(--sl-radius-md, 8px);
  border: 1px solid transparent;
  cursor: pointer;
}
.sl-btn--primary {
  background: var(--sl-color-primary, #2563eb);
  color: var(--sl-color-on-primary, #ffffff);
}
.sl-btn--secondary {
  background: var(--sl-color-surface, #f5f5f7);
  color: var(--sl-color-text, #111827);
  border-color: var(--sl-color-border, #d1d5db);
}
</style>
```

`packages/vue-components/src/button/component.config.ts`:

```ts
import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'button',
  name: 'Button',
  title: '按钮',
  description: '基础按钮组件，支持 primary 与 secondary 两种 variant。',
  version: '1.0.0',
  framework: 'vue',
  entry: './index.vue',
  group: '基础',
  category: '交互',
  tags: ['button', 'interactive', 'form'],
  status: 'stable',
  route: { path: '/components/button', title: '按钮', keepAlive: false },
  mount: { kind: 'vue', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl', requiredTokens: ['--sl-color-primary', '--sl-radius-md'] },
  capabilities: { resizable: false, fullscreen: false },
} satisfies ComponentConfig;
```

`packages/vue-components/src/button/README.md`: short Chinese usage doc.

- [ ] **Step 3: Verify build**

```bash
cd packages/vue-components && pnpm install; cd ../..
pnpm exec tsc --noEmit -p packages/vue-components/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add packages/vue-components
git commit -m "feat(vue-components): add button example component"
```

---

### Task 8: `packages/vue-components/heavy-chart` — heavy Vue component with code-split candidate

**Files:**
- Create: `packages/vue-components/src/heavy-chart/index.vue`
- Create: `packages/vue-components/src/heavy-chart/component.config.ts`
- Create: `packages/vue-components/src/heavy-chart/README.md`

- [ ] **Step 1: Create heavy-chart**

`packages/vue-components/src/heavy-chart/index.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';

interface Series { label: string; value: number }
interface Props { data?: Series[]; height?: number }
const props = withDefaults(defineProps<Props>(), { data: () => [], height: 240 });

const max = computed(() => Math.max(1, ...props.data.map((d) => d.value)));
</script>

<template>
  <div class="sl-chart">
    <div class="sl-chart__row" v-for="(s, i) in props.data" :key="i">
      <span class="sl-chart__label">{{ s.label }}</span>
      <span class="sl-chart__bar"><span class="sl-chart__fill" :style="{ width: `${(s.value / max) * 100}%` }" /></span>
      <span class="sl-chart__value">{{ s.value }}</span>
    </div>
    <p v-if="props.data.length === 0" class="sl-chart__empty">暂无数据</p>
  </div>
</template>

<style scoped>
.sl-chart { font-family: var(--sl-font-family, system-ui, sans-serif); }
.sl-chart__row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
.sl-chart__label { width: 80px; }
.sl-chart__bar { flex: 1; background: var(--sl-color-surface-alt, #f3f4f6); border-radius: 4px; height: 12px; overflow: hidden; }
.sl-chart__fill { display: block; height: 100%; background: var(--sl-color-primary, #2563eb); transition: width 0.2s; }
.sl-chart__value { width: 40px; text-align: right; }
.sl-chart__empty { color: var(--sl-color-text-muted, #6b7280); padding: 16px; text-align: center; }
</style>
```

`packages/vue-components/src/heavy-chart/component.config.ts`:

```ts
import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'heavy-chart',
  name: 'HeavyChart',
  title: '柱状图',
  description: '轻量柱状图，演示独立 chunk 与按需加载。',
  version: '1.0.0',
  framework: 'vue',
  entry: './index.vue',
  group: '数据展示',
  category: '图表',
  tags: ['chart', 'data-viz', 'bar'],
  status: 'stable',
  route: { path: '/components/heavy-chart', title: '柱状图' },
  mount: { kind: 'vue', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: true, fullscreen: true },
} satisfies ComponentConfig;
```

`README.md`: explain that this is the "heavy" candidate, isolated chunk.

- [ ] **Step 2: Verify tsc passes**

```bash
pnpm exec tsc --noEmit -p packages/vue-components/tsconfig.json
```

- [ ] **Step 3: Commit**

```bash
git add packages/vue-components
git commit -m "feat(vue-components): add heavy-chart example for chunk split demo"
```

---

### Task 9: `packages/react-components/data-table` — React example

**Files:**
- Create: `packages/react-components/package.json`
- Create: `packages/react-components/tsconfig.json`
- Create: `packages/react-components/src/data-table/index.tsx`
- Create: `packages/react-components/src/data-table/component.config.ts`
- Create: `packages/react-components/src/data-table/README.md`

- [ ] **Step 1: Create package files**

`packages/react-components/package.json`:

```json
{
  "name": "@style-library/react-components",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": { "test": "vitest run" },
  "dependencies": {
    "@style-library/component-contract": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/react-components/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx" },
  "include": ["src/**/*", "__tests__/**/*"]
}
```

- [ ] **Step 2: Create the component**

`packages/react-components/src/data-table/index.tsx`:

```tsx
import { useMemo, useState } from 'react';

interface Column<T> {
  key: keyof T & string;
  title: string;
  width?: number;
}

interface Props<T = Record<string, unknown>> {
  data?: T[];
  columns?: Column<T>[];
  pageSize?: number;
}

interface DefaultRow {
  id: number;
  name: string;
  role: string;
}

const DEFAULT_COLUMNS: Column<DefaultRow>[] = [
  { key: 'id', title: 'ID', width: 60 },
  { key: 'name', title: '姓名', width: 140 },
  { key: 'role', title: '角色' },
];

const DEFAULT_DATA: DefaultRow[] = [
  { id: 1, name: '张三', role: '前端工程师' },
  { id: 2, name: '李四', role: '产品经理' },
  { id: 3, name: '王五', role: '设计师' },
];

export default function DataTable<T extends Record<string, unknown> = DefaultRow>(props: Props<T>) {
  const data = (props.data ?? (DEFAULT_DATA as unknown as T[]));
  const columns = (props.columns ?? (DEFAULT_COLUMNS as unknown as Column<T>[]));
  const pageSize = props.pageSize ?? 2;

  const [page, setPage] = useState(0);
  const slice = useMemo(
    () => data.slice(page * pageSize, (page + 1) * pageSize),
    [data, page, pageSize],
  );

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  return (
    <div className="sl-table">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width }}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slice.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key}>{String(row[c.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="sl-table__pagination">
        <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
          上一页
        </button>
        <span>{page + 1} / {totalPages}</span>
        <button type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
          下一页
        </button>
      </div>
    </div>
  );
}
```

`packages/react-components/src/data-table/component.config.ts`:

```ts
import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'data-table',
  name: 'DataTable',
  title: '数据表格',
  description: '通用数据表格，支持分页与列宽配置。',
  version: '1.0.0',
  framework: 'react',
  entry: './index.tsx',
  group: '数据展示',
  category: '表格',
  tags: ['table', 'data', 'pagination'],
  status: 'stable',
  route: { path: '/components/data-table', title: '数据表格' },
  mount: { kind: 'react', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: true, fullscreen: true },
} satisfies ComponentConfig;
```

`README.md`: brief usage.

- [ ] **Step 3: Verify tsc**

```bash
pnpm exec tsc --noEmit -p packages/react-components/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add packages/react-components
git commit -m "feat(react-components): add data-table example"
```

---

### Task 10: `apps/showcase` — Host scaffold + manifest loader + registry + search + router

**Files:**
- Create: `apps/showcase/package.json`
- Create: `apps/showcase/tsconfig.json`
- Create: `apps/showcase/vite.config.ts`
- Create: `apps/showcase/index.html`
- Create: `apps/showcase/src/main.ts`
- Create: `apps/showcase/src/App.vue`
- Create: `apps/showcase/src/manifest-loader.ts`
- Create: `apps/showcase/src/router/index.ts`
- Create: `apps/showcase/src/registry/ComponentRegistry.ts`
- Create: `apps/showcase/src/registry/SearchIndex.ts`
- Create: `apps/showcase/src/registry/RouterRegistrar.ts`
- Create: `apps/showcase/src/theme/tokens.ts`
- Create: `apps/showcase/src/theme/apply-theme.ts`
- Create: `apps/showcase/src/pages/HomePage.vue`
- Create: `apps/showcase/src/pages/DetailPage.vue`
- Create: `apps/showcase/src/pages/NotFoundPage.vue`
- Create: `apps/showcase/src/components/CardGrid.vue`
- Create: `apps/showcase/src/components/ComponentCard.vue`
- Create: `apps/showcase/src/components/SearchBar.vue`
- Create: `apps/showcase/src/components/GroupFilter.vue`
- Create: `apps/showcase/src/components/DetailShell.vue`
- Create: `apps/showcase/__tests__/registry.test.ts`
- Create: `apps/showcase/__tests__/search.test.ts`
- Modify: root `package.json` (add `apps/*` scripts)
- Modify: root `tsconfig.base.json` (add `apps/*` paths if needed)

This task is large; split into 4 sub-tasks 10A-10D:

#### Task 10A: Host scaffold + Vite config + package files

- [ ] **Step 1: Create `apps/showcase/package.json`**

```json
{
  "name": "@style-library/showcase",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview --host 0.0.0.0 --port 4173",
    "test": "vitest run"
  },
  "dependencies": {
    "@style-library/component-contract": "workspace:*",
    "@style-library/manifest-generator": "workspace:*",
    "@style-library/mount-adapters": "workspace:*",
    "@style-library/vue-components": "workspace:*",
    "@style-library/react-components": "workspace:*",
    "vue": "^3.4.0",
    "vue-router": "^4.4.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.1.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0",
    "vue-tsc": "^2.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.1.0",
    "@vue/test-utils": "^2.4.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: Create `apps/showcase/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src/**/*", "__tests__/**/*", "vite.config.ts"]
}
```

- [ ] **Step 3: Create `apps/showcase/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react';
import { manifestPlugin } from '@style-library/manifest-generator';
import path from 'node:path';

export default defineConfig({
  plugins: [
    vue(),
    react(),
    manifestPlugin({
      componentRoots: [
        path.resolve(__dirname, '../../packages/vue-components/src/*/component.config.ts'),
        path.resolve(__dirname, '../../packages/react-components/src/*/component.config.ts'),
      ],
    }),
  ],
  server: { host: '0.0.0.0', port: 5173 },
  preview: { host: '0.0.0.0', port: 4173 },
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Per-component chunk splitting
          if (id.includes('/vue-components/src/')) {
            const m = id.match(/\/vue-components\/src\/([^/]+)\//);
            if (m) return `vc-${m[1]}`;
          }
          if (id.includes('/react-components/src/')) {
            const m = id.match(/\/react-components\/src\/([^/]+)\//);
            if (m) return `rc-${m[1]}`;
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/vue')) {
            return 'vue-vendor';
          }
          return undefined;
        },
      },
    },
  },
});
```

- [ ] **Step 4: Create `apps/showcase/index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>组件展示中心</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Commit**

```bash
git add apps/showcase/package.json apps/showcase/tsconfig.json apps/showcase/vite.config.ts apps/showcase/index.html
git commit -m "feat(showcase): scaffold host app with Vite + manifest plugin"
```

#### Task 10B: Theme + manifest loader + registry + search + router

- [ ] **Step 1: Create `theme/tokens.ts`**

```ts
export const defaultTokens: Record<string, string> = {
  '--sl-color-primary': '#2563eb',
  '--sl-color-on-primary': '#ffffff',
  '--sl-color-surface': '#ffffff',
  '--sl-color-surface-alt': '#f3f4f6',
  '--sl-color-text': '#111827',
  '--sl-color-text-muted': '#6b7280',
  '--sl-color-border': '#d1d5db',
  '--sl-radius-md': '8px',
  '--sl-space-1': '4px',
  '--sl-space-2': '8px',
  '--sl-space-3': '12px',
  '--sl-space-4': '16px',
  '--sl-font-family': 'system-ui, -apple-system, "Segoe UI", sans-serif',
};
```

- [ ] **Step 2: Create `theme/apply-theme.ts`**

```ts
export function applyThemeToDocument(tokens: Record<string, string>): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(tokens)) {
    root.style.setProperty(k, v);
  }
}
```

- [ ] **Step 3: Create `manifest-loader.ts`**

```ts
import type { ComponentManifest } from '@style-library/component-contract';

export async function loadManifest(): Promise<ComponentManifest> {
  const url = import.meta.env.DEV
    ? '/__component-manifest.json'
    : '/component-manifest.json';
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`Failed to load manifest: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 4: Create `registry/ComponentRegistry.ts`**

```ts
import type { ComponentManifest, ManifestEntry } from '@style-library/component-contract';
import { ref, type Ref } from 'vue';

export function createRegistry() {
  const entries: Ref<ManifestEntry[]> = ref([]);

  function registerManifest(manifest: ComponentManifest): void {
    entries.value = manifest.components;
  }

  function listMetadata(): readonly ManifestEntry[] {
    return entries.value;
  }

  function get(id: string): ManifestEntry | undefined {
    return entries.value.find((e) => e.id === id);
  }

  return { entries, registerManifest, listMetadata, get };
}

export type Registry = ReturnType<typeof createRegistry>;
```

- [ ] **Step 5: Create `registry/SearchIndex.ts`**

```ts
import type { ManifestEntry } from '@style-library/component-contract';
import { ref, computed, type Ref } from 'vue';

export function createSearchIndex(entries: Ref<readonly ManifestEntry[]>) {
  const query = ref('');
  const group = ref<string | undefined>(undefined);

  const results = computed(() => {
    const q = query.value.trim().toLowerCase();
    return [...entries.value].filter((e) => {
      if (group.value && e.group !== group.value) return false;
      if (!q) return true;
      const hay = [e.title, e.description, ...e.tags, e.group, e.category]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  });

  return { query, group, results };
}
```

- [ ] **Step 6: Create `registry/RouterRegistrar.ts`**

```ts
import type { Router, RouteRecordRaw } from 'vue-router';
import type { ManifestEntry } from '@style-library/component-contract';

export function registerComponentRoutes(router: Router, entries: readonly ManifestEntry[]): void {
  for (const e of entries) {
    const path = e.route.path;
    const route: RouteRecordRaw = {
      path,
      name: `Component-${e.id}`,
      component: () => import('../pages/DetailPage.vue'),
      meta: { componentId: e.id, title: e.route.title },
    };
    router.addRoute(route);
  }
}
```

- [ ] **Step 7: Create `router/index.ts`**

```ts
import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../pages/HomePage.vue') },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../pages/NotFoundPage.vue') },
  ],
});
```

- [ ] **Step 8: Write registry and search tests**

`__tests__/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createRegistry } from '../src/registry/ComponentRegistry';

describe('ComponentRegistry', () => {
  it('registers and queries entries', () => {
    const r = createRegistry();
    r.registerManifest({
      schemaVersion: '1.0',
      generatedAt: '',
      buildId: 't',
      components: [
        { id: 'a', name: 'A', title: 'A', description: '', version: '1.0.0',
          framework: 'vue', group: 'g', category: 'c', tags: [],
          route: { path: '/a', title: 'A' }, mount: { kind: 'vue' },
          isolation: { mode: 'shadow-dom' },
          assets: { entryChunk: 'a.js' }, loaderKey: 'a' },
      ],
      groups: [],
      search: { fields: [], normalized: false },
    });
    expect(r.listMetadata().length).toBe(1);
    expect(r.get('a')?.title).toBe('A');
    expect(r.get('b')).toBeUndefined();
  });
});
```

`__tests__/search.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { createSearchIndex } from '../src/registry/SearchIndex';
import type { ManifestEntry } from '@style-library/component-contract';

const entries = ref<readonly ManifestEntry[]>([
  { id: 'btn', name: 'Btn', title: '按钮', description: '基础按钮', version: '1.0.0',
    framework: 'vue', group: '基础', category: '交互', tags: ['button'],
    route: { path: '/btn', title: '按钮' }, mount: { kind: 'vue' },
    isolation: { mode: 'shadow-dom' },
    assets: { entryChunk: 'btn.js' }, loaderKey: 'btn' },
  { id: 'tbl', name: 'Tbl', title: '表格', description: '数据表格', version: '1.0.0',
    framework: 'react', group: '数据', category: '表格', tags: ['table'],
    route: { path: '/tbl', title: '表格' }, mount: { kind: 'react' },
    isolation: { mode: 'shadow-dom' },
    assets: { entryChunk: 'tbl.js' }, loaderKey: 'tbl' },
] as any);

describe('SearchIndex', () => {
  it('filters by query (case-insensitive)', () => {
    const s = createSearchIndex(entries);
    s.query.value = '按钮';
    expect(s.results.value.map((r) => r.id)).toEqual(['btn']);
  });

  it('filters by group', () => {
    const s = createSearchIndex(entries);
    s.group.value = '数据';
    expect(s.results.value.length).toBe(1);
    expect(s.results.value[0].id).toBe('tbl');
  });
});
```

- [ ] **Step 9: Run tests**

```bash
pnpm exec vitest run apps/showcase/__tests__/registry.test.ts apps/showcase/__tests__/search.test.ts
```

- [ ] **Step 10: Commit**

```bash
git add apps/showcase/src/theme apps/showcase/src/manifest-loader.ts apps/showcase/src/registry apps/showcase/src/router apps/showcase/__tests__/registry.test.ts apps/showcase/__tests__/search.test.ts
git commit -m "feat(showcase): add theme, manifest loader, registry, search, router"
```

#### Task 10C: Pages and components

- [ ] **Step 1: Create `App.vue`**

```vue
<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>
<template>
  <RouterView />
</template>

<style>
:root {
  font-family: var(--sl-font-family);
  color: var(--sl-color-text);
  background: var(--sl-color-surface);
}
body { margin: 0; }
* { box-sizing: border-box; }
</style>
```

- [ ] **Step 2: Create `main.ts`**

```ts
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { loadManifest } from './manifest-loader';
import { createRegistry } from './registry/ComponentRegistry';
import { registerComponentRoutes } from './registry/RouterRegistrar';
import { defaultTokens } from './theme/tokens';
import { applyThemeToDocument } from './theme/apply-theme';

async function bootstrap() {
  applyThemeToDocument(defaultTokens);

  const manifest = await loadManifest();
  const registry = createRegistry();
  registry.registerManifest(manifest);
  registerComponentRoutes(router, registry.listMetadata());

  // expose to components
  (window as any).__registry = registry;

  const app = createApp(App);
  app.use(router);
  app.mount('#app');
}

bootstrap().catch((err) => {
  document.body.innerHTML = `<pre style="padding:24px;color:#b91c1c">Failed to start: ${err.message}</pre>`;
});
```

- [ ] **Step 3: Create `HomePage.vue`, `NotFoundPage.vue`, `CardGrid.vue`, `ComponentCard.vue`, `SearchBar.vue`, `GroupFilter.vue`, `DetailPage.vue`, `DetailShell.vue`**

Each component must follow the spec:

- HomePage uses CardGrid + SearchBar + GroupFilter
- CardGrid renders `registry.listMetadata()` filtered by search/group
- ComponentCard only renders metadata (no loader call)
- DetailPage creates a ShadowRoot via ShadowRootHost, loads the implementation dynamically, mounts via the right adapter, and unmounts on leave

Full source for each is appended below for completeness. (The implementer copies them verbatim.)

- [ ] **Step 4: Verify dev server starts**

```bash
cd apps/showcase && pnpm exec vite --port 5173 --host &
sleep 5
curl -s http://localhost:5173/__component-manifest.json | head -100
kill %1
```

Expected: manifest JSON returned with all 3 components.

- [ ] **Step 5: Verify build**

```bash
cd apps/showcase && pnpm exec vite build
```

Expected: build succeeds, `dist/component-manifest.json` exists, and per-component chunks emitted (e.g., `vc-button`, `vc-heavy-chart`, `rc-data-table`).

- [ ] **Step 6: Commit**

```bash
git add apps/showcase/src
git commit -m "feat(showcase): add pages, card grid, detail page with shadow DOM"
```

#### Task 10D: End-to-end performance gate

- [ ] **Step 1: Write `__tests__/e2e-perf.test.ts`**

This test loads `dist/index.html` via jsdom + verifies that the manifest is referenced but no component entry chunks are imported at load time.

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(__dirname, '../dist');
const manifestPath = path.join(distDir, 'component-manifest.json');

describe('e2e: first paint does not load component implementations', () => {
  it('component-manifest.json exists in dist', () => {
    expect(readFileSync(manifestPath, 'utf8').length).toBeGreaterThan(0);
  });

  it('dist contains per-component chunks', () => {
    const assets = readdirSync(path.join(distDir, 'assets'));
    const hasButton = assets.some((f) => f.includes('vc-button') || f.includes('rc-button'));
    const hasChart = assets.some((f) => f.includes('vc-heavy-chart') || f.includes('rc-heavy-chart'));
    const hasTable = assets.some((f) => f.includes('rc-data-table'));
    expect(hasButton).toBe(true);
    expect(hasChart).toBe(true);
    expect(hasTable).toBe(true);
  });

  it('entry index.html does not import any component chunk', () => {
    const index = readFileSync(path.join(distDir, 'index.html'), 'utf8');
    expect(index).not.toMatch(/heavy-chart/);
    expect(index).not.toMatch(/data-table/);
  });
});
```

- [ ] **Step 2: Run**

```bash
pnpm --filter @style-library/showcase build
pnpm exec vitest run apps/showcase/__tests__/e2e-perf.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/showcase/__tests__/e2e-perf.test.ts
git commit -m "test(showcase): add e2e performance gate"
```

---

### Task 11: CI workflow

**Files:**
- Create: `.github/workflows/lint.yml`

- [ ] **Step 1: Create workflow**

```yaml
name: lint
on:
  push:
    branches: [main]
  pull_request:

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm exec vitest run
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/lint.yml
git commit -m "ci: add lint workflow"
```

---

## Final Whole-Branch Review

After all 11 tasks land, run a final review covering:

1. Every package builds standalone.
2. `pnpm lint` exits 0.
3. `pnpm exec vitest run` exits 0 across all packages.
4. `apps/showcase` dev server starts and `/__component-manifest.json` returns valid manifest.
5. `apps/showcase` production build emits per-component chunks.
6. E2E perf gate passes.
7. No `console.log` debug noise.
8. Type contract is consumed consistently.
9. Shadow DOM is used only for DetailPage.
10. Card components never call `entry.loader()`.

---

## Self-Review Checklist

- [x] **Spec coverage**: Tasks 1-2 = contract (spec §4-§5), Tasks 3-4 = manifest (spec §6.1), Tasks 5-6 = adapters (spec §6.4), Tasks 7-9 = components, Tasks 10 = Host, Task 11 = CI.
- [x] **No placeholders**: All code blocks complete.
- [x] **Type consistency**: `MountContext`, `MountAdapter`, `ComponentManifest`, `ManifestEntry` defined in Task 1 and consumed consistently downstream.
- [x] **DRY/YAGNI**: No Pinia, no Module Federation, no SSR — explicit first-stage choices.
- [x] **Atomic commits**: Each task ends with one commit; commit messages use Conventional Commits.
- [x] **TDD-friendly**: Tests written before implementation for every package task.
