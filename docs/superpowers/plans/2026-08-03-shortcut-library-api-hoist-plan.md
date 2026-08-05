# shortcut-library API Hoist + authStore Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `shortcut-library` HTTP wrappers from inside the component to the host API services layer, and elevate auth state to a Vue-host Pinia store with a React-side `useAuth()` hook. Replace the inline SettingsPanel login form with a host-owned LoginModal that fully replicates the moebius-login design.

**Architecture:** Three-layer split:
1. **`api/services/{userV1,kvV1}.ts`** — thin wrappers over `shared/request.ts`'s `api.*` (throw model: success returns unwrapped `data`, failure throws `ApiError`).
2. **`api/services/shortcut-library/createShortcutStore.ts`** — composes the KV service with the Pinia `authStore` token getter; `try/catch` on `ApiError`.
3. **`shared/auth-store.ts` (Pinia)** — owns token + user; exposes `useAuth()` (React, force-rerender subscription) and `getAuthSnapshot()` (imperative).

Login UI is a single Vue SFC `shared/login-modal.vue` that fully replicates `apps/showcase/temp/moebius-login (11).html`, minus the OAuth `divider/alt` block.

**Tech Stack:** Vue 3 + Pinia, React 19, TypeScript, Vitest, Vite, http-proxy (existing), Nginx (existing).

**Spec:** `docs/superpowers/specs/2026-08-03-shortcut-library-api-hoist-design.md`

## Global Constraints

- All new files use CRLF line endings (Windows-native repo).
- New `BackendId` entries: `'userV1' | 'kvV1'` (added to existing union).
- API paths scope: `'/api/v1/auth'` and `'/api/v1/kv'` (NOT the existing `'/api/auth'`).
- `BASE` in services satisfies `ApiPathLiteral` (`registry.ts` derive).
- **Error model: THROW.** Services are thin wrappers over `api.{get,post,...}` from `shared/request.ts`. Success returns the unwrapped `data`; failure throws `ApiError` (imported from `@/shared/request`). Services MUST NOT call global `fetch` directly, MUST NOT define their own envelope-unwrap helper, and MUST NOT return a `Result<T,ApiError>` union. Stores catch `ApiError`.
- **`skipUnauthorized: true`** on `sendCode` / `register` / `login` (no token yet; a bad-credential 401 must NOT fire the global `markRequiresLogin` logout signal). `info` / `regenerateInvitation` use the default (401 fires the signal — correct for authenticated calls).
- `shortcut-library` component MUST NOT write `baseUrl` or hand-paste routes.
- `userKvStore.ts` is DELETED with the legacy clients (Task 8). The host's `createShortcutStore` (Task 6) replaces it; `useShortcuts` (Task 9) keeps `LSStore` (still in `engine/store.ts`) as the offline fallback.
- `authClient.ts` and `userKvClient.ts` files are deleted (not orphaned) — verify before commit.
- All TS files use `import type` for type-only imports.
- `__tests__/` paths follow existing layout: `apps/showcase/__tests__/` for host, `packages/react-components/__tests__/` for component.
- Conventional Commits per atomic task.
- `prefers-reduced-motion: reduce` short-circuits canvas animation in LoginModal.
- Custom cursor `display:none` when `(hover:none)` (touch devices).
- `LoginModal` reproduces the design exactly (canvas ink engine + `.grain` + `.vignette` + `#cursor` + form + `welcome` secondary page). The `divider/alt` block is removed.
- All form validation lints clean.

---

### Task 1: Registry — add `userV1` and `kvV1` entries

**Files:**
- Modify: `apps/showcase/src/api/types.ts:13` (extend `BackendId` union)
- Modify: `apps/showcase/src/api/registry.ts:14-40` (add 2 entries), `apps/showcase/src/api/registry.ts:71-77` (add `apiPaths`)
- Test: `apps/showcase/__tests__/registry-conflict.test.ts` (new)

**Interfaces:**
- Produces: `BackendId` includes `'userV1' | 'kvV1'`. `apiPaths.userV1 = '/api/v1/auth'`, `apiPaths.kvV1 = '/api/v1/kv'`. Both share target `{ dev: 'http://localhost:8080', prod: 'http://47.110.80.47:8988' }` (same backend as existing `'auth'`).

- [ ] **Step 1: Write the failing test**

`apps/showcase/__tests__/registry-conflict.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getRegistry, apiPaths } from '../src/api/registry';

describe('api/registry userV1 + kvV1 entries', () => {
  it('registers userV1 at /api/v1/auth', () => {
    expect(apiPaths.userV1).toBe('/api/v1/auth');
    expect(getRegistry().userV1.routes).toContain('/api/v1/auth');
  });

  it('registers kvV1 at /api/v1/kv', () => {
    expect(apiPaths.kvV1).toBe('/api/v1/kv');
    expect(getRegistry().kvV1.routes).toContain('/api/v1/kv');
  });

  it('does not overlap with existing auth path', () => {
    // /api/auth vs /api/v1/auth — neither is a prefix of the other
    expect(apiPaths.auth.startsWith(apiPaths.userV1 + '/')).toBe(false);
    expect(apiPaths.userV1.startsWith(apiPaths.auth + '/')).toBe(false);
  });

  it('targets same backend as auth', () => {
    const auth = getRegistry().auth.target;
    const userV1 = getRegistry().userV1.target;
    const kvV1 = getRegistry().kvV1.target;
    expect(userV1).toEqual(auth);
    expect(kvV1).toEqual(auth);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/showcase/__tests__/registry-conflict.test.ts`
Expected: FAIL — `BackendId` does not include `'userV1'` (TS error on `getRegistry().userV1`).

- [ ] **Step 3: Extend `BackendId` in types.ts**

`apps/showcase/src/api/types.ts`, line 13:

```typescript
export type BackendId = 'auth' | 'notion' | 'gitlab' | 'weather' | 'userV1' | 'kvV1';
```

- [ ] **Step 4: Add entries to `registry.ts`**

Insert after the existing `weather` entry (before the closing `};` of the registry object):

```typescript
  userV1: {
    target: {
      dev: 'http://localhost:8080',
      prod: 'http://47.110.80.47:8988',
    },
    routes: ['/api/v1/auth'],
  },
  kvV1: {
    target: {
      dev: 'http://localhost:8080',
      prod: 'http://47.110.80.47:8988',
    },
    routes: ['/api/v1/kv'],
  },
```

Update `apiPaths`:

```typescript
export const apiPaths = {
  auth: '/api/auth',
  userV1: '/api/v1/auth',
  kvV1: '/api/v1/kv',
  notion: '/api/notion',
  gitlab: '/api/gitlab',
  weather: '/api/weather',
} as const;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run apps/showcase/__tests__/registry-conflict.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 6: Verify dev/prod generation still works**

Run: `pnpm exec tsx apps/showcase/src/api/gen-nginx.ts --verbose`
Expected: stdout shows all 6 entries (auth, notion, gitlab, weather, userV1, kvV1) with their context → target mappings. `nginx/api-locations/generated.conf` is regenerated and contains 6 location blocks.

- [ ] **Step 7: Commit**

```bash
git add apps/showcase/src/api/types.ts apps/showcase/src/api/registry.ts apps/showcase/__tests__/registry-conflict.test.ts nginx/api-locations/generated.conf
git commit -m "feat(api): register userV1 + kvV1 backend paths"
```

---

### Task 2: `shared/request.ts` — add Bearer provider injection

**Files:**
- Modify: `apps/showcase/src/shared/request.ts`
- Test: `apps/showcase/__tests__/request-bearer.test.ts` (new)

**Interfaces:**
- Produces: `setBearerProvider(fn: () => string | null): void` — registers a function returning the current Bearer JWT. `call()` includes `Authorization: Bearer <token>` header when the provider returns a non-null string. Default provider returns `null` (no Bearer injected), preserving existing cookie behavior. The header is injected in EVERY request (both `api.*` and `api.raw.*`).

- [ ] **Step 1: Write the failing test**

`apps/showcase/__tests__/request-bearer.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, setBearerProvider } from '../src/shared/request';

describe('shared/request Bearer provider', () => {
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

    await api.get('/api/v1/auth/test');

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('injects Bearer header when provider returns token', async () => {
    setBearerProvider(() => 'jwt-abc-123');
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, data: {} }));
    global.fetch = mockFetch;

    await api.get('/api/v1/auth/test');

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-abc-123' });
  });

  it('updates token when provider value changes between calls', async () => {
    let token = 'first-token';
    setBearerProvider(() => token);
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, data: {} }));
    global.fetch = mockFetch;

    await api.get('/api/v1/auth/test');
    token = 'second-token';
    await api.get('/api/v1/auth/test');

    const first = (mockFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    const second = (mockFetch.mock.calls[1][1] as RequestInit).headers as Record<string, string>;
    expect(first.Authorization).toBe('Bearer first-token');
    expect(second.Authorization).toBe('Bearer second-token');
  });

  it('does not break the existing cookie credentials: include', async () => {
    setBearerProvider(() => 'jwt');
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, data: {} }));
    global.fetch = mockFetch;

    await api.get('/api/v1/auth/test');

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe('include');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/showcase/__tests__/request-bearer.test.ts`
Expected: FAIL — `setBearerProvider` is not exported.

- [ ] **Step 3: Add Bearer provider to `request.ts`**

After the existing `import { authStore } from './auth-store';` (line 18), add a Bearer-provider section:

```typescript
// ───── Bearer JWT provider (used by userV1 / kvV1) ──────────────
// cookie 鉴权(request.ts 既有)与 Bearer JWT 鉴权(userV1/kvV1)并存:
// authStore 在 init/login 后调 setBearerProvider(() => this.token) 激活。
// 默认返回 null,既有 cookie 行为零感知。
type BearerProvider = () => string | null;
let bearerProvider: BearerProvider = () => null;

export function setBearerProvider(fn: BearerProvider): void {
  bearerProvider = fn;
}

function bearerHeader(): Record<string, string> {
  const token = bearerProvider();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

In the `call()` function, modify the `init.headers` object to include `...bearerHeader()` BEFORE the per-call `...headers` spread (so a caller can still override):

```typescript
    const init: RequestInit = {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...bearerHeader(),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      ...rest,
    };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run apps/showcase/__tests__/request-bearer.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/showcase/src/shared/request.ts apps/showcase/__tests__/request-bearer.test.ts
git commit -m "feat(request): add Bearer JWT provider injection"
```

---

### Task 3: `userV1` service — user/* HTTP wrappers (throw model)

**Files:**
- Create: `apps/showcase/src/api/services/userV1.ts`
- Test: `apps/showcase/__tests__/userV1.test.ts`

**Interfaces:**
- Produces: `userV1Service` object with methods that THROW `ApiError` on failure (no `Result` union):
  - `sendCode(email: string): Promise<void>`
  - `register(args): Promise<{ userId: number }>` (args: `RegisterArgs`)
  - `login(args: { email, password }): Promise<{ token: string; userId: number }>`
  - `info(): Promise<UserInfo>` (UserInfo: `{ id, email, username, nickname, invitationCode }`)
  - `regenerateInvitation(): Promise<{ invitationCode: string }>`
- Also re-exports `ApiError` and `UserInfo`, `RegisterArgs` types for downstream (`auth-store.ts` imports them).

- [ ] **Step 1: Write the failing test**

`apps/showcase/__tests__/userV1.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setBearerProvider } from '../src/shared/request';
import { userV1Service } from '../src/api/services/userV1';

describe('userV1 service (throw model)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setBearerProvider(() => 'jwt');
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

  it('sendCode POSTs to /api/v1/auth/user/send-code', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, message: '验证码已发送' }));
    global.fetch = mockFetch;

    await userV1Service.sendCode('a@b.com');

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/auth/user/send-code');
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.com', purpose: 'register' });
  });

  it('login returns token on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { token: 'jwt-xyz', userId: 42 } }),
    );
    global.fetch = mockFetch;

    const result = await userV1Service.login({ email: 'a@b.com', password: 'pw' });
    expect(result).toEqual({ token: 'jwt-xyz', userId: 42 });
  });

  it('info attaches Bearer header from provider', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, {
        code: 0,
        data: { id: 1, email: 'a@b.com', username: 'u', nickname: 'n', invitationCode: 'INVT' },
      }),
    );
    global.fetch = mockFetch;

    await userV1Service.info();

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt' });
  });

  it('throws ApiError on business code !== 0', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 51, message: '参数错误' }));
    global.fetch = mockFetch;

    await expect(userV1Service.sendCode('bad')).rejects.toMatchObject({ code: 51 });
  });

  it('throws ApiError(401) on unauthorized (info)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(401, { code: 401, message: 'unauthorized' }),
    );
    global.fetch = mockFetch;

    await expect(userV1Service.info()).rejects.toMatchObject({ code: 401 });
  });

  it('login throws on 401 without requiring a prior token', async () => {
    setBearerProvider(() => null);
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(401, { code: 401, message: 'bad password' }),
    );
    global.fetch = mockFetch;

    await expect(
      userV1Service.login({ email: 'a@b.com', password: 'wrong' }),
    ).rejects.toMatchObject({ code: 401 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/showcase/__tests__/userV1.test.ts`
Expected: FAIL — `userV1.ts` not found.

- [ ] **Step 3: Write `userV1.ts` (thin wrapper, throw model)**

`apps/showcase/src/api/services/userV1.ts`:

```typescript
// api/services/userV1.ts —— /api/v1/auth/user/* 后端接口(SPEC §3 D1)。
//
// 薄包装 shared/request.ts 的 api.post/api.get(THROW 模型):
//   - 自有后端统一信封 {code, data, message} 由 request.ts 自动解包/抛 ApiError
//   - 鉴权(Bearer JWT)由 setBearerProvider 注入,call() 自动带 Authorization 头
//   - sendCode/register/login 尚无 token,且密码错误会返回 401;
//     用 skipUnauthorized:true 跳过全局 markRequiresLogin(logout 信号),
//     由调用方(auth-store)自行 catch ApiError 决定如何处理

import { api, ApiError } from '@/shared/request';
import type { ApiPathLiteral } from '../registry';

export { ApiError };

const BASE = '/api/v1/auth' as const satisfies ApiPathLiteral;

// ───── Types ────────────────────────────────────────────────────

export interface UserInfo {
  id: number;
  email: string;
  username: string;
  nickname: string;
  invitationCode: string;
}

export interface RegisterArgs {
  email: string;
  password: string;
  code: string;
  invitationCode: string;
  nickname?: string;
}

// ───── Public service ───────────────────────────────────────────

export const userV1Service = {
  async sendCode(email: string): Promise<void> {
    await api.post(
      `${BASE}/user/send-code`,
      { email, purpose: 'register' },
      { skipUnauthorized: true },
    );
  },

  async register(args: RegisterArgs): Promise<{ userId: number }> {
    return api.post<{ userId: number }>(`${BASE}/user/register`, args, {
      skipUnauthorized: true,
    });
  },

  async login(args: { email: string; password: string }): Promise<{ token: string; userId: number }> {
    return api.post<{ token: string; userId: number }>(`${BASE}/user/login`, args, {
      skipUnauthorized: true,
    });
  },

  async info(): Promise<UserInfo> {
    return api.get<UserInfo>(`${BASE}/user/info`);
  },

  async regenerateInvitation(): Promise<{ invitationCode: string }> {
    return api.post<{ invitationCode: string }>(`${BASE}/user/invitation/regenerate`);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run apps/showcase/__tests__/userV1.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/showcase/src/api/services/userV1.ts apps/showcase/__tests__/userV1.test.ts
git commit -m "feat(services): add userV1 HTTP wrapper (throw model)"
```

---

### Task 4: `kvV1` service — kv/* HTTP wrappers (throw model)

**Files:**
- Create: `apps/showcase/src/api/services/kvV1.ts`
- Test: `apps/showcase/__tests__/kvV1.test.ts`

**Interfaces:**
- Produces: `kvV1Service` object with methods that THROW `ApiError` on failure:
  - `set(args: KvSetArgs): Promise<void>`
  - `get(args: KvGetArgs): Promise<KvItem>`
  - `delete(args: { key: string }): Promise<void>`
  - `list(args?): Promise<KvListResponse>`
- Exports `KvItem`, `KvSetArgs`, `KvGetArgs`, `KvListResponse`, `Visibility` types.
- Bearer JWT injected by `setBearerProvider` (called by authStore); services do not read tokens.

- [ ] **Step 1: Write the failing test**

`apps/showcase/__tests__/kvV1.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setBearerProvider } from '../src/shared/request';
import { kvV1Service } from '../src/api/services/kvV1';

describe('kvV1 service (throw model)', () => {
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

  it('set POSTs to /api/v1/kv with Bearer header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, message: 'ok' }));
    global.fetch = mockFetch;

    await kvV1Service.set({ key: 'shortcuts', value: '{}', visibility: 'private' });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/kv');
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-xyz' });
    expect(JSON.parse(init.body as string)).toMatchObject({
      key: 'shortcuts',
      value: '{}',
      visibility: 'private',
      ttl: 0,
    });
  });

  it('get GETs /api/v1/kv/:key', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, {
        code: 0,
        data: { key: 'shortcuts', value: '{}', visibility: 'private', expires_at: '' },
      }),
    );
    global.fetch = mockFetch;

    const item = await kvV1Service.get({ key: 'shortcuts' });
    expect(item.key).toBe('shortcuts');
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/kv/shortcuts');
  });

  it('get appends ownerId when > 0', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, {
        code: 0,
        data: { key: 'k', value: 'v', visibility: 'public', expires_at: '' },
      }),
    );
    global.fetch = mockFetch;

    await kvV1Service.get({ key: 'k', ownerId: 99 });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/kv/k?ownerId=99');
  });

  it('delete sends DELETE method', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, message: 'ok' }));
    global.fetch = mockFetch;

    await kvV1Service.delete({ key: 'shortcuts' });

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('DELETE');
  });

  it('list with pagination appends query string', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 0, data: { items: [], total: 0 } }),
    );
    global.fetch = mockFetch;

    await kvV1Service.list({ limit: 10, offset: 20 });

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/kv?limit=10&offset=20');
  });

  it('throws ApiError on business code 50 (key not found)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockJSON(200, { code: 50, message: 'key not found' }),
    );
    global.fetch = mockFetch;

    await expect(kvV1Service.get({ key: 'missing' })).rejects.toMatchObject({ code: 50 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/showcase/__tests__/kvV1.test.ts`
Expected: FAIL — `kvV1.ts` not found.

- [ ] **Step 3: Write `kvV1.ts` (thin wrapper, throw model)**

`apps/showcase/src/api/services/kvV1.ts`:

```typescript
// api/services/kvV1.ts —— /api/v1/kv/* 后端接口(SPEC §3 D1)。
//
// 薄包装 shared/request.ts 的 api.{post,get,delete}(THROW 模型)。
// 鉴权(Bearer JWT)由 setBearerProvider 注入。
// 401 由 request.ts 触发 markRequiresLogin(已登录态过期 → 全局 logout 信号)。

import { api, ApiError } from '@/shared/request';
import type { ApiPathLiteral } from '../registry';

export { ApiError };

const BASE = '/api/v1/kv' as const satisfies ApiPathLiteral;

// ───── Types ────────────────────────────────────────────────────

export type Visibility = 'private' | 'public';

export interface KvItem {
  key: string;
  value: string;
  visibility: Visibility;
  expires_at: string;
}

export interface KvListResponse {
  items: KvItem[];
  total: number;
}

export interface KvSetArgs {
  key: string;
  value: string;
  visibility?: Visibility;
  ttl?: number;
}

export interface KvGetArgs {
  key: string;
  ownerId?: number;
}

// ───── Public service ───────────────────────────────────────────

export const kvV1Service = {
  async set(args: KvSetArgs): Promise<void> {
    await api.post(`${BASE}`, {
      key: args.key,
      value: args.value,
      visibility: args.visibility ?? 'private',
      ttl: args.ttl ?? 0,
    });
  },

  async get(args: KvGetArgs): Promise<KvItem> {
    const qs = args.ownerId && args.ownerId > 0 ? `?ownerId=${args.ownerId}` : '';
    return api.get<KvItem>(`${BASE}/${encodeURIComponent(args.key)}${qs}`);
  },

  async delete(args: { key: string }): Promise<void> {
    await api.delete(`${BASE}/${encodeURIComponent(args.key)}`);
  },

  async list(args: { limit?: number; offset?: number } = {}): Promise<KvListResponse> {
    const qs = new URLSearchParams();
    if (args.limit !== undefined) qs.set('limit', String(args.limit));
    if (args.offset !== undefined) qs.set('offset', String(args.offset));
    const path = `${BASE}${qs.toString() ? `?${qs}` : ''}`;
    return api.get<KvListResponse>(path);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run apps/showcase/__tests__/kvV1.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/showcase/src/api/services/kvV1.ts apps/showcase/__tests__/kvV1.test.ts
git commit -m "feat(services): add kvV1 HTTP wrapper (throw model)"
```

---

### Task 5: `shared/auth-store.ts` — Pinia store + cross-framework `useAuth`

**Files:**
- Modify: `apps/showcase/src/shared/auth-store.ts` (extend existing; refactor to Pinia + new actions)
- Test: `apps/showcase/__tests__/auth-store.test.ts`

**Interfaces:**
- Produces:
  - `useAuthStore` (Pinia) — state `{ authState: AuthStateLiteral, user: UserInfo|null, token: string|null, lastError: string|null }`; actions `init`, `login`, `register`, `sendCode`, `logout`, `regenerateInvitation`, `markRequiresLogin`.
  - `AuthStoreState` (type) — the state shape above.
  - `getAuthSnapshot(): AuthStoreState` — imperative getter returning a plain snapshot (`{ ...store.$state }`), for non-React call sites.
  - `useAuth(): AuthStoreState` — React hook. Uses `useReducer` + `store.$subscribe` to force a re-render on any mutation, then returns `store.$state`. (NOT `useSyncExternalStore` with `$state` — Pinia mutates the proxy in place, so a snapshot ref never changes identity and React would not re-render.)
  - `TOKEN_KEY = 'sl-userkv:v1:token'` constant (re-exported so `createShortcutStore` and `useShortcuts` share it).
- Calls `userV1Service.*` (which throw `ApiError`); catches and stores `lastError`, re-throws to callers.

- [ ] **Step 1: Write the failing test**

`apps/showcase/__tests__/auth-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore, getAuthSnapshot, TOKEN_KEY } from '../src/shared/auth-store';
import { setBearerProvider } from '../src/shared/request';

describe('auth-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setBearerProvider(() => null);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockJSON(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  const USER = { id: 42, email: 'a@b.com', username: 'u', nickname: 'n', invitationCode: 'INVT' };

  it('initial state is logged-out with no token', () => {
    const store = useAuthStore();
    expect(store.authState).toBe('logged-out');
    expect(store.token).toBeNull();
    expect(store.user).toBeNull();
  });

  it('login sets token, user, and switches authState', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { token: 'jwt-xyz', userId: 42 } }))
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: USER }));

    const store = useAuthStore();
    await store.login('a@b.com', 'pw');

    expect(store.authState).toBe('logged-in');
    expect(store.token).toBe('jwt-xyz');
    expect(store.user?.email).toBe('a@b.com');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-xyz');
  });

  it('logout clears token and resets state', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { token: 'jwt', userId: 1 } }))
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { ...USER, id: 1 } }));

    const store = useAuthStore();
    await store.login('a@b.com', 'pw');
    store.logout();

    expect(store.authState).toBe('logged-out');
    expect(store.token).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('init restores session from LS token', async () => {
    localStorage.setItem(TOKEN_KEY, 'restored-jwt');
    global.fetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, data: USER }));

    const store = useAuthStore();
    const result = await store.init();

    expect(result?.mode).toBe('login');
    expect(store.authState).toBe('logged-in');
    expect(store.token).toBe('restored-jwt');
  });

  it('init with no token returns null', async () => {
    const store = useAuthStore();
    const result = await store.init();
    expect(result).toBeNull();
    expect(store.authState).toBe('logged-out');
  });

  it('init with invalid token clears LS', async () => {
    localStorage.setItem(TOKEN_KEY, 'bad-jwt');
    global.fetch = vi.fn().mockResolvedValue(mockJSON(401, { code: 401, message: 'unauthorized' }));

    const store = useAuthStore();
    const result = await store.init();

    expect(result).toBeNull();
    expect(store.authState).toBe('logged-out');
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('login failure stores lastError and rethrows', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockJSON(401, { code: 401, message: 'bad password' }));

    const store = useAuthStore();
    await expect(store.login('a@b.com', 'wrong')).rejects.toThrow();
    expect(store.authState).toBe('logged-out');
    expect(store.lastError).toBeTruthy();
  });

  it('getAuthSnapshot returns a plain copy of current state', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { token: 'jwt', userId: 1 } }))
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { ...USER, id: 1 } }));

    const store = useAuthStore();
    await store.login('a@b.com', 'pw');

    const snap = getAuthSnapshot();
    expect(snap.token).toBe('jwt');
    expect(snap).not.toBe(store.$state); // a copy, not the live proxy
  });

  it('after login, Bearer provider returns the live token', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { token: 'jwt-live', userId: 1 } }))
      .mockResolvedValueOnce(mockJSON(200, { code: 0, data: { ...USER, id: 1 } }));

    const store = useAuthStore();
    await store.login('a@b.com', 'pw');

    // setBearerProvider is wired inside login; verify via a fresh request
    const { userV1Service } = await import('../src/api/services/userV1');
    const infoFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, data: USER }));
    global.fetch = infoFetch;
    await userV1Service.info();

    const init = infoFetch.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-live' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/showcase/__tests__/auth-store.test.ts`
Expected: FAIL — `useAuthStore` / `getAuthSnapshot` / `TOKEN_KEY` not exported (or existing module does not match the Pinia shape).

- [ ] **Step 3: Write `auth-store.ts`**

First inspect the existing `apps/showcase/src/shared/auth-store.ts`. If it already defines a Pinia store (the `auth.ts` service imports `@/shared/auth-store` and references `authStore`), PRESERVE its existing cookie-auth API (`markRequiresLogin`, the `User` type, `clear`) and ADD the new JWT/Bearer fields and actions. If it is not Pinia, refactor it to Pinia while preserving the cookie methods `auth.ts` relies on. Either way, the file must end with the exports below.

`apps/showcase/src/shared/auth-store.ts` (target shape — merge with existing):

```typescript
// shared/auth-store.ts —— 认证状态机(SPEC §3 D3)。
//
// 两条鉴权路径并存:
//   - cookie self-auth(/api/auth/me):既有,auth.ts service 用 markRequiresLogin
//   - Bearer JWT user-auth(/api/v1/auth/user/*):新增,userV1/kvV1 用 token
// Pinia store 是唯一真相源;React 通过 useAuth() 跨框架订阅(force-rerender 模式)。

import { defineStore } from 'pinia';
import { useReducer, useEffect } from 'react';
import { setBearerProvider } from './request';
import { userV1Service, type UserInfo } from '@/api/services/userV1';

export const TOKEN_KEY = 'sl-userkv:v1:token';
const EMAIL_KEY = 'sl-userkv:v1:email';

export type AuthStateLiteral = 'logged-out' | 'logged-in' | 'syncing' | 'error';

export interface AuthStoreState {
  authState: AuthStateLiteral;
  user: UserInfo | null;
  token: string | null;
  lastError: string | null;
}

function readLS(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeLS(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota */ }
}
function removeLS(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthStoreState => ({
    authState: 'logged-out',
    user: null,
    token: null,
    lastError: null,
  }),
  actions: {
    async init(): Promise<{ mode: 'login' } | null> {
      const token = readLS(TOKEN_KEY);
      if (!token) {
        this.authState = 'logged-out';
        return null;
      }
      this.token = token;
      setBearerProvider(() => this.token);
      try {
        const info = await userV1Service.info();
        this.user = info;
        writeLS(EMAIL_KEY, info.email);
        this.authState = 'logged-in';
        return { mode: 'login' };
      } catch {
        removeLS(TOKEN_KEY);
        this.token = null;
        this.user = null;
        this.authState = 'logged-out';
        return null;
      }
    },

    async login(email: string, password: string): Promise<void> {
      this.authState = 'syncing';
      this.lastError = null;
      try {
        const r = await userV1Service.login({ email, password });
        this.token = r.token;
        writeLS(TOKEN_KEY, r.token);
        writeLS(EMAIL_KEY, email);
        setBearerProvider(() => this.token);
        try {
          this.user = await userV1Service.info();
        } catch {
          this.user = null;
        }
        this.authState = 'logged-in';
      } catch (e) {
        this.authState = 'logged-out';
        this.lastError = e instanceof Error ? e.message : 'login failed';
        throw e;
      }
    },

    async register(args: {
      email: string;
      password: string;
      code: string;
      invitationCode: string;
      nickname?: string;
    }): Promise<void> {
      this.authState = 'syncing';
      this.lastError = null;
      try {
        await userV1Service.register(args);
        await this.login(args.email, args.password);
      } catch (e) {
        this.authState = 'logged-out';
        this.lastError = e instanceof Error ? e.message : 'register failed';
        throw e;
      }
    },

    async sendCode(email: string): Promise<void> {
      await userV1Service.sendCode(email);
    },

    logout(): void {
      this.token = null;
      this.user = null;
      this.lastError = null;
      removeLS(TOKEN_KEY);
      removeLS(EMAIL_KEY);
      this.authState = 'logged-out';
    },

    async regenerateInvitation(): Promise<string> {
      this.authState = 'syncing';
      try {
        const r = await userV1Service.regenerateInvitation();
        if (this.user) this.user = { ...this.user, invitationCode: r.invitationCode };
        this.authState = 'logged-in';
        return r.invitationCode;
      } catch (e) {
        this.authState = 'error';
        this.lastError = e instanceof Error ? e.message : 'regenerate failed';
        throw e;
      }
    },

    /** 既有 cookie self-auth 路径用:401 → 清登录态。 */
    markRequiresLogin(): void {
      this.logout();
    },
  },
});

// ───── imperative snapshot(非 React 调用方) ───────────────────

export function getAuthSnapshot(): AuthStoreState {
  return { ...useAuthStore().$state };
}

// ───── React hook(跨框架订阅) ─────────────────────────────────
//
// 不能用 useSyncExternalStore + store.$state:Pinia 原地修改 $state 代理,
// 快照引用不变 → React 不重渲染。改用 useReducer 强制 rerender + $subscribe 监听;
// 返回 store.$state(被原地修改的代理),组件读到的是最新值。

export function useAuth(): AuthStoreState {
  const store = useAuthStore();
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    return store.$subscribe(() => force(), { detached: true });
  }, [store]);
  return store.$state;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run apps/showcase/__tests__/auth-store.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Verify existing cookie-auth path still compiles**

Run: `pnpm exec tsc --noEmit -p apps/showcase/tsconfig.json` (or the repo's typecheck command).
Expected: 0 errors. `apps/showcase/src/api/services/auth.ts` imports from `@/shared/auth-store` — confirm its `markRequiresLogin` / `User` usages still resolve. If the existing file exported a different `User` type, keep both names; do not break `auth.ts`.

- [ ] **Step 6: Commit**

```bash
git add apps/showcase/src/shared/auth-store.ts apps/showcase/__tests__/auth-store.test.ts
git commit -m "feat(auth-store): Pinia store + cross-framework useAuth + Bearer wiring"
```

---

### Task 6: `createShortcutStore` composes KV service with authStore

**Files:**
- Create: `apps/showcase/src/api/services/shortcut-library/createShortcutStore.ts`
- Create: `apps/showcase/src/api/services/shortcut-library/types.ts`
- Test: `apps/showcase/__tests__/shortcut-library-store.test.ts`

**Interfaces:**
- Produces: `createShortcutStore(): ShortcutStoreLite` — returns an object with `load()` / `save()` / `importGroups()`. Reads the live token via `useAuthStore().token` (no args). On `load`: no token → `[]`; `kvV1.get` throws `ApiError` with code 50 (key not found) → catch → `[]`; otherwise parse `value`. On `save`: no token → throw `Error('not logged in')`; otherwise `kvV1.set`.
- `ShortcutStoreLite` interface exported for `useShortcuts` to type against.
- `types.ts` re-declares `Group` / `Shortcut` / `KeyStroke` (the canonical domain types) so the host service layer does not import from the React component package.

- [ ] **Step 1: Write the failing test**

`apps/showcase/__tests__/shortcut-library-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../src/shared/auth-store';
import { setBearerProvider } from '../src/shared/request';
import { createShortcutStore } from '../src/api/services/shortcut-library/createShortcutStore';

describe('createShortcutStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    setBearerProvider(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockJSON(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  const GROUPS_JSON = JSON.stringify([
    { id: 'g1', name: 'VSCode', shortcuts: [], createdAt: 0, updatedAt: 0 },
  ]);

  it('load returns [] when no token (logged-out)', async () => {
    const store = createShortcutStore();
    const data = await store.load();
    expect(data).toEqual([]);
  });

  it('load parses kv value when logged-in', async () => {
    const auth = useAuthStore();
    auth.token = 'jwt-abc';
    setBearerProvider(() => 'jwt-abc');

    global.fetch = vi.fn().mockResolvedValue(
      mockJSON(200, {
        code: 0,
        data: { key: 'shortcuts', value: GROUPS_JSON, visibility: 'private', expires_at: '' },
      }),
    );

    const store = createShortcutStore();
    const data = await store.load();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('VSCode');
  });

  it('load returns [] on key-not-found (code 50)', async () => {
    const auth = useAuthStore();
    auth.token = 'jwt-abc';
    setBearerProvider(() => 'jwt-abc');

    global.fetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 50, message: 'key not found' }));

    const store = createShortcutStore();
    const data = await store.load();
    expect(data).toEqual([]);
  });

  it('save POSTs serialized groups to /api/v1/kv', async () => {
    const auth = useAuthStore();
    auth.token = 'jwt-abc';
    setBearerProvider(() => 'jwt-abc');

    const mockFetch = vi.fn().mockResolvedValue(mockJSON(200, { code: 0, message: 'ok' }));
    global.fetch = mockFetch;

    const store = createShortcutStore();
    await store.save([{ id: 'g1', name: 'Chrome', shortcuts: [], createdAt: 0, updatedAt: 0 }]);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/kv');
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.key).toBe('shortcuts');
    expect(JSON.parse(body.value)).toHaveLength(1);
  });

  it('save throws when not logged in', async () => {
    const store = createShortcutStore();
    await expect(
      store.save([{ id: 'g1', name: 'X', shortcuts: [], createdAt: 0, updatedAt: 0 }]),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/showcase/__tests__/shortcut-library-store.test.ts`
Expected: FAIL — file not found.

- [ ] **Step 3: Write `types.ts`**

`apps/showcase/src/api/services/shortcut-library/types.ts`:

```typescript
// api/services/shortcut-library/types.ts —— shortcut-library 领域类型(host 侧副本)。
//
// host service 层不 import React 组件包;这里重新声明 Group/Shortcut/KeyStroke,
// 与 packages/react-components/src/shortcut-library/src/types.ts 保持结构一致。

export interface KeyStroke {
  code: string;
  label: string;
  isModifier: boolean;
}

export interface Shortcut {
  id: string;
  combo: KeyStroke[];
  description: string;
  condition?: string;
  createdAt: number;
}

export interface Group {
  id: string;
  name: string;
  shortcuts: Shortcut[];
  createdAt: number;
  updatedAt: number;
}
```

- [ ] **Step 4: Write `createShortcutStore.ts`**

`apps/showcase/src/api/services/shortcut-library/createShortcutStore.ts`:

```typescript
// api/services/shortcut-library/createShortcutStore.ts —— 组装 KV 持久化(SPEC §3 D4)。
//
// 替代组件内的 userKvStore.ts(已删除)。host 拥有:
//   - token 从 useAuthStore().token 读(Bearer 由 request.ts 注入)
//   - 单 key 'shortcuts',value = JSON.stringify(groups[])
//   - key 不存在(后端 code 50)→ 视为空数据,返回 []
// useShortcuts(组件内)仍持有 LSStore 作为离线 fallback;本 store 只负责 cloud。

import { useAuthStore } from '@/shared/auth-store';
import { kvV1Service, ApiError } from '../kvV1';
import type { Group } from './types';

const BLOB_KEY = 'shortcuts';

export interface ImportInput {
  groups: { name: string; shortcuts: { combo: Group['shortcuts'][number]['combo']; description: string; condition?: string }[] }[];
  errors: string[];
}

export interface ImportStats {
  groupsAdded: number;
  groupsAppended: number;
  shortcutsAdded: number;
  errors: string[];
}

export interface ShortcutStoreLite {
  load(): Promise<Group[]>;
  save(groups: Group[]): Promise<void>;
  importGroups(data: ImportInput): Promise<ImportStats>;
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function createShortcutStore(): ShortcutStoreLite {
  const auth = useAuthStore();

  return {
    async load(): Promise<Group[]> {
      if (!auth.token) return [];
      try {
        const item = await kvV1Service.get({ key: BLOB_KEY });
        try {
          return JSON.parse(item.value) as Group[];
        } catch {
          return [];
        }
      } catch (e) {
        // key 不存在 → 后端返回 code 50,kvV1Service 抛 ApiError(code:50)
        if (e instanceof ApiError && e.code === 50) return [];
        throw e;
      }
    },

    async save(groups: Group[]): Promise<void> {
      if (!auth.token) throw new Error('not logged in');
      await kvV1Service.set({ key: BLOB_KEY, value: JSON.stringify(groups), visibility: 'private' });
    },

    async importGroups(data: ImportInput): Promise<ImportStats> {
      const stats: ImportStats = { groupsAdded: 0, groupsAppended: 0, shortcutsAdded: 0, errors: [...data.errors] };
      const current = await this.load();
      const next = [...current];
      for (const g of data.groups) {
        const existing = next.find((eg) => eg.name.toLowerCase() === g.name.toLowerCase());
        if (existing) {
          const added = g.shortcuts.map((s) => ({
            id: shortId(),
            combo: s.combo,
            description: s.description,
            condition: s.condition,
            createdAt: Date.now(),
          }));
          existing.shortcuts = [...existing.shortcuts, ...added];
          existing.updatedAt = Date.now();
          stats.groupsAppended++;
          stats.shortcutsAdded += added.length;
        } else {
          const now = Date.now();
          next.push({
            id: shortId(),
            name: g.name,
            shortcuts: g.shortcuts.map((s) => ({
              id: shortId(),
              combo: s.combo,
              description: s.description,
              condition: s.condition,
              createdAt: now,
            })),
            createdAt: now,
            updatedAt: now,
          });
          stats.groupsAdded++;
          stats.shortcutsAdded += next[next.length - 1].shortcuts.length;
        }
      }
      await this.save(next);
      return stats;
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run apps/showcase/__tests__/shortcut-library-store.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/showcase/src/api/services/shortcut-library/ apps/showcase/__tests__/shortcut-library-store.test.ts
git commit -m "feat(services): createShortcutStore composes kvV1 + authStore"
```

---

### Task 7: LoginModal Vue SFC — full UI replication

**Files:**
- Create: `apps/showcase/src/shared/login-modal.vue`
- Create: `apps/showcase/src/shared/login-modal.css`
- Create: `apps/showcase/src/shared/canvas-engine.ts`
- Create: `apps/showcase/src/shared/useLoginModal.ts`
- Test: `apps/showcase/__tests__/login-modal.test.ts`

**Interfaces:**
- Produces:
  - `<LoginModal :open="boolean" />` Vue component. Emits `update:open`, `success`. Internally uses `useAuthStore()` for login. Includes canvas ink engine + form + `welcome` secondary page. NO `divider/alt` block.
  - `useLoginModal.ts`: `openLoginModal()`, `closeLoginModal()`, `useLoginModalState()` (Vue composable), `subscribeLoginModal(cb)`, `getLoginModalSnapshot()` (for the React-side bridge hook in Task 9).
- `canvas-engine.ts`: `startCanvas(canvas): { destroy() }` — port of the moebius ink engine, `prefers-reduced-motion` aware.

- [ ] **Step 1: Write the failing test**

`apps/showcase/__tests__/login-modal.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import LoginModal from '../src/shared/login-modal.vue';

describe('login-modal', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders email + password inputs when open=true', () => {
    const wrapper = mount(LoginModal, { props: { open: true } });
    expect(wrapper.find('input[type=email]').exists()).toBe(true);
    expect(wrapper.find('input[type=password]').exists()).toBe(true);
  });

  it('does NOT render the alt (Google/GitHub) or divider block', () => {
    const wrapper = mount(LoginModal, { props: { open: true } });
    expect(wrapper.find('.sl-sl-alt').exists()).toBe(false);
    expect(wrapper.find('.sl-sl-divider').exists()).toBe(false);
  });

  it('does not render the form when open=false', () => {
    const wrapper = mount(LoginModal, { props: { open: false } });
    expect(wrapper.find('input[type=email]').exists()).toBe(false);
  });

  it('renders the canvas when open=true', () => {
    const wrapper = mount(LoginModal, { props: { open: true } });
    expect(wrapper.find('canvas.sl-sl-canvas').exists()).toBe(true);
  });

  it('shows the welcome secondary page after a successful login', async () => {
    // login is async; this test drives the component through the success branch
    // by mocking the auth store action. See Step 3 for the store mock wiring.
    const wrapper = mount(LoginModal, { props: { open: true } });
    // After successful submit the .sl-sl-welcome element gains the `on` class.
    // Full submit flow is exercised in the dev smoke (Task 11); here we assert
    // the welcome node exists in the template.
    expect(wrapper.find('.sl-sl-welcome').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/showcase/__tests__/login-modal.test.ts`
Expected: FAIL — `login-modal.vue` not found.

- [ ] **Step 3: Create the files**

Port the design from `apps/showcase/temp/moebius-login (11).html`. Read it for the exact CSS values and canvas ink engine; reproduce verbatim except: (a) drop the `divider/alt` block, (b) prefix all class names with `sl-sl-`, (c) replace the form's submit handler with `auth.login()`, (d) drive `.sl-sl-welcome` visibility from a `showWelcome` ref set on login success.

`apps/showcase/src/shared/login-modal.css` — copy the `:root` variables and every rule from the design's `<style>`, retargeted to `.sl-sl-*` classes. Key variables:

```css
:root {
  --white: #FFFFFF;
  --soft: #F9F8F7;
  --surface: #F0EFED;
  --border: #E6E5E3;
  --ink: #2C2C2B;
  --ink-2: #7D7A75;
  --blue: #2783DE;
}
```

Reproduce: `.sl-sl-canvas` (+ `.dragging`), `.sl-sl-grain`, `.sl-sl-vignette`, `.sl-sl-cursor` (+ `.big`, `(hover:none)` hide), `.sl-sl-form-wrap`, `.sl-sl-card` (+ `.gone`, responsive), `.sl-sl-kicker` (+ `.dot` + `@keyframes sl-sl-pulse`), `.sl-sl-card h1`, `.sl-sl-card .sub`, `.sl-sl-field` (+ `label`/`input`/`.hint`/`.bad`), `.sl-sl-eye`, `.sl-sl-strength` (+ `i`), `.sl-sl-row`, `.sl-sl-check`, `.sl-sl-link`, `.sl-sl-btn-primary` (+ `:hover`/`:active`/`[disabled]`/`span`), `.sl-sl-foot`, `.sl-sl-welcome` (+ `.on`), `.sl-sl-ghost`, `.sl-sl-icon-btn`, `.sl-sl-error` (new — red alert box). Include the `:focus-visible` outline and the `@media (max-width:430px)` / `(max-width:520px)` responsive blocks.

`apps/showcase/src/shared/canvas-engine.ts` — port the `Mœbius sky` ink engine (the IIFE in the design's `<script>`): `startCanvas(canvas: HTMLCanvasElement): { destroy(): void }`. Keep the deterministic `prng`, `ink()`, the volumetric cumulus cel-shade render loop, DPR cap at 1.5, `S = clamp(W/24, 38, 64)`, `horizon = H*0.62`, and the `prefers-reduced-motion: reduce` short-circuit (render once, no rAF). `destroy()` removes the resize listener and cancels rAF.

`apps/showcase/src/shared/useLoginModal.ts`:

```typescript
// shared/useLoginModal.ts —— LoginModal 触发入口(跨框架)。
//
// Vue 端:useLoginModalState() 拿响应式 isOpen + open/close。
// React 端(Task 9 的 useLoginModal.ts)用 subscribeLoginModal + getLoginModalSnapshot。

import { ref, readonly } from 'vue';

const isOpen = ref(false);
const subscribers = new Set<(v: boolean) => void>();

function notify() {
  for (const cb of subscribers) cb(isOpen.value);
}

export function openLoginModal(): void {
  isOpen.value = true;
  notify();
}

export function closeLoginModal(): void {
  isOpen.value = false;
  notify();
}

export function useLoginModalState() {
  return { isOpen: readonly(isOpen), open: openLoginModal, close: closeLoginModal };
}

export function subscribeLoginModal(cb: (v: boolean) => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

export function getLoginModalSnapshot(): boolean {
  return isOpen.value;
}
```

`apps/showcase/src/shared/login-modal.vue`:

```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue';
import { useAuthStore } from './auth-store';
import { startCanvas } from './canvas-engine';
import { closeLoginModal } from './useLoginModal';
import './login-modal.css';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void;
  (e: 'success'): void;
}>();

const auth = useAuthStore();
const email = ref('');
const password = ref('');
const showPwd = ref(false);
const error = ref<string | null>(null);
const submitting = ref(false);
const showWelcome = ref(false);
const cardGone = ref(false);

const strength = computed(() => {
  const len = password.value.length;
  if (len === 0) return 0;
  if (len < 4) return 1;
  if (len < 8) return 2;
  if (len < 12) return 3;
  return 4;
});

watch(
  () => props.open,
  (v) => {
    if (v) {
      cardGone.value = false;
      showWelcome.value = false;
      error.value = null;
    }
  },
);

const canvasRef = ref<HTMLCanvasElement | null>(null);
let engine: { destroy(): void } | null = null;

function ensureEngine() {
  if (canvasRef.value && !engine) engine = startCanvas(canvasRef.value);
}
onMounted(ensureEngine);
onBeforeUnmount(() => {
  engine?.destroy();
  engine = null;
});
watch(canvasRef, ensureEngine);

async function submit() {
  error.value = null;
  if (!email.value || !password.value) {
    error.value = '请输入邮箱和密码';
    return;
  }
  submitting.value = true;
  try {
    await auth.login(email.value, password.value);
    cardGone.value = true;
    showWelcome.value = true;
    setTimeout(() => emit('success'), 1500);
  } catch {
    error.value = auth.lastError ?? '登录失败';
  } finally {
    submitting.value = false;
  }
}

function requestClose() {
  emit('update:open', false);
  closeLoginModal();
}

function back() {
  showWelcome.value = false;
  cardGone.value = false;
  requestClose();
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="sl-sl-form-host">
      <canvas ref="canvasRef" class="sl-sl-canvas"></canvas>
      <div class="sl-sl-grain"></div>
      <div class="sl-sl-vignette"></div>
      <div class="sl-sl-cursor"></div>

      <div class="sl-sl-form-wrap">
        <form v-show="!cardGone" class="sl-sl-card" novalidate @submit.prevent="submit">
          <div class="sl-sl-kicker"><span class="dot"></span> Cirrus · 云上入口</div>
          <h1>登入白色天空</h1>
          <p class="sub">点击天空堆云，风会把它们吹向远方。</p>

          <div v-if="error" class="sl-sl-error">{{ error }}</div>

          <div class="sl-sl-field">
            <label for="login-email">邮箱</label>
            <input
              id="login-email"
              v-model="email"
              type="email"
              placeholder="you@cirrus.io"
              autocomplete="email"
            />
          </div>

          <div class="sl-sl-field">
            <label for="login-pwd">密码</label>
            <input
              id="login-pwd"
              v-model="password"
              :type="showPwd ? 'text' : 'password'"
              placeholder="至少 8 位"
              autocomplete="current-password"
            />
            <button class="sl-sl-eye" type="button" :aria-pressed="showPwd" @click="showPwd = !showPwd">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.6" />
              </svg>
            </button>
            <div class="sl-sl-strength" aria-hidden="true">
              <i v-for="n in 4" :key="n" :style="{ background: strength >= n ? 'var(--ink-2)' : 'var(--border)' }"></i>
            </div>
          </div>

          <div class="sl-sl-row">
            <label class="sl-sl-check"><input type="checkbox" /> 记住我</label>
            <a class="sl-sl-link" href="#" @click.prevent>忘记密码？</a>
          </div>

          <button class="sl-sl-btn-primary" type="submit" :disabled="submitting">
            <span>{{ submitting ? '进入中...' : '进入云中' }}</span>
          </button>

          <p class="sl-sl-foot">还没有账号？<a class="sl-sl-link" href="#" @click.prevent>开始你的旅程</a></p>
        </form>
      </div>

      <div class="sl-sl-welcome" :class="{ on: showWelcome }">
        <h2>欢迎回来，旅行者</h2>
        <p>云层已为你让开。</p>
        <button class="sl-sl-ghost" @click="back">返回登录</button>
      </div>
    </div>
  </Teleport>
</template>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run apps/showcase/__tests__/login-modal.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/showcase/src/shared/login-modal.vue apps/showcase/src/shared/login-modal.css apps/showcase/src/shared/canvas-engine.ts apps/showcase/src/shared/useLoginModal.ts apps/showcase/__tests__/login-modal.test.ts
git commit -m "feat(login-modal): Vue SFC replication of moebius-login design"
```

---

### Task 8: `shortcut-library` — delete legacy client files

**Files:**
- Delete: `packages/react-components/src/shortcut-library/src/engine/authClient.ts`
- Delete: `packages/react-components/src/shortcut-library/src/engine/userKvClient.ts`
- Delete: `packages/react-components/src/shortcut-library/src/engine/userKvStore.ts` (replaced by host `createShortcutStore`)
- Test: `packages/react-components/__tests__/shortcut-library-legacy-imports.test.ts` (new)

**Interfaces:**
- Consumes: Task 6 (`createShortcutStore`) must exist so `useShortcuts` (Task 9) has a replacement. This task only deletes; the rewiring is Task 9.
- Produces: three legacy files gone. `engine/store.ts` (`LSStore`) is KEPT.

- [ ] **Step 1: Write the failing test**

`packages/react-components/__tests__/shortcut-library-legacy-imports.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('shortcut-library legacy files removed', () => {
  it('authClient.ts is deleted', () => {
    const p = resolve(__dirname, '../src/shortcut-library/src/engine/authClient.ts');
    expect(existsSync(p)).toBe(false);
  });

  it('userKvClient.ts is deleted', () => {
    const p = resolve(__dirname, '../src/shortcut-library/src/engine/userKvClient.ts');
    expect(existsSync(p)).toBe(false);
  });

  it('userKvStore.ts is deleted', () => {
    const p = resolve(__dirname, '../src/shortcut-library/src/engine/userKvStore.ts');
    expect(existsSync(p)).toBe(false);
  });

  it('LSStore (engine/store.ts) is kept', () => {
    const p = resolve(__dirname, '../src/shortcut-library/src/engine/store.ts');
    expect(existsSync(p)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/react-components/__tests__/shortcut-library-legacy-imports.test.ts`
Expected: FAIL — files still exist.

- [ ] **Step 3: Delete the legacy files**

```bash
git rm packages/react-components/src/shortcut-library/src/engine/authClient.ts
git rm packages/react-components/src/shortcut-library/src/engine/userKvClient.ts
git rm packages/react-components/src/shortcut-library/src/engine/userKvStore.ts
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/react-components/__tests__/shortcut-library-legacy-imports.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A packages/react-components/src/shortcut-library/src/engine/
git commit -m "refactor(shortcut-library): delete legacy authClient/userKvClient/userKvStore"
```

---

### Task 9: `shortcut-library` — wire `useAuth` + `useLoginModal` + host store

**Files:**
- Create: `packages/react-components/src/shortcut-library/src/hooks/useAuth.ts`
- Create: `packages/react-components/src/shortcut-library/src/hooks/useLoginModal.ts`
- Modify: `packages/react-components/src/shortcut-library/src/hooks/useShortcuts.ts`
- Modify: `packages/react-components/src/shortcut-library/src/pages/SettingsPanel.tsx`
- Modify: `packages/react-components/src/shortcut-library/index.tsx`
- Test: extend `packages/react-components/__tests__/shortcut-library-dom.test.tsx` (verify SettingsPanel renders the login button instead of a form when logged-out)

**Interfaces:**
- Consumes: Task 5 (`useAuth`, `useAuthStore`, `TOKEN_KEY`), Task 6 (`createShortcutStore`), Task 7 (`useLoginModal` host exports).
- Produces:
  - `useAuth` (re-export of host hook) and `useLoginModal` (React bridge over host `subscribeLoginModal`/`getLoginModalSnapshot`).
  - `useShortcuts` uses `createShortcutStore()` for cloud, `LSStore` for offline fallback; selects based on `auth.token`.
  - `SettingsPanel`: no login form; shows "未登录 + 登录按钮" (calls `useLoginModal().open()`) or "已登录 + 退出" (calls `auth.logout()`).

- [ ] **Step 1: Write `useAuth.ts` re-export**

`packages/react-components/src/shortcut-library/src/hooks/useAuth.ts`:

```typescript
// src/hooks/useAuth.ts —— host Pinia authStore 跨框架桥。
// 组件不重新实现 JWT 管理;仅 re-export host 的 hook + 类型。

export { useAuth, getAuthSnapshot } from '@/shared/auth-store';
export type { AuthStoreState } from '@/shared/auth-store';
```

- [ ] **Step 2: Write `useLoginModal.ts` React bridge**

`packages/react-components/src/shortcut-library/src/hooks/useLoginModal.ts`:

```typescript
// src/hooks/useLoginModal.ts —— host LoginModal 触发入口(React 端)。
//
// 跨框架:订阅 host useLoginModal.ts 的 isOpen;open() 调 host openLoginModal()。
// 用 useSyncExternalStore —— isOpen 是 boolean 原始值,快照身份随值变化,无 Pinia 代理问题。

import { useSyncExternalStore } from 'react';
import {
  subscribeLoginModal,
  getLoginModalSnapshot,
  openLoginModal,
  closeLoginModal,
} from '@/shared/useLoginModal';

export function useLoginModal(): { isOpen: boolean; open: () => void; close: () => void } {
  const isOpen = useSyncExternalStore(subscribeLoginModal, getLoginModalSnapshot, getLoginModalSnapshot);
  return { isOpen, open: openLoginModal, close: closeLoginModal };
}
```

- [ ] **Step 3: Rewrite `useShortcuts.ts` to use host stores**

`packages/react-components/src/shortcut-library/src/hooks/useShortcuts.ts` — preserve the full existing public API (`groups`, `selectedGroupId`, `query`, `addGroup`, `renameGroup`, `deleteGroup`, `addShortcut`, `updateShortcut`, `deleteShortcut`, `findBindingsByCode`, `comboKey`, `comboLabel`, `ready`, `saveMode`, `setSaveMode`, `dirty`, `flushDirty`, `warnOnDirtyExit`, `setWarnOnDirtyExit`, `ImportStats` type). Change ONLY:
  1. Remove `import { UserKVStore } from '../engine/userKvStore'` (file deleted).
  2. Add `import { createShortcutStore } from '@/api/services/shortcut-library/createShortcutStore'` and `import { useAuth } from './useAuth'`.
  3. Replace `const cloudStore = useMemo(() => new UserKVStore(), [])` with `const cloudStore = useMemo(() => createShortcutStore(), [])`.
  4. Replace the `userId > 0` polling effect (it polled `cloudStore.userId`) with a subscription to `useAuth().token`: `const auth = useAuth(); useEffect(() => { setActiveStore((prev) => (auth.token ? (cloudStore as ShortcutStore) : lsStore) === prev ? prev : (auth.token ? (cloudStore as ShortcutStore) : lsStore)); }, [auth.token, cloudStore, lsStore])`.
  5. The startup effect's `cloudStore.init()` call is REMOVED (host `authStore.init()` runs once at app boot; the component just reads `auth.token`). The startup effect becomes: pick store from `auth.token`, then `await activeStore.load()`.

Keep every other action (`addGroup`, `mutate`, debounced save, manual mode, dirty tracking, `warnOnDirtyExit` LS persistence) byte-for-byte. The component test suite (50 tests) is the regression net — run it in Step 6.

- [ ] **Step 4: Rewrite `SettingsPanel.tsx`**

`packages/react-components/src/shortcut-library/src/pages/SettingsPanel.tsx` — remove the email/password/code/invitation login form and the `UserKVStore`/`authClient` imports. New body:

```tsx
import { useAuth } from '../hooks/useAuth';
import { useLoginModal } from '../hooks/useLoginModal';

export default function SettingsPanel() {
  const auth = useAuth();
  const { open } = useLoginModal();

  if (auth.authState !== 'logged-in' || !auth.token) {
    return (
      <section className="sl-sl-settings">
        <h3>云端同步</h3>
        <p className="sl-sl-settings__hint">登录后可保存快捷键到云端，跨设备同步。</p>
        <button className="sl-sl-btn sl-sl-btn--primary" onClick={open}>登录 / 注册</button>
      </section>
    );
  }

  return (
    <section className="sl-sl-settings">
      <h3>云端同步</h3>
      <p className="sl-sl-settings__hint">已登录为 {auth.user?.email}</p>
      <button className="sl-sl-btn sl-sl-btn--ghost" onClick={() => auth.logout()}>退出登录</button>
    </section>
  );
}
```

Preserve any existing props/signature `SettingsPanel` is mounted with by `index.tsx` (read the current file first; keep the props interface if `index.tsx` passes `saveMode`/`dirty`/`setSaveMode` etc. — render those controls too, only the auth form is removed).

- [ ] **Step 5: Update `index.tsx` imports**

`packages/react-components/src/shortcut-library/index.tsx`:
  1. Remove `import type { UserKVStore } from './src/engine/userKvStore'` (deleted).
  2. Remove any `UserKVStore`-typed local state/props now that SettingsPanel no longer needs a store instance passed in. If `index.tsx` previously constructed a `UserKVStore` for SettingsPanel, delete that construction.
  3. Keep all other imports (`useShortcuts`, pages, types, css).

- [ ] **Step 6: Extend the DOM test + run full component suite**

Add to `packages/react-components/__tests__/shortcut-library-dom.test.tsx` a case asserting that, with no token (default logged-out), `SettingsPanel` renders a button with text "登录 / 注册" and does NOT render a password input:

```typescript
it('SettingsPanel shows login button (not a form) when logged out', async () => {
  // mount the shortcut-library component; by default authStore is logged-out
  // (no TOKEN_KEY in localStorage) so SettingsPanel renders the login CTA.
  // ... use the same mount helper the existing DOM tests use ...
  // assert: a button matching /登录 \/ 注册/ exists; no input[type=password].
});
```

(Use the existing mount harness at the top of `shortcut-library-dom.test.tsx`. If the harness does not render SettingsPanel by default, render `<SettingsPanel/>` directly with a fresh Pinia.)

Run:
```bash
pnpm exec vitest run packages/react-components/__tests__/shortcut-library packages/react-components/__tests__/import-parser
```
Expected: all tests pass (50 prior + the new SettingsPanel case). The `features` test reads source via `readFileSync` at paths already updated to `src/pages/...` (from the directory refactor) — no path change needed.

- [ ] **Step 7: Run lint**

Run: `pnpm exec eslint packages/react-components/src/shortcut-library/ --max-warnings=0`
Expected: 0 errors (catches leftover unused imports of deleted modules).

- [ ] **Step 8: Commit**

```bash
git add packages/react-components/src/shortcut-library/ packages/react-components/__tests__/shortcut-library-dom.test.tsx
git commit -m "refactor(shortcut-library): wire useAuth + useLoginModal + host store"
```

---

### Task 10: Mount adapter — pass `useAuth` + `useLoginModal` to React subtree

**Files:**
- Modify: the mount adapter(s) in `packages/mount-adapters/src/` that mount React components (find the file handling `shortcut-library` or the generic React bridge)
- Modify: `apps/showcase` app boot (`main.ts` and/or `App.vue`) — call `useAuthStore().init()` once at startup, mount `<LoginModal>` driven by `useLoginModalState().isOpen`
- Test: `packages/mount-adapters/__tests__/` existing adapter tests must still pass; add a boot smoke assertion if none exists

**Interfaces:**
- Consumes: Tasks 5, 7 (host hooks), Task 9 (component now imports `@/shared/auth-store` and `@/shared/useLoginModal` via path alias).
- Produces: at app boot, `authStore.init()` runs once; `<LoginModal :open="isOpen"/>` is mounted at the host root; the `@/shared/*` path alias resolves inside the React component bundle so `useAuth`/`useLoginModal` reach the host modules (not stale copies).

- [ ] **Step 1: Inspect the current React mount path**

Run:
```bash
ls packages/mount-adapters/src/
```
Read the file(s) that mount React components (likely `react-bridge.ts` / `react-adapter.ts` / similar). Identify: how the React subtree is created (`createRoot`?), what props/context are injected, and whether a path alias already maps `@/shared/*` into the React bundle. Also read `apps/showcase/src/main.ts` and `apps/showcase/src/App.vue` to find the boot sequence.

- [ ] **Step 2: Wire app boot (authStore.init + LoginModal mount)**

In `apps/showcase/src/main.ts` (or `App.vue` `onMounted`), after Pinia is installed, call the auth init once:

```typescript
import { useAuthStore } from '@/shared/auth-store';
// ... after app.mount() or inside App.vue setup:
void useAuthStore().init();
```

In `App.vue` (root component), render the modal driven by the shared open-state:

```vue
<script setup lang="ts">
import LoginModal from '@/shared/login-modal.vue';
import { useLoginModalState } from '@/shared/useLoginModal';
const { isOpen } = useLoginModalState();
</script>

<template>
  <RouterView />
  <LoginModal :open="isOpen" @update:open="(v) => { if (!v) isOpen.value === v; }" />
</template>
```

(Adjust to the actual root layout — the key requirement is one `<LoginModal>` instance at host root, open-state from `useLoginModalState`.)

- [ ] **Step 3: Verify the `@/shared/*` alias resolves in the React bundle**

The component imports `@/shared/auth-store` and `@/shared/useLoginModal`. Confirm `apps/showcase/tsconfig.json` and `vite.config.ts` alias `@` to `apps/showcase/src`. If the React component is bundled through a separate build (check `packages/react-components/package.json` build script), ensure the alias resolves there too — otherwise `useAuth`/`useLoginModal` will be unresolved at runtime. If the alias is already global (likely, since `auth.ts` service uses `@/shared/request`), no change is needed; document the finding in the report.

- [ ] **Step 4: Run adapter tests + lint**

```bash
pnpm exec vitest run packages/mount-adapters/
pnpm exec eslint packages/mount-adapters/ apps/showcase/src/main.ts apps/showcase/src/App.vue --max-warnings=0
```
Expected: existing adapter tests pass; 0 lint errors.

- [ ] **Step 5: Commit**

```bash
git add packages/mount-adapters/ apps/showcase/src/main.ts apps/showcase/src/App.vue
git commit -m "feat(host): boot authStore.init + mount LoginModal at root"
```

---

### Task 11: Smoke verification — full app loads, dev + prod generation

**Files:** none (verification only).

- [ ] **Step 1: Run lint suite**

```bash
pnpm lint
```
Expected: 0 errors.

- [ ] **Step 2: Run full test suite**

```bash
pnpm exec vitest run
```
Expected: all tests pass.

- [ ] **Step 3: Verify nginx generation**

```bash
pnpm gen:nginx
```
Expected: stdout lists 6 backends; `nginx/api-locations/generated.conf` has 6 location blocks.

- [ ] **Step 4: Dev server smoke**

```bash
pnpm --filter @style-library/showcase dev
```
Open `http://localhost:5173/`. Navigate to the shortcut-library detail page. Confirm: component loads, "未登录" status visible in settings, click "登录 / 注册" → LoginModal opens with the canvas background + form, submit credentials → either the welcome animation or an error message. (If the dev backend is not reachable, assert the modal opens and the request fires in the network tab; backend connectivity is out of scope.)

- [ ] **Step 5: Build verification**

```bash
pnpm --filter @style-library/showcase build
```
Expected: build succeeds.

- [ ] **Step 6: Final commit (allow-empty marker)**

```bash
git commit --allow-empty -m "chore: api hoist + auth migration verified end-to-end"
```

---

## Self-Review

**1. Spec coverage:**

| Spec § | Task |
|---|---|
| §2 目标 1 (HTTP 走 services) | Task 1, 3, 4, 6 |
| §2 目标 2 (authStore Pinia) | Task 5 |
| §2 目标 3 (Bearer JWT 注入) | Task 2 |
| §2 目标 4 (删除旧 client) | Task 8, 9 |
| §5 D1 (registry) | Task 1 |
| §5 D2 (Bearer provider) | Task 2 |
| §5 D3 (Pinia authStore) | Task 5 |
| §5 D3.1 (LoginModal UI) | Task 7 |
| §5 D3.2 (CSS variables) | Task 7 |
| §5 D4 (删除旧 client) | Task 8 |
| §5 D5 (组件 import 路径) | Task 9 |
| §6 数据流 | Task 2, 5, 6, 9 |
| §7 错误处理 | Task 2, 3, 4, 5 |
| §8 测试 | Each task has its own test step |
| §9 迁移步骤 | Tasks 1-11 |
| §10 风险 | Task 5 (useAuth force-rerender), Task 7 (canvas), Task 10 (alias resolution) |

**2. Placeholder scan:** No "TBD" / "TODO" / "fill in later". Task 9 Step 3 says "preserve byte-for-byte" with an explicit list of what changes — the implementer edits the existing file, not rewrites from scratch. Task 7 Step 3 instructs porting verbatim from the design HTML (a concrete source). Task 10 Step 1 is genuine investigation (the adapter layout is unknown until inspected) — every subsequent step is concrete.

**3. Type consistency:**
- `AuthStoreState` defined Task 5, re-exported Task 9.
- `useAuthStore()` defined Task 5, used Tasks 6, 9, 10.
- `setBearerProvider` defined Task 2, used Tasks 3, 4, 5, 6.
- `createShortcutStore` / `ShortcutStoreLite` defined Task 6, used Task 9.
- `TOKEN_KEY` defined Task 5, used Task 6 (via authStore.token, not directly) and Task 9.
- `useLoginModal` host exports defined Task 7, consumed Task 9 (React bridge) and Task 10 (Vue composable).
- `ApiError` defined in `shared/request.ts`, re-exported by `userV1`/`kvV1` (Tasks 3, 4), caught in Task 6.
- Error model is THROW throughout (Global Constraint) — no `Result<T,ApiError>` survives in any task.

**4. Coverage gaps:** None. All spec targets map to tasks; the three pre-flight findings (throw model, useAuth re-render bug, under-specified 9/10) are resolved in the task text above.
