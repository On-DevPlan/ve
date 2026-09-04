<!-- GameListView — 游戏 tab 的列表页：从 GAME_SKIN_REGISTRY 生成游戏卡片，点击进入详情。 -->
<script setup lang="ts">
import { GAME_SKIN_REGISTRY } from '../composables/gameSkinRegistry';

const emit = defineEmits<{ (e: 'select', gameId: string): void }>();

const games = Object.values(GAME_SKIN_REGISTRY);
</script>

<template>
  <section>
    <p class="csa-help">
      选择一个游戏管理其皮肤资产（KV public <code>&lt;game&gt;_skin:index</code>）。
    </p>
    <div class="csa-games">
      <button
        v-for="g in games"
        :key="g.gameId"
        class="csa-game-card"
        @click="emit('select', g.gameId)"
      >
        <span class="csa-game-card__icon" />
        <span class="csa-game-card__name">{{ g.displayName }}</span>
        <span class="csa-game-card__meta">
          <span class="csa-badge">{{ g.assetKeys.length }} 项资产</span>
          <span class="csa-badge csa-badge--mute">{{ g.kvIndexKey }}</span>
        </span>
      </button>
    </div>
  </section>
</template>
