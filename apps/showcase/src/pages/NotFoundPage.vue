<!--
  NotFoundPage.vue —— 404 通配页面(画廊 C 风格,逐字复刻 __preview_404_C.html)。

  路由 src/router/index.ts 里 :pathMatch(.*)* 命中所有未注册的 URL;
  这里给用户一个兜底,提供返回首页的入口。

  RouterLink 直接使用,无需 import:vue-router 4 全局注册了
  <router-link> 与 <RouterLink> 两种写法,后者在 SFC 模板里 PascalCase 更稳。
-->

<script setup lang="ts">
// 无业务逻辑,纯展示;script setup 留空,符合 Vue 3 <script setup> 习惯。
</script>

<template>
  <main class="not-found">
    <section class="poster">
      <div class="num">
        <em>404</em>
      </div>
      <div class="right">
        <div class="topline">
          Error · Path Not Matched
        </div>
        <h2>这里没有组件。</h2>
        <p>您访问的 URL 不属于任何已注册的路由。回到首页，浏览组件清单。</p>
        <RouterLink to="/">
          ← 返回首页
        </RouterLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
/* === 字体分工(与 home_B 对齐)===
     display : Cormorant Garamond → Songti SC(衬线)
     body    : Inter Tight → PingFang SC(无衬线)
     mono    : JetBrains Mono(等宽)                            */

.not-found {
  --paper:       rgba(255, 255, 255, 0.65);
  --ink:         #111;
  --ink-soft:    #555;
  --ink-mute:    #999;
  --line:        #e8e8e8;
  --line-soft:   #f0f0f0;

  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
  background: #ffffff;
  color: var(--ink);
  font-family: "Inter Tight", "PingFang SC", "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* 巨幅 404,几乎占满 */
.poster {
  width: min(1080px, 100%);
  background: var(--paper);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  border: 1px solid var(--line);
  padding: 48px;
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 48px;
  align-items: end;
}
.num {
  font-family: "Cormorant Garamond", "Songti SC", serif;
  font-size: clamp(180px, 28vw, 360px);
  line-height: 0.85;
  letter-spacing: -0.05em;
  font-weight: 500;
  color: var(--ink);
}
.num em { font-style: italic; }

.right {
  padding-bottom: 16px;
  border-left: 1px solid var(--line);
  padding-left: 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-self: stretch;
  justify-content: space-between;
}
.topline {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ink-mute);
}
h2 {
  font-family: "Cormorant Garamond", "Songti SC", serif;
  font-size: 32px;
  font-weight: 500;
  letter-spacing: -0.01em;
  margin: 0;
}
p {
  font-size: 14px;
  line-height: 1.7;
  color: var(--ink-soft);
  margin: 0;
}
a {
  align-self: flex-start;
  padding: 12px 22px;
  border: 1px solid var(--ink);
  color: var(--ink);
  text-decoration: none;
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  transition: background 0.2s, color 0.2s;
}
a:hover { background: var(--ink); color: #fff; }
</style>