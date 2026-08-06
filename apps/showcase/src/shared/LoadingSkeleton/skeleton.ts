// skeleton.ts —— 框架无关核心:挂载占位 DOM,控制 opacity 渐变,提供 appear / fadeOut / destroy。
//
// 视觉:3 根占位 bar(标题栏 + 两行内容),主题色块;spinner + 文字 "加载中…" 增加视觉权重;
// 0.6s ease transition;appear 至少 500ms(避免组件快速 ready 时骨架一闪即逝)。

export interface LoadingSkeletonHandle {
  readonly root: HTMLElement;
  appear(): Promise<void>;
  fadeOut(onFaded?: () => void): Promise<void>;
  destroy(): void;
}

export interface CreateLoadingSkeletonOptions {
  themeTokens?: Record<string, string>;
  className?: string;
}

const FADE_MS = 600;
const MIN_VISIBLE_MS = 500;

function applyThemeTokens(root: HTMLElement, tokens?: Record<string, string>): void {
  if (!tokens) return;
  for (const [k, v] of Object.entries(tokens)) {
    root.style.setProperty(k, v);
  }
}

export function createLoadingSkeleton(
  container: HTMLElement,
  opts?: CreateLoadingSkeletonOptions,
): LoadingSkeletonHandle {
  const root = document.createElement('div');
  root.className = opts?.className ?? 'sl-skel';
  root.style.opacity = '0';
  root.style.transition = `opacity ${FADE_MS}ms ease`;
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');

  // spinner —— CSS keyframes 驱动旋转,无依赖
  const spinner = document.createElement('div');
  spinner.className = 'sl-skel__spinner';

  // 文字提示
  const text = document.createElement('div');
  text.className = 'sl-skel__text';
  text.textContent = '加载中…';

  // 3 根占位 bar —— 简单占位,与组件实际形态无关
  const titleBar = document.createElement('div');
  titleBar.className = 'sl-skel__bar sl-skel__bar--title';
  const line1 = document.createElement('div');
  line1.className = 'sl-skel__bar';
  const line2 = document.createElement('div');
  line2.className = 'sl-skel__bar';

  const bars = document.createElement('div');
  bars.className = 'sl-skel__bars';
  bars.append(titleBar, line1, line2);

  root.append(spinner, text, bars);
  applyThemeTokens(root, opts?.themeTokens);
  container.prepend(root);

  function setOpacity(value: number): Promise<void> {
    return new Promise<void>((resolve) => {
      // 强制 reflow,确保 transition 生效(连续 appear/fadeOut 不叠加)
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      root.offsetHeight;
      root.style.opacity = String(value);
      const onEnd = () => {
        root.removeEventListener('transitionend', onEnd);
        resolve();
      };
      root.addEventListener('transitionend', onEnd);
      // 兜底:transitionend 不触发(浏览器降级/disabled)时,FADE_MS + 50ms 后强制 resolve
      setTimeout(onEnd, FADE_MS + 50);
    });
  }

  let destroyed = false;
  function safeRemove(): void {
    if (destroyed) return;
    destroyed = true;
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  return {
    root,
    appear(): Promise<void> {
      if (destroyed) return Promise.resolve();
      const op = setOpacity(1);
      // 最小可见时长 —— 即使组件几乎瞬时 ready,骨架也要展示至少 500ms,
      // 避免用户看不到"加载中"提示。
      const minVisible = new Promise<void>((r) => setTimeout(r, MIN_VISIBLE_MS));
      return Promise.all([op, minVisible]).then(() => undefined);
    },
    fadeOut(onFaded?: () => void): Promise<void> {
      if (destroyed) {
        onFaded?.();
        return Promise.resolve();
      }
      return setOpacity(0).then(() => {
        safeRemove();
        onFaded?.();
      });
    },
    destroy(): void {
      safeRemove();
    },
  };
}
