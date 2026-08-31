// composables/useBrandIcon.ts —— 品牌图标状态 + KV/fileV1 持久化
//
// 职责:
//   1) 提供响应式 iconUrl(variant + KV 共同决定)
//   2) 启动时读 KV 'brand_icon'(tags=['brand']);若 KV 缺失 + 已登录,
//      自动把 public/brand/ve-color.png 上传到 backend(fileV1,accessLevel=public,
//      tags=['brand'])并写回 KV,完成"自举"
//   3) 提供 setVariant('color'|'outline') / uploadCustom(Blob) / reset() 操作
//   4) 未登录时:直接返回静态 /brand/ve-color.png,不触发任何后端调用
//
// KV 契约:
//   - key  'brand_icon'  value = JSON.stringify({ fileId, url, variant })
//                       tags = ['brand']
//   - file tags = ['brand'],accessLevel=public
//
// 离线 fallback:
//   - 未登录 / KV 失败 → 直接用静态 URL,组件照常渲染

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import { kvV1Service, fileV1Service } from '@/api/services';
import { jwtAuth } from '@/api/http/auth-store';
import { resolveFileUrl } from '@/api/tools/file-url';

export type BrandVariant = 'color' | 'outline' | 'custom';

export interface BrandIconRef {
  fileId: string;
  url: string;
  variant: BrandVariant;
  /** custom 时记录原文件名,UI 提示用 */
  originalName?: string;
}

const TAG = ['brand'] as const;
const KV_KEY = 'brand_icon';

/** 静态兜底 URL:public/brand/ve-color.png 是 repo 自带的默认图标 */
const STATIC_BASE = '/brand/';
const STATIC_FALLBACK: Record<BrandVariant, string> = {
  color:   `${STATIC_BASE}ve-color.png`,
  outline: `${STATIC_BASE}ve-outline.png`,
  custom:  `${STATIC_BASE}ve-color.png`,
};

const LS_KEY = 'wb-showcase:brand-icon:v1';

/* ============================================================
   localStorage fallback(未登录态也能记住用户上次选的 variant)
   ============================================================ */
function loadLS(): BrandVariant {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === 'color' || raw === 'outline' || raw === 'custom') return raw;
  } catch { /* ignore */ }
  return 'color';
}
function saveLS(v: BrandVariant) {
  try { localStorage.setItem(LS_KEY, v); } catch { /* ignore */ }
}

/* ============================================================
   Singleton state
   ============================================================ */
let _store: UseBrandIcon | null = null;

export interface UseBrandIcon {
  /** 当前生效的图标 URL(响应式) */
  iconUrl: ComputedRef<string>;
  /** 当前变体:'color' | 'outline' | 'custom' */
  variant: Ref<BrandVariant>;
  /** 是否有用户自定义(custom variant 且 KV 中有 ref) */
  hasCustom: ComputedRef<boolean>;
  /** 启动/上传中 */
  loading: Ref<boolean>;
  /** 自举/操作错误信息(UI 提示) */
  error: Ref<string | null>;

  /** 切换到 color/outline:重新上传对应静态图到 backend,保存 KV */
  setVariant: (v: 'color' | 'outline') => Promise<void>;
  /** 上传用户自定义图片(custom variant) */
  uploadCustom: (file: Blob, originalName?: string) => Promise<void>;
  /** 重置到 color 默认(删 KV + 旧 file) */
  reset: () => Promise<void>;
}

export function useBrandIcon(): UseBrandIcon {
  if (_store) return _store;

  const variant = ref<BrandVariant>(loadLS());
  const ref_ = ref<BrandIconRef | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  /** 缓存击穿计数器:每次成功切换/上传/重置 +1,让 iconUrl 派生新的 ?v= query,
   *  强制 <img> 重新请求(同 URL 浏览器默认 304 不重渲染) */
  const versionCounter = ref(0);

  /** 当前生效的 URL:
   *   - static variants (color/outline) → 直接用 repo 静态 URL,不走后端(瞬时切换)
   *   - custom → 用 fileV1 上传后的 ref.url(慢一次,后续即时)
   *   末尾拼 ?v=<counter> 让切换时浏览器不命中旧缓存 */
  const iconUrl = computed<string>(() => {
    let base: string;
    if (variant.value === 'custom' && ref_.value?.url) {
      base = ref_.value.url;
    } else {
      base = STATIC_FALLBACK[variant.value];
    }
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}v=${versionCounter.value}`;
  });

  const hasCustom = computed(() => variant.value === 'custom' && !!ref_.value);

  /** 上传 Blob 到 backend(fileV1,public,tags=['brand']),返回 ref */
  async function uploadAndPersist(file: Blob, v: BrandVariant, originalName?: string): Promise<BrandIconRef> {
    const groupId = jwtAuth.state.jwtUser?.defaultGroupId;
    const info = await fileV1Service.upload({ file, groupId, tags: [...TAG] });
    const ref: BrandIconRef = {
      fileId: info.fileId,
      url: resolveFileUrl(info.url),  // 改写成同源相对路径 /files/<fileId>,走 /files/ 代理
      variant: v,
      originalName,
    };
    await kvV1Service.set({
      key: KV_KEY,
      value: JSON.stringify(ref),
      tags: [...TAG],
      ttl: 0,
      groupId,
    });
    return ref;
  }

  /** 只删 file,不动 KV —— setVariant / uploadCustom 切到新 ref 后用这个清旧文件 */
  async function deleteOldFile(old: BrandIconRef | null) {
    if (!old) return;
    const groupId = jwtAuth.state.jwtUser?.defaultGroupId;
    try { await fileV1Service.delete({ fileId: old.fileId, groupId }); } catch { /* ignore */ }
  }

  /** 删 KV + 旧 file —— 仅 reset() 用 */
  async function cleanupKvAndFile(old: BrandIconRef | null) {
    const groupId = jwtAuth.state.jwtUser?.defaultGroupId;
    if (old) await deleteOldFile(old);
    try { await kvV1Service.delete({ key: KV_KEY, groupId }); } catch { /* ignore */ }
  }

  /* ---- 启动加载 ---- */
  // 不再自举上传 color.png —— color/outline 是 repo 静态资源,
  // 直接 URL 即可,无需后端往返。custom 才需要 fileV1。
  // KV 仅用于记住用户上次选的 variant(ref 可空),登录后同步一次即可。
  async function bootstrap() {
    if (!jwtAuth.state.token) return;
    try {
      const groupId = jwtAuth.state.jwtUser?.defaultGroupId;
      const item = await kvV1Service.get({ key: KV_KEY, groupId });
      try {
        const parsed = JSON.parse(item.value) as BrandIconRef;
        if (parsed && parsed.variant) {
          variant.value = parsed.variant;
          if (parsed.variant === 'custom' && parsed.fileId && parsed.url) {
            ref_.value = parsed;
          }
          versionCounter.value++;
          saveLS(parsed.variant);
        }
      } catch { /* 损坏 KV:忽略 */ }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    }
  }

  /** 启动时跑一次(已登录立即;未登录等登录后 watch 触发) */
  if (jwtAuth.state.token) bootstrap();

  /** 登录态变化:刚登录且还没同步过 variant → 触发同步 */
  watch(() => jwtAuth.state.token, (tok) => {
    if (tok) bootstrap();
  });

  /* ---- 公开操作 ---- */
  // 静态变体(color/outline):不走后端,只改本地 state + LS 持久化 + KV 同步 variant。
  // 这样切换瞬时,没有 fileV1/KV 等待。
  async function setVariant(v: 'color' | 'outline') {
    if (v !== 'color' && v !== 'outline') return;
    error.value = null;
    const old = ref_.value;
    // 立刻改本地,UI 立即换帧(不阻塞)
    variant.value = v;
    versionCounter.value++;
    saveLS(v);
    ref_.value = null;  // 静态变体不占 ref
    // 异步同步 KV(不阻塞 UI)
    syncVariantToKv(v).catch((e) => {
      error.value = e instanceof Error ? e.message : String(e);
    });
    // 如果之前是 custom 上传,后台清掉旧 file(不阻塞 UI)
    if (old && old.variant === 'custom') {
      deleteOldFile(old).catch(() => { /* ignore */ });
    }
  }

  async function uploadCustom(file: Blob, originalName?: string) {
    error.value = null;
    loading.value = true;
    try {
      const old = ref_.value;
      ref_.value = await uploadAndPersist(file, 'custom', originalName);
      variant.value = 'custom';
      versionCounter.value++;
      saveLS('custom');
      if (old) deleteOldFile(old).catch(() => { /* ignore */ });
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function reset() {
    error.value = null;
    loading.value = true;
    try {
      const old = ref_.value;
      ref_.value = null;
      variant.value = 'color';
      saveLS('color');
      versionCounter.value++;
      // 清掉 custom 的 file + KV
      await cleanupKvAndFile(old);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  /** 把当前 variant 同步到 KV(不传 file 信息,只持久化 variant 字段)。
   *  后台调用,不阻塞 UI。失败仅记 error,不影响渲染(本地 LS 已持久化)。 */
  async function syncVariantToKv(v: BrandVariant) {
    if (!jwtAuth.state.token) return;
    const groupId = jwtAuth.state.jwtUser?.defaultGroupId;
    const value = JSON.stringify({
      variant: v,
      // custom 时 ref_ 已有; static 时不带 fileId/url(下次启动直接走静态)
      ...(v === 'custom' && ref_.value
        ? { fileId: ref_.value.fileId, url: ref_.value.url, originalName: ref_.value.originalName }
        : {}),
    });
    await kvV1Service.set({
      key: KV_KEY,
      value,
      tags: [...TAG],
      ttl: 0,
      groupId,
    });
  }

  _store = {
    iconUrl,
    variant,
    hasCustom,
    loading,
    error,
    setVariant,
    uploadCustom,
    reset,
  };
  return _store;
}