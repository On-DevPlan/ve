<!--
  测试 fixture:被 ESLint 当作"已正确写的 Vue SFC 样例"使用。
  验证仓库的 Vue + composition-api 规则,
  对 <script setup lang="ts"> + <template> 的最简形态不会误报。
  任何对 Vue 规则的调整,都应该顺便回归这个文件。
-->
<script setup lang="ts">
// Vue 3 响应式 API:把基础类型包成 ref
import { ref } from 'vue';

// 计数器状态
const count = ref(0);
</script>

<template>
  <!-- 点击自增;模板中变量插值 -->
  <button @click="count++">{{ count }}</button>
</template>