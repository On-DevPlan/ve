<!-- EmojiListView — 游戏资产管理的 Emoji tab：单入口跳转到独立 emoji-pack-admin 路由。
     真列表/上传在 /components/emoji-pack-admin（emoji-pack-admin），此处仅跳转，保持 vite chunk 隔离。
     深链：?scope=chess 由 emoji-pack-admin 的 scope 切换器处理。 -->
<script setup lang="ts">
function goEmojiAdmin() {
  window.location.assign('/components/emoji-pack-admin');
}
</script>

<template>
  <section>
    <div
      class="csa-empty"
      style="gap: 12px"
    >
      <span>表情包在独立管理页</span>
      <span>按 tagScope <code>common-emoji</code> / <code>&lt;gameId&gt;-emoji</code> 管理各游戏通用与专属表情。</span>
      <button
        class="csa-btn csa-btn--primary"
        @click="goEmojiAdmin"
      >
        去表情管理 →
      </button>
      <span class="csa-help">支持 scope 切换、列表、上传</span>
    </div>
  </section>
</template>
