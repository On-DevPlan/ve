<!--
  SharedMount.vue —— 在 Vue 树里消费一个共享组件。

  它不创建新的 Vue app（组件本来就在 Vue 运行时里），只做两件事：
    1) 按 anchor 所在的样式作用域注入共享组件 CSS（交给 host-env 策略分派）
    2) 渲染组件并把 componentProps 透传下去

  为什么不直接 import 组件用：那样样式没有保障。共享组件的 CSS 是显式携带的
  （descriptor.css），不走 SFC <style> 的自动注入 —— 见 descriptor.ts 的注释。
  没有壳负责注入，挂上去就是裸样式。两端统一从壳走，行为才一致。

  用法：
    import FileDropZone from '@/shared/components/FileDropZone';
    <SharedMount :module="FileDropZone" :component-props="{ accept: '.toml' }" />

  时序说明：注入在 onMounted 里同步完成，此时 DOM 已插入但浏览器尚未 paint
  （同一 task 内），所以不会出现可见的无样式闪烁 —— 与 React 侧的
  useLayoutEffect 等价。
-->
<template>
  <div
    ref="anchor"
    :class="props.className"
  >
    <component
      :is="props.module.Component"
      v-bind="props.componentProps"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { createHostEnvs, selectHostEnv } from './host-env';
import type { SharedModule } from './descriptor';

const props = withDefaults(
  defineProps<{
    /** 组件的 descriptor（通常直接传组件目录的 default 导出）。 */
    module: SharedModule;
    /** 透传给组件本身的 props。必须是框架无关的纯数据 + 回调。 */
    componentProps?: Record<string, unknown>;
    /** 可选：挂在最外层 div 上的类名，便于调用点微调布局。 */
    className?: string;
  }>(),
  { componentProps: () => ({}), className: undefined },
);

// 与模板 ref="anchor" 同名绑定（script setup 的 ref 自动绑定规则）。
const anchor = ref<HTMLDivElement | null>(null);

onMounted(() => {
  const el = anchor.value;
  if (!el) return;
  // 空字符串 css 由策略内部跳过，这里不做判空。
  const target = selectHostEnv(createHostEnvs(), el);
  target.injectCss(el, [props.module.css]);
});
</script>
