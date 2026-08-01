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
import { defaultTokens } from '../theme/tokens';

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
    // 卸载前 deactivate 该组件的 dev proxy(如果声明了 api)。
    // 注意:必须先 deactivate 再 unmount,否则组件内部的 fetch 可能晚到
    // 一拍被 proxy 错误转发。失败被吞(只是 dev 便利,不影响功能)。
    void fetch(`/__mfe/deactivate?id=${encodeURIComponent(this.id)}`).catch(() => {});
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

  // 挂载前 activate:让 mfeDynamicProxy 切换到本组件的 api 规则。
  // 不 await:fetch 是同步发起 + server 端 activate 立即设 activeId,
  // 组件 loader() 在同一 microtask 后执行,首个 fetch 一定看到 activeId 已设。
  // 失败被吞(没有声明 api 的组件 activate 是 no-op)。
  void fetch(`/__mfe/activate?id=${encodeURIComponent(componentId)}`).catch(() => {});

  try {
    const loader = loaders[entry.loaderKey];
    if (!loader) {
      throw new Error(`No loader registered for "${entry.loaderKey}"`);
    }
    const mod = await loader();
    // 已被新 mount 顶掉(session 已被 cleanup)——不要再用本 session 的 host
    if (session.isAborted()) return;
    const adapter = selectAdapter(createAdapters(), entry.framework);
    const mounted = await adapter.mount(mod, {
      container: session.host.portalTarget,
      shadowRoot: session.host.shadowRoot,
      props: {},
      theme: { colorScheme: 'light', tokens: defaultTokens, namespace: 'sl' },
      signal: session.abort.signal,
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