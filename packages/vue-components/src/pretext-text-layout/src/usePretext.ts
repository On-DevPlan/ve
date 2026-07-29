import { onMounted, ref } from 'vue';
import type { FontStatus } from './types';

// 首选命名字体。@chenglou/pretext 官方警告 system-ui 在 macOS 下测量不准,
// 故优先用 Inter;离线 / CDN 不可达时回退 system-ui,功能仍可用。
const PRIMARY_FAMILY = 'Inter';
const FALLBACK_FAMILY = 'system-ui';
const FONT_LOAD_TIMEOUT_MS = 1500;

// 模块级共享状态:多个组件实例(FlowPanel / MeasurePanel)共用同一次字体加载结果。
const status = ref<FontStatus>({
  family: FALLBACK_FAMILY,
  ready: false,
  primary: false,
});
let loading: Promise<void> | null = null;

// 保证只注入一次 Google Fonts <link>(挂在 document.head,全局共享给 canvas 与 DOM)。
let linkInjected = false;
function ensureInterLink(): void {
  if (linkInjected || typeof document === 'undefined') return;
  if (document.querySelector('link[data-sl-pretext-font]')) {
    linkInjected = true;
    return;
  }
  const preconnect1 = document.createElement('link');
  preconnect1.rel = 'preconnect';
  preconnect1.href = 'https://fonts.googleapis.com';
  const preconnect2 = document.createElement('link');
  preconnect2.rel = 'preconnect';
  preconnect2.href = 'https://fonts.gstatic.com';
  preconnect2.crossOrigin = 'anonymous';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href =
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap';
  stylesheet.dataset.slPretextFont = 'true';
  document.head.append(preconnect1, preconnect2, stylesheet);
  linkInjected = true;
}

function loadFont(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    if (typeof document === 'undefined' || !('fonts' in document)) {
      status.value = { family: FALLBACK_FAMILY, ready: true, primary: false };
      return;
    }
    ensureInterLink();
    try {
      await Promise.race([
        document.fonts.load(`16px ${PRIMARY_FAMILY}`),
        new Promise<void>((resolve) => {
          setTimeout(resolve, FONT_LOAD_TIMEOUT_MS);
        }),
      ]);
      await document.fonts.ready;
      const ok = document.fonts.check(`16px ${PRIMARY_FAMILY}`);
      status.value = {
        family: ok ? PRIMARY_FAMILY : FALLBACK_FAMILY,
        ready: true,
        primary: ok,
      };
    } catch {
      status.value = { family: FALLBACK_FAMILY, ready: true, primary: false };
    }
  })();
  return loading;
}

/**
 * 字体加载门禁 + canvas font 构造。
 *
 * canvas `font` 字符串必须与 CSS `font-family` 对齐,否则 pretext 测量与浏览器
 * 渲染不一致。本 composable 统一产出对齐的 font 字符串;family 变化时调用方应
 * 重新 prepare / layout(用 computed 自然会重算)。
 */
export function usePretextFont() {
  onMounted(() => {
    void loadFont();
  });

  const canvasFont = (sizePx: number): string => `${sizePx}px ${status.value.family}`;

  return { status, canvasFont };
}
