<!-- GameDetail — 游戏详情页：为单个 gameId 创建 admin 实例，3 个 tab（展示 | 更换 | 上传） + 返回按钮。 -->
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useSkinAdmin } from '../composables/useSkinAdmin';
import { GAME_SKIN_REGISTRY } from '../composables/gameSkinRegistry';
import PreviewTab from './PreviewTab.vue';
import ReplaceTab from './ReplaceTab.vue';
import ImportTab from './ImportTab.vue';

const props = defineProps<{ gameId: string }>();
const emit = defineEmits<{ (e: 'back'): void }>();

type TabId = 'preview' | 'replace' | 'import';

const tab = ref<TabId>('preview');
const entry = GAME_SKIN_REGISTRY[props.gameId] ?? GAME_SKIN_REGISTRY.chess;
const admin = useSkinAdmin(props.gameId);

const TABS: { key: TabId; label: string; adminOnly: boolean }[] = [
  { key: 'preview', label: '展示', adminOnly: false },
  { key: 'replace', label: '更换', adminOnly: true },
  { key: 'import', label: '上传', adminOnly: true },
];

onMounted(() => {
  if (admin.loginHint.value === null) admin.loadIndex();
});
</script>

<template>
  <section class="csa-detail">
    <div class="csa-detail-head">
      <button
        class="csa-btn csa-btn--ghost csa-btn--sm"
        @click="emit('back')"
      >
        ← 返回游戏列表
      </button>
      <span class="csa-detail-head__title">
        <h3>{{ entry.displayName }}</h3>
        <span class="csa-badge csa-badge--mute">{{ entry.kvIndexKey }}</span>
      </span>
      <span class="csa-crumb">{{ entry.assetKeys.length }} 项资产</span>
      <button
        class="csa-btn csa-btn--ghost csa-btn--sm"
        style="margin-left: auto"
        @click="admin.loadIndex"
      >
        刷新
      </button>
    </div>

    <!-- 详情 3-tab -->
    <nav
      class="csa-tabs"
      role="tablist"
    >
      <button
        v-for="t in TABS"
        :key="t.key"
        role="tab"
        :class="['csa-tabs__item', {
          'is-active': tab === t.key,
          'is-disabled': t.adminOnly && !admin.canEdit.value,
        }]"
        :aria-selected="tab === t.key"
        :disabled="t.adminOnly && !admin.canEdit.value"
        :title="t.adminOnly && !admin.canEdit.value ? '仅 admin 可用' : ''"
        @click="tab = t.key"
      >
        {{ t.label }}<span
          v-if="t.adminOnly && !admin.canEdit.value"
          class="csa-tabs__lock"
        >locked</span>
      </button>
    </nav>

    <!-- status bar（沿用旧 game-skin-admin 的 badge 模式） -->
    <div class="csa-detail__status">
      <span
        v-if="admin.loading.value"
        class="csa-badge csa-badge--info"
      >加载中</span>
      <span
        v-else-if="admin.error.value"
        class="csa-badge csa-badge--danger"
      >{{ admin.error.value }}</span>
      <span
        v-else-if="admin.loginHint.value"
        class="csa-badge csa-badge--warn"
      >未登录 · 只读</span>
      <template v-else>
        <span class="csa-badge">{{ admin.myRole.value ?? '未登录' }}</span>
        <span
          v-if="admin.canEdit.value"
          class="csa-badge csa-badge--ok"
        >可编辑</span>
        <span
          v-else
          class="csa-badge csa-badge--mute"
        >只读</span>
      </template>
    </div>

    <PreviewTab
      v-show="tab === 'preview'"
      :admin="admin"
    />
    <ReplaceTab
      v-show="tab === 'replace'"
      :admin="admin"
    />
    <ImportTab
      v-show="tab === 'import'"
      :admin="admin"
    />
  </section>
</template>

<style scoped>
.csa-detail__status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
</style>
