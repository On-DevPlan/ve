// host-vue.ts —— 从 host-vue.vue SFC 重导出,统一外部 import 入口。
//
// 真实实现在 host-vue.vue(.vue 才能挂 <template>+<script setup>);
// 这里纯粹为了把 SFC 当普通 ES 模块消费。
export { default } from './host-vue.vue';
