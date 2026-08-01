// userKvStore.ts —— ShortcutStore 的 user/kv 实现(邮箱 + JWT)
//
// 持久化策略(plan §C):
//   - 单 key `shortcuts`,value = JSON.stringify(groups[])
//   - visibility = private(只自己),ttl = 0(永不过期)
//   - 后端走 OnConflict("owner_id","key").Insert(),等价于 upsert,无版本号
//
// 客户端存储:
//   - JWT 存 localStorage('sl-userkv:v1:token')—— JWT 是 bearer token 不是零知识
//     secret,跟一般 API token 同级
//   - email 缓存到 LS('sl-userkv:v1:email')用于下次自动填表
//   - 不缓存 password / verification code
//
// 降级:UserKVStore 必须实现 ShortcutStore.load()/save()。未登录时 load() 返回
// []、save() 直接报错(UI 应该不允许游客触发写)。useShortcuts 自己在没 JWT 时
// 降级到 LSStore。

import type { Group } from './types';
import { createAuthClient, type AuthClient, type Result, type UserInfo } from './authClient';
import { createUserKvClient, type UserKvClient } from './userKvClient';
import type { AuthState, ShortcutStore } from './store';

const TOKEN_KEY = 'sl-userkv:v1:token';
const EMAIL_KEY = 'sl-userkv:v1:email';
const BLOB_KEY = 'shortcuts';

function readLS(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeLS(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota */ }
}
function removeLS(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/**
 * 识别后端 kv Set 的"唯一约束冲突"错误。
 *
 * 后端 `internal/service/kv` 用 `OnConflict("owner_id","key").Insert()` 做 upsert,
 * 但实际会撞 `uq_kv_owner_key` 约束,PG 返回 SQLSTATE 23505,GoFrame 包成
 * `{code: 52, message: "INSERT INTO ... duplicate key value violates unique constraint ..."}`。
 *
 * 判据(任一命中即算):
 *   - code === 52(GoFrame DB 错误码)
 *   - message 含 "duplicate key value violates unique constraint"
 *   - message 含 "23505"
 */
function isDuplicateKeyError(err: { code: number | string; message: string }): boolean {
  if (err.code === 52) return true;
  const m = err.message ?? '';
  return m.includes('duplicate key value violates unique constraint') || m.includes('23505');
}

export interface UserKVStoreOptions {
  baseUrl?: string;
  /** 默认邀请码(后端 ROOT-INIT-2026);UI 预填,用户可改。 */
  defaultInvitationCode?: string;
}

interface CachedCreds {
  token: string;
  userId: number;
  user: UserInfo | null;
}

export class UserKVStore implements ShortcutStore {
  readonly authState: AuthState = 'logged-out';
  readonly currentUser: UserInfo | null = null;
  /** 同步状态:idle / 正在写 / 上次写失败 */
  readonly syncState: 'idle' | 'syncing' | 'error' = 'idle';
  /** 上次成功同步的时间戳(ms epoch);0 = 从未同步过 */
  readonly lastSyncAt: number = 0;
  /** 上次同步失败的 message;null = 无错 */
  readonly lastSyncError: string | null = null;

  private auth: AuthClient;
  private kv: UserKvClient;
  private creds: CachedCreds | null = null;
  private cached: Group[] | null = null;
  // debounce saves
  private writeTimer: number | null = null;
  private defaultInvitationCode: string;

  constructor(opts: UserKVStoreOptions = {}) {
    this.defaultInvitationCode = opts.defaultInvitationCode ?? 'ROOT-INIT-2026';
    this.auth = createAuthClient({
      baseUrl: opts.baseUrl ?? '',
      getAuthToken: () => this.creds?.token ?? null,
    });
    this.kv = createUserKvClient({
      baseUrl: opts.baseUrl ?? '',
      getAuthToken: () => this.creds?.token ?? null,
    });

    // live getters —— state 变化时 UI 立即看到
    Object.defineProperty(this, 'authState', {
      get: () => this._authState,
      enumerable: true,
      configurable: true,
    });
    Object.defineProperty(this, 'currentUser', {
      get: () => this.creds?.user ?? null,
      enumerable: true,
      configurable: true,
    });
    // 同步状态 + 上次成功时间(渲染到 banner 显示"已同步 N 秒前")
    Object.defineProperty(this, 'syncState', {
      get: () => this._syncState,
      enumerable: true,
      configurable: true,
    });
    Object.defineProperty(this, 'lastSyncAt', {
      get: () => this._lastSyncAt,
      enumerable: true,
      configurable: true,
    });
    Object.defineProperty(this, 'lastSyncError', {
      get: () => this._lastSyncError,
      enumerable: true,
      configurable: true,
    });
  }

  private _authState: AuthState = 'logged-out';
  private _syncState: 'idle' | 'syncing' | 'error' = 'idle';
  private _lastSyncAt: number = 0;
  private _lastSyncError: string | null = null;

  /** 当前登录用户 ID;0 = 未登录 */
  get userId(): number {
    return this.creds?.userId ?? 0;
  }

  /** 当前登录用户的邀请码(用于展示);空 = 未登录 */
  get invitationCode(): string {
    return this.creds?.user?.invitationCode ?? '';
  }

  // ---- 认证流程 --------------------------------------------------------

  async init(): Promise<{ mode: 'login' | 'register' } | null> {
    // 启动时尝试用 LS 里的 token 恢复会话
    const token = readLS(TOKEN_KEY);
    if (!token) {
      this._authState = 'logged-out';
      return null;
    }

    // 临时塞 creds 调 /user/info 验证 token
    this.creds = { token, userId: 0, user: null };
    const infoRes = await this.auth.info();
    if (!infoRes.ok) {
      // token 过期或无效 — 清 LS + 清 in-memory creds,让用户重新登录
      // (启动期这是唯一可接受的自动 logout 路径,因为没"操作"可丢)
      removeLS(TOKEN_KEY);
      this.creds = null;
      this._authState = 'logged-out';
      return null;
    }
    this.creds = { token, userId: infoRes.value.id, user: infoRes.value };
    writeLS(EMAIL_KEY, infoRes.value.email);
    this._authState = 'logged-in';
    console.info('[userkv] restored session for', infoRes.value.email);
    return { mode: 'login' };
  }

  async sendCode(email: string): Promise<void> {
    if (!email) throw new Error('email required');
    const r = await this.auth.sendCode(email);
    if (!r.ok) throw new Error(r.error.message || 'send-code failed');
  }

  async register(args: {
    email: string;
    password: string;
    code: string;
    invitationCode?: string;
    nickname?: string;
  }): Promise<void> {
    const r = await this.auth.register({
      email: args.email,
      password: args.password,
      code: args.code,
      invitationCode: args.invitationCode ?? this.defaultInvitationCode,
      nickname: args.nickname,
    });
    if (!r.ok) throw new Error(r.error.message || 'register failed');
    // 注册成功后自动 login
    await this.login(args.email, args.password);
  }

  async login(email: string, password: string): Promise<void> {
    this._authState = 'syncing';
    const r = await this.auth.login({ email, password });
    if (!r.ok) {
      this._authState = 'logged-out';
      throw new Error(r.error.message || 'login failed');
    }
    this.creds = { token: r.value.token, userId: r.value.userId, user: null };
    writeLS(TOKEN_KEY, r.value.token);
    writeLS(EMAIL_KEY, email);
    // 拉 user info 拿邀请码等展示字段
    const infoRes = await this.auth.info();
    if (infoRes.ok) {
      this.creds = { token: r.value.token, userId: r.value.userId, user: infoRes.value };
    }
    this._authState = 'logged-in';
    console.info('[userkv] logged in as', email);
  }

  logout(): void {
    this.creds = null;
    this.cached = null;
    removeLS(TOKEN_KEY);
    removeLS(EMAIL_KEY);
    this._authState = 'logged-out';
  }

  async regenerateInvitation(): Promise<string> {
    if (!this.creds) throw new Error('not logged in');
    this._authState = 'syncing';
    const r = await this.auth.regenerateInvitation();
    if (!r.ok) {
      this._authState = 'error';
      throw new Error(r.error.message || 'regenerate failed');
    }
    // 更新缓存的 user
    if (this.creds.user) {
      this.creds = { ...this.creds, user: { ...this.creds.user, invitationCode: r.value.invitationCode } };
    }
    this._authState = 'logged-in';
    return r.value.invitationCode;
  }

  // ---- 数据读写 --------------------------------------------------------

  async load(): Promise<Group[]> {
    if (this.cached) return this.cached;
    if (!this.creds) return [];

    this._authState = 'syncing';
    const r = await this.kv.get({ key: BLOB_KEY });
    if (!r.ok) {
      // "key not found"(code 50)→ 视为空(首次用户)
      if (r.error.code === 50) {
        this.cached = [];
        this._authState = 'logged-in';
        return [];
      }
      // 401 → 不自动 logout(理由同 _doSave)。保持 creds,改 error 状态。
      // 这样用户至少能看到 sync pill 变红 + 提示信息,而不是突然被登出。
      if (r.error.status === 401) {
        this._authState = 'error';
        this._lastSyncError = 'session expired';
        throw new Error('userkv session expired, please login again');
      }
      this._authState = 'error';
      throw new Error(`userkv load failed: ${r.error.message}`);
    }

    try {
      const groups = JSON.parse(r.value.value) as Group[];
      this.cached = groups;
      this._authState = 'logged-in';
      return groups;
    } catch (e) {
      this._authState = 'error';
      throw new Error(`userkv parse failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async save(groups: Group[]): Promise<void> {
    if (!this.creds) {
      // 静默失败:UI 应该已经知道没登录,不应该让游客触发 save
      console.warn('[userkv] save called without login, dropped');
      return;
    }
    // debounce 200ms
    if (this.writeTimer !== null) window.clearTimeout(this.writeTimer);
    this.writeTimer = window.setTimeout(() => {
      void this._doSave(groups).catch((e: unknown) => {
        this._authState = 'error';
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[userkv] save failed:', msg);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sl-userkv:save-error', { detail: msg }));
        }
      });
      this.writeTimer = null;
    }, 200);
  }

  private async _doSave(groups: Group[]): Promise<void> {
    if (!this.creds) throw new Error('not logged in');
    this._authState = 'syncing';
    this._syncState = 'syncing';

    const payload = {
      key: BLOB_KEY,
      value: JSON.stringify(groups),
      visibility: 'private' as const,
      ttl: 0,
    };

    let r = await this.kv.set(payload);

    // 后端 workaround:kv Set 用 OnConflict("owner_id","key").Insert() 做 upsert,
    // 但实际会撞 uq_kv_owner_key 唯一约束(23505 → code 52)。
    // 兜底:先 DELETE 再 POST。非原子,但这是后端修好前唯一可行路径。
    if (!r.ok && isDuplicateKeyError(r.error)) {
      console.warn('[userkv] upsert conflict, falling back to delete+insert');
      const del = await this.kv.delete({ key: BLOB_KEY });
      // DELETE 失败也继续尝试 POST —— 可能是并发已经删掉了
      if (!del.ok && del.error.status === 401) {
        this._authState = 'error';
        this._syncState = 'error';
        this._lastSyncError = 'session expired';
        throw new Error('userkv session expired, please login again');
      }
      r = await this.kv.set(payload);
    }

    if (!r.ok) {
      // 401 → 不自动 logout!服务端可能临时返回(后端 jwt 中间件 bug 等),
      // 自动 logout 会让用户措手不及。改为设 error 状态 + 抛错,让 UI 决定。
      if (r.error.status === 401) {
        this._authState = 'error';
        this._syncState = 'error';
        this._lastSyncError = 'session expired';
        throw new Error('userkv session expired, please login again');
      }
      this._authState = 'error';
      this._syncState = 'error';
      this._lastSyncError = r.error.message;
      throw new Error(`userkv save failed: ${r.error.message}`);
    }
    this.cached = groups;
    this._authState = 'logged-in';
    this._syncState = 'idle';
    this._lastSyncAt = Date.now();
    this._lastSyncError = null;
  }

  // ---- diagnostics -----------------------------------------------------

  async health(): Promise<Result<{ status: 'ok' }, { code: string; message: string; status: number }>> {
    return { ok: true, value: { status: 'ok' } };
  }
}