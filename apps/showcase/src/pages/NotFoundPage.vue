<!--
  NotFoundPage.vue —— 404 通配页面(M1 白色风格)。
  与 HomePage.vue 保持一致的字体、色调和圆角卡片语言。
-->

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { House, Search, ArrowLeft } from '@lucide/vue';
</script>

<template>
  <main class="not-found">
    <!-- 小型顶栏，风格与首页一致 -->
    <header class="nf-header">
      <div class="nf-header__brand">
        wb / showcase
        <small>Style Library — 2026</small>
      </div>
    </header>

    <section class="nf-card">
      <div class="nf-visual">
        <span class="nf-code">4</span>
        <span class="nf-icon"><Search :size="40" /></span>
        <span class="nf-code">4</span>
      </div>
      <h1 class="nf-title">这里没有组件。</h1>
      <p class="nf-desc">
        您访问的 URL 不属于任何已注册的路由。
        <br>回到首页，浏览组件清单。
      </p>
      <RouterLink to="/" class="nf-btn">
        <ArrowLeft :size="16" />
        返回首页
      </RouterLink>
    </section>

    <!-- 底部占位，保持视觉平衡 -->
    <footer class="nf-foot">
      <House :size="14" />
      wb / showcase · 2026
    </footer>
  </main>
</template>

<style scoped>
.not-found {
  --bg:       #f8f8fa;
  --ink:      #111;
  --ink-soft: #555;
  --ink-mute: #999;
  --line:     #e8e8e8;

  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font-family: "Inter Tight", "PingFang SC", "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 20px;
}

/* ===== 顶栏 ===== */
.nf-header {
  width: 100%;
  padding: 12px 0 8px;
  align-self: flex-start;
}
.nf-header__brand {
  font-family: "Cormorant Garamond", "Songti SC", serif;
  font-size: 26px;
  font-weight: 500;
  letter-spacing: -0.02em;
  color: var(--ink);
}
.nf-header__brand small {
  display: block;
  font-size: 9px;
  font-family: "JetBrains Mono", monospace;
  letter-spacing: 0.2em;
  color: var(--ink-mute);
  margin-top: -2px;
}

/* ===== 卡片 ===== */
.nf-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 16px;
  max-width: 340px;
  margin: auto;
}

.nf-visual {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.nf-code {
  font-family: "Cormorant Garamond", "Songti SC", serif;
  font-size: 72px;
  font-weight: 500;
  line-height: 1;
  color: var(--ink);
}
.nf-icon {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-mute);
}

.nf-title {
  font-family: "Cormorant Garamond", "Songti SC", serif;
  font-size: 28px;
  font-weight: 500;
  color: var(--ink);
  margin: 0;
}
.nf-desc {
  font-size: 14px;
  line-height: 1.7;
  color: var(--ink-soft);
  margin: 0;
}

.nf-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 24px;
  border-radius: 12px;
  background: var(--ink);
  color: #fff;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  transition: opacity .2s;
}
.nf-btn:active { opacity: .8; }

/* ===== 底部 ===== */
.nf-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 20px 0;
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: var(--ink-mute);
  letter-spacing: 0.15em;
}
</style>
