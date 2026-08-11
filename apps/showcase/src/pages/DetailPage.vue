<script setup lang="ts">
// DetailPage.vue —— 单个组件的详情页外壳(spec §7.4 + §10.6)。
//
// 职责:
//   1) 从 route.meta.componentId 查 registry.get(id)
//   2) 用 loaders[entry.loaderKey]() 异步加载组件实现(import.meta.glob 自动扫描)
//   3) 用 selectAdapter(createAdapters(), entry.framework) 找到适配器
//   4) 在 ShadowRootHost 创建的 portal target 里挂载组件,传入主题 contract
//   5) 离开或切换 componentId 时,先 unmount 再 destroy ShadowRoot,避免内存泄漏
//
// 设计要点:
//   - 任何错误(loaderKey 未注册 / adapter 不支持 / 组件实现抛错)都会冒泡到 error.value,
//     模板里渲染一条红色提示条,不破坏整页
//   - 每次 mount 尝试都是独立 MountSession,自己拥有 controller + host + unmount;
//     cleanup 是 session 自己的方法,而不是"几个并行变量协调"——见 B2 重构。

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useRegistry } from '../composables/useRegistry';
import { useLoaders } from '../composables/useLoaders';
import {
  selectAdapter, // 选 adapter
  createAdapters, // adapter 列表
  createShadowRootHost, // 隔离容器工厂
  type ShadowRootHost, // 隔离容器返回类型
} from '@style-library/mount-adapters';
import { collectCss, cssMaps } from '../registry/css-maps';
import { defaultTokens } from '../theme/tokens';
import { createLoadingSkeleton } from '../shared/LoadingSkeleton/skeleton';
// Vite `?raw` 把 CSS 当字符串打包,运行时由 injectCss() adopt 进 ShadowRoot。
// 不能再走全局 import '...skeleton.css' —— Shadow DOM 样式隔离会把全局规则挡在外面,
// 骨架元素无样式生效(只剩默认浏览器样式的"加载中…"裸文字)。
import skeletonCssRaw from '../shared/LoadingSkeleton/skeleton.css?raw';

const route = useRoute();
const registry = useRegistry();
const loaders = useLoaders();
const containerRef = ref<HTMLDivElement | null>(null);
const error = ref<string | null>(null);

// MountSession —— 一次挂载尝试拥有的全部资源。
// 评审 P1-6 重构:不再用三个并行模块变量(currentAbort / currentHost / currentUnmount)
// 协调,而是让每个 session 拥有自己的资源,cleanup 是 session 的内部方法。
class MountSession {
  // 给本次 mount 一个独立的 AbortController;
  // 路由快速切换或 mount 失败时,abort 取消仍挂着的 await loader() / adapter.mount()
  readonly abort = new AbortController();

  // ShadowRoot 挂到 JS 动态创建的独立 div 上,不是 containerRef 本身。
  // 原因:containerRef 是 Vue 管理的 DOM,Vue patch 时会插 light-DOM 子节点;
  // 但 attachShadow() 消耗了元素——Vue 仍以为 light-DOM 子节点在原位置,
  // update 时 insertBefore 报 NotFoundError(commit e656cae + 0ec73a7)。
  // 用独立 div 让 Vue 永远不 patch shadowHost 的子节点。
  readonly shadowHost: HTMLDivElement;
  readonly host: ShadowRootHost;
  unmount?: () => void;

  constructor(public id: string, parent: HTMLElement, tokens: typeof defaultTokens) {
    this.shadowHost = document.createElement('div');
    parent.appendChild(this.shadowHost);
    this.host = createShadowRootHost({ container: this.shadowHost, tokens });
  }

  // 释放该 session 拥有的全部资源;幂等,多次调用安全。
  cleanup(): void {
    this.abort.abort();
    if (this.unmount) {
      try { this.unmount(); } catch { /* ignore */ }
      this.unmount = undefined;
    }
    try { this.host.destroy(); } catch { /* ignore */ }
    if (this.shadowHost.parentNode) this.shadowHost.parentNode.removeChild(this.shadowHost);
  }

  // 是否已被 abort(挂载中途被新 mount 顶掉)
  isAborted(): boolean {
    return this.abort.signal.aborted;
  }
}

// DetailPage 当前持有的 session——只有它需要 cleanup。
let currentSession: MountSession | null = null;

// 当前展示的组件 id —— 由 router meta 提供
const componentId = computed(() => String(route.meta.componentId ?? ''));

// 挂载一个组件实现
async function mount(componentId: string) {
  // 进入新的挂载前先清理旧 session(避免残留 DOM / 内存泄漏)
  currentSession?.cleanup();
  currentSession = null;
  const entry = registry.get(componentId);
  if (!entry) {
    error.value = `未找到组件: ${componentId}`;
    return;
  }
  const containerEl = containerRef.value;
  if (!containerEl) return;

  error.value = null;
  // 建新 session;本函数后续引用全部走这个 session,不再触碰模块变量。
  const session = new MountSession(componentId, containerEl, defaultTokens);
  currentSession = session;

  // 把骨架样式 adopt 进 ShadowRoot(必须早于骨架出现)。
  // 注意:这次 injectCss 会顺带把 cssReady resolve 掉 —— 这是可接受的,因为:
  //   - injectCss 是同步调用,在 await loader() 之前完成
  //   - 后续的 injectCss(cssTexts) 仍会通过 adoptCssTexts 把组件样式塞进
  //     shadowRoot(只是 cssReady 不再 settle,被首次 settle 短路)
  //   - adapter.mount 仍在 injectCss(cssTexts) 之后才 await cssReady,
  //     组件 CSS 仍在组件 DOM 之前落地(spec §8 时序不变)
  // 150ms 防抖兜底:即便 injectCss 失败(几乎不可能,纯本地 CSS),骨架
  // 也只在 150ms 后才显形,留出补救窗口。
  session.host.injectCss([skeletonCssRaw]);

  // 骨架屏:每次都创建,但 150ms 防抖后才显。
  //   - 快加载(<150ms,常见于已缓存或本地包):debounce 计时器被 clearTimeout
  //     取消并立即 destroy(),用户看不到骨架,避免"一帧闪烁"
  //   - 慢加载(≥150ms):appear() 触发 opacity 0→1,受 MIN_VISIBLE_MS=500 保护,
  //     至少展示 500ms;组件 ready 后再 fadeOut(600ms)
  // 路由级淡入淡出由 App.vue 的 page-fade transition 负责,这里只管 mount 期间的内容占位。
  const SKELETON_DEBOUNCE_MS = 150;
  const earlySkel = createLoadingSkeleton(session.host.portalTarget, {
    themeTokens: {
      '--sl-color-border':
        getComputedStyle(document.documentElement)
          .getPropertyValue('--sl-color-border')
          .trim() || '#d1d5db',
      '--sl-radius-md': '6px',
    },
  });
  let showSkel = false;
  let appearPromise: Promise<void> | null = null;
  const debounceTimer = setTimeout(() => {
    showSkel = true;
    appearPromise = earlySkel.appear();
  }, SKELETON_DEBOUNCE_MS);

  try {
    const loader = loaders[entry.loaderKey];
    if (!loader) {
      throw new Error(`No loader registered for "${entry.loaderKey}"`);
    }
    // 并行拉组件实现 + CSS 文本(spec §5 架构):
    //   - loader() 负责拉组件 chunk,可能跨包 import,自然异步
    //   - collectCss() 现在也是异步(懒加载 loader:per-component 拉对应 CSS chunk,评审 #6)
    // CSS 获取失败不致命:failCss 把 cssReady reject 掉,adapter 走 adoptStylesInto 兜底
    // 无样式渲染,不白屏;返回 null 让下面的 injectCss 跳过。
    const [mod, cssTexts] = await Promise.all([
      loader(),
      collectCss(entry, cssMaps).catch((e) => {
        session.host.failCss(e);
        return null;
      }),
    ]);
    // 已被新 mount 顶掉(session 已被 cleanup)——不要再用本 session 的 host
    if (session.isAborted()) return;
    // CSS 先于组件 DOM 同帧落地(spec §8 时序保证):
    //   injectCss 同步在 ShadowRoot 头部追加 <style data-sl-css>,在
    //   adapter.mount 把 DOM 写进来时样式已可命中。cssTexts 为 null 表示 CSS 取不到
    //   (loaderUrl 远程组件 / collect 失败),跳过注入,cssReady 已被 failCss reject。
    if (cssTexts) session.host.injectCss(cssTexts);
    const adapter = selectAdapter(createAdapters(), entry.framework);
    const mounted = await adapter.mount(mod, {
      container: session.host.portalTarget,
      shadowRoot: session.host.shadowRoot,
      props: {},
      theme: { colorScheme: 'light', tokens: defaultTokens, namespace: 'sl' },
      signal: session.abort.signal,
      // 远程组件(loaderUrl)宿主不注入 CSS → 不传 cssReady,adapter 走 adoptStylesInto
      // 兜底(spec §9);本地组件传 cssReady,等 injectCss / failCss settle。
      cssReady: entry.loaderUrl ? undefined : session.host.cssReady,
    });
    if (session.isAborted()) {
      // 本 session 被顶掉但 mount() 还成功——清掉刚挂上的实例
      try { mounted.unmount(); } catch { /* ignore */ }
      return;
    }
    session.unmount = () => mounted.unmount();
  } catch (err) {
    if (session.isAborted()) return;
    error.value = err instanceof Error ? err.message : String(err);
    session.cleanup();
    currentSession = null;
  } finally {
    // 骨架清理(无论 mount 成功/失败/被顶替都要执行,finally 兜住所有早退路径):
    //   - 慢路径(showSkel=true):等 appear 完成(opacity 已到 1)再 fadeOut,
    //     避免在 opacity 上升途中突然切到 fadeOut 造成闪烁
    //   - 快路径(showSkel=false):mount 在 150ms 内完成,骨架从未显形,
    //     直接 destroy() 即可(earlySkel 还在 opacity:0)
    clearTimeout(debounceTimer);
    if (showSkel) {
      if (appearPromise) await appearPromise.catch(() => undefined);
      void earlySkel.fadeOut(() => earlySkel.destroy());
    } else {
      earlySkel.destroy();
    }
  }
}

// 离开详情页时彻底清理当前 session
onBeforeUnmount(() => {
  currentSession?.cleanup();
  currentSession = null;
});

// componentId 变化时重新挂载。
// 关键:首次挂载必须等模板渲染完(ref 已挂到 DOM),所以走 onMounted;
// 后续 componentId 变化时 watch(componentId) 会拿到新 ref 旧 session,正常 cleanup 后再 mount。
//
// 不要用 { immediate: true } —— watch immediate 会在 setup 阶段就触发,
// 此时 <div ref="containerRef"> 还没渲染,containerRef.value === null,
// 走到 `if (!containerEl) return;` 就提前 return,组件永远不挂载。
onMounted(() => {
  if (componentId.value) void mount(componentId.value);
});

watch(componentId, (id) => {
  if (id) void mount(id);
});
</script>

<template>
  <main class="detail">
    <div class="detail__wrapper">
      <div
        ref="containerRef"
        class="detail__container"
      />
    </div>
    <div
      v-if="error"
      class="detail__error"
    >
      {{ error }}
    </div>
  </main>
</template>

<style scoped>
.detail {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
.detail__wrapper {
  position: absolute;
  inset: 0;
}
.detail__container {
  width: 100%;
  height: 100%;
}
.detail__error {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  padding: 12px 18px;
  color: #b91c1c;
  background: #fee2e2;
  border-radius: 6px;
  max-width: 80vw;
}
</style>