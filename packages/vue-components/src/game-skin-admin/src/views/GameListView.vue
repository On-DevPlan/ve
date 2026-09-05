<!-- GameListView — 对局皮肤游戏列表；卡片上展示各游戏 KV *_skin:index 的皮肤条数。 -->
<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { kvV1Service } from '@api/services';
import { GAME_SKIN_REGISTRY } from '../composables/gameSkinRegistry';
import { isKvKeyMissing, parseJsonArray } from '../composables/kvHelpers';

const emit = defineEmits<{ (e: 'select', gameId: string): void }>();

const games = Object.values(GAME_SKIN_REGISTRY).filter((g) => !g.hiddenInGameList);

/** gameId → KV 皮肤条数；null = 加载中 / 读失败 */
const skinCounts = reactive<Record<string, number | null>>({});

function initial(name: string): string {
  const t = name.trim();
  return t ? t.slice(0, 1) : '?';
}

async function loadCounts() {
  await Promise.all(
    games.map(async (g) => {
      skinCounts[g.gameId] = null;
      try {
        const item = await kvV1Service.get({ key: g.kvIndexKey, groupId: g.groupId });
        skinCounts[g.gameId] = parseJsonArray(item.value).length;
      } catch (e) {
        skinCounts[g.gameId] = isKvKeyMissing(e) ? 0 : null;
      }
    }),
  );
}

onMounted(() => {
  void loadCounts();
});

function countLabel(gameId: string): string {
  const n = skinCounts[gameId];
  if (n === undefined || n === null) return '读取中';
  return `${n} 套皮肤`;
}
</script>

<template>
  <section>
    <p class="csa-help">
      选择游戏管理对局皮肤。条数来自 KV <code>&lt;game&gt;_skin:index</code>；封面请切「游戏封面」。
    </p>
    <div class="csa-games">
      <button
        v-for="g in games"
        :key="g.gameId"
        type="button"
        class="csa-game-card"
        @click="emit('select', g.gameId)"
      >
        <span class="csa-game-card__top">
          <span class="csa-game-card__icon">{{ initial(g.displayName) }}</span>
          <span class="csa-game-card__titles">
            <span class="csa-game-card__name">{{ g.displayName }}</span>
            <span class="csa-game-card__id">{{ g.gameId }}</span>
          </span>
          <span
            class="csa-game-card__go"
            aria-hidden="true"
          >→</span>
        </span>
        <span class="csa-game-card__meta">
          <span class="csa-badge csa-badge--info">{{ countLabel(g.gameId) }}</span>
          <span class="csa-badge">{{ g.assetKeys.length }} 项/套</span>
          <span class="csa-badge csa-badge--mute">{{ g.kvIndexKey }}</span>
        </span>
        <span class="csa-game-card__hint">展示 · 更换 · 上传</span>
      </button>
    </div>
  </section>
</template>
