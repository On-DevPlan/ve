<!-- game-skin-admin/index.vue — 游戏资产管理主页。
     主 tab：游戏 | 游戏封面 | 表情包
       游戏 → GameListView → GameDetail（展示 | 更换 | 上传）
       游戏封面 → CoversListView
       表情包 → EmojiListView（原 emoji-pack-admin 全功能内嵌）
     深链：?game=chess · ?tab=covers · ?tab=emoji&scope=common
     不用 vue-router（chunk 无该依赖）；用 window.location / history。 -->
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { GAME_SKIN_REGISTRY, isSupportedGameId } from './src/composables/gameSkinRegistry';
import { isSupportedEmojiScope } from './src/composables/emojiRegistry';
import GameListView from './src/views/GameListView.vue';
import GameDetail from './src/views/GameDetail.vue';
import CoversListView from './src/views/CoversListView.vue';
import EmojiListView from './src/views/EmojiListView.vue';

type MainTab = 'games' | 'covers' | 'emoji';

function readTabFromUrl(): MainTab {
  if (typeof window === 'undefined') return 'games';
  const tab = new URLSearchParams(window.location.search).get('tab')?.trim().toLowerCase();
  return tab === 'covers' ? 'covers' : tab === 'emoji' ? 'emoji' : 'games';
}

function readGameFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const g = new URLSearchParams(window.location.search).get('game')?.trim().toLowerCase() ?? '';
  return isSupportedGameId(g) ? g : null;
}

function readScopeFromUrl(): string {
  if (typeof window === 'undefined') return 'common';
  const s = new URLSearchParams(window.location.search).get('scope')?.trim().toLowerCase() ?? '';
  return isSupportedEmojiScope(s) ? s : 'common';
}

function writeUrl(tab: MainTab, game: string | null, scope: string) {
  if (typeof window === 'undefined' || typeof history === 'undefined') return;
  const url = new URL(window.location.href);
  if (tab === 'covers' || tab === 'emoji') url.searchParams.set('tab', tab);
  else url.searchParams.delete('tab');
  if (tab === 'games' && game) url.searchParams.set('game', game);
  else url.searchParams.delete('game');
  if (tab === 'emoji' && scope && scope !== 'common') url.searchParams.set('scope', scope);
  else url.searchParams.delete('scope');
  history.replaceState(null, '', url.toString());
}

const mainTab = ref<MainTab>(readTabFromUrl());
const selectedGame = ref<string | null>(mainTab.value === 'games' ? readGameFromUrl() : null);
const emojiScope = ref<string>(readScopeFromUrl());

function setMainTab(next: MainTab) {
  if (next === mainTab.value) return;
  mainTab.value = next;
  if (next !== 'games') selectedGame.value = null;
  writeUrl(next, selectedGame.value, emojiScope.value);
}

function openGame(gameId: string) {
  selectedGame.value = gameId;
  writeUrl('games', gameId, emojiScope.value);
}

function closeGame() {
  selectedGame.value = null;
  writeUrl('games', null, emojiScope.value);
}

function setEmojiScope(next: string) {
  if (next === emojiScope.value) return;
  emojiScope.value = next;
  writeUrl('emoji', null, next);
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    mainTab.value = readTabFromUrl();
    selectedGame.value = mainTab.value === 'games' ? readGameFromUrl() : null;
    emojiScope.value = readScopeFromUrl();
  });
}

onMounted(() => {
  writeUrl(mainTab.value, selectedGame.value, emojiScope.value);
});

const gameCount = Object.values(GAME_SKIN_REGISTRY).filter((g) => !g.hiddenInGameList).length;
</script>

<template>
  <div class="sl-csa">
    <div class="csa-shell">
      <header class="csa-head">
        <div class="csa-head__brand">
          <span
            class="csa-head__mark"
            aria-hidden="true"
          >GA</span>
          <div class="csa-head__title">
            <h2>游戏资产管理</h2>
            <p class="csa-head__desc">
              对局皮肤 · 游戏封面 · 表情包 · KV public · groupId 190
            </p>
          </div>
        </div>
        <div class="csa-head__meta">
          <span class="csa-badge csa-badge--info">{{ gameCount }} 个皮肤管线</span>
        </div>
      </header>

      <nav
        class="csa-tabs"
        role="tablist"
      >
        <button
          role="tab"
          :class="['csa-tabs__item', { 'is-active': mainTab === 'games' }]"
          :aria-selected="mainTab === 'games'"
          @click="setMainTab('games')"
        >
          对局皮肤
        </button>
        <button
          role="tab"
          :class="['csa-tabs__item', { 'is-active': mainTab === 'covers' }]"
          :aria-selected="mainTab === 'covers'"
          @click="setMainTab('covers')"
        >
          游戏封面
        </button>
        <button
          role="tab"
          :class="['csa-tabs__item', { 'is-active': mainTab === 'emoji' }]"
          :aria-selected="mainTab === 'emoji'"
          @click="setMainTab('emoji')"
        >
          表情包
        </button>
      </nav>

      <main class="csa-main">
        <template v-if="mainTab === 'games'">
          <GameListView
            v-if="!selectedGame"
            @select="openGame"
          />
          <GameDetail
            v-else
            :key="selectedGame"
            :game-id="selectedGame"
            @back="closeGame"
          />
        </template>

        <CoversListView v-else-if="mainTab === 'covers'" />

        <EmojiListView
          v-else
          :key="emojiScope"
          :scope="emojiScope"
          @update:scope="setEmojiScope"
        />
      </main>
    </div>
  </div>
</template>

<style>
.sl-csa {
  --csa-bg: #f4f5f7;
  --csa-panel: #ffffff;
  --csa-hover: #f0f1f3;
  --csa-border: #e6e7eb;
  --csa-border-strong: #d0d2d8;
  --csa-fg: #111827;
  --csa-fg-2: #4b5563;
  --csa-fg-3: #9ca3af;
  --csa-primary: #2563eb;
  --csa-primary-hover: #1d4ed8;
  --csa-primary-soft: #eff6ff;
  --csa-danger: #dc2626;
  --csa-danger-soft: #fef2f2;
  --csa-success: #059669;
  --csa-success-soft: #ecfdf5;
  --csa-warn: #d97706;
  --csa-warn-soft: #fffbeb;
  --csa-radius: 12px;
  --csa-radius-sm: 8px;
  --csa-ring: 0 0 0 3px rgba(37, 99, 235, 0.16);
  --csa-shadow-sm: 0 1px 2px rgba(17, 24, 39, 0.04);
  --csa-shadow-md: 0 4px 18px -8px rgba(17, 24, 39, 0.12);
  --csa-shadow-lg: 0 24px 48px -16px rgba(17, 24, 39, 0.22);
  --csa-mono: ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace;
  box-sizing: border-box;
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px 22px 36px;
  font-family: var(--sl-font-family, system-ui, -apple-system, "Segoe UI", sans-serif);
  font-size: 13px;
  line-height: 1.55;
  color: var(--csa-fg);
  background:
    radial-gradient(720px 360px at 100% 0%, rgba(37, 99, 235, 0.07), transparent 55%),
    radial-gradient(640px 280px at 0% 8%, rgba(5, 150, 105, 0.04), transparent 50%),
    linear-gradient(180deg, #f8f9fb 0%, var(--csa-bg) 42%);
}
.sl-csa *,
.sl-csa *::before,
.sl-csa *::after { box-sizing: border-box; }
.sl-csa h2, .sl-csa h3, .sl-csa p, .sl-csa figure { margin: 0; }
.sl-csa button { font: inherit; cursor: pointer; background: none; border: none; padding: 0; color: inherit; }
.sl-csa input, .sl-csa select, .sl-csa textarea { font: inherit; color: inherit; }
.sl-csa ul, .sl-csa ol { margin: 0; padding: 0; list-style: none; }
.sl-csa ::selection { background: #bfdbfe; color: #1e3a8a; }

.sl-csa .csa-shell {
  max-width: clamp(720px, 94vw, 1120px);
  margin-inline: auto;
}

.sl-csa .csa-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px 18px;
  flex-wrap: wrap;
  padding: 16px 18px;
  margin-bottom: 14px;
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  border-radius: 14px;
  box-shadow: var(--csa-shadow-sm);
}
.sl-csa .csa-head__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.sl-csa .csa-head__mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 11px;
  background: linear-gradient(145deg, #1e40af, var(--csa-primary));
  color: #fff;
  font-family: var(--csa-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  box-shadow: 0 6px 14px -6px rgba(37, 99, 235, 0.55);
}
.sl-csa .csa-head__title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.sl-csa .csa-head__title h2 {
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.25;
}
.sl-csa .csa-head__desc {
  font-size: 12px;
  color: var(--csa-fg-2);
  line-height: 1.45;
}
.sl-csa .csa-head__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.sl-csa .csa-sub {
  font-family: var(--csa-mono);
  font-size: 11px;
  color: var(--csa-fg-2);
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  box-shadow: var(--csa-shadow-sm);
  white-space: nowrap;
}
.sl-csa .csa-main {
  min-height: 280px;
  animation: csa-slide-in 0.22s ease-out;
}

.sl-csa .csa-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-family: var(--csa-mono);
  background: var(--csa-panel);
  color: var(--csa-fg-2);
  border: 1px solid var(--csa-border);
  white-space: nowrap;
}
.sl-csa .csa-badge::before {
  content: "";
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.8;
  flex: none;
}
.sl-csa .csa-badge--ok { background: var(--csa-success-soft); color: var(--csa-success); border-color: #a7f3d0; }
.sl-csa .csa-badge--warn { background: var(--csa-warn-soft); color: var(--csa-warn); border-color: #fde68a; }
.sl-csa .csa-badge--danger { background: var(--csa-danger-soft); color: var(--csa-danger); border-color: #fecaca; }
.sl-csa .csa-badge--info { background: var(--csa-primary-soft); color: var(--csa-primary); border-color: #bfdbfe; }
.sl-csa .csa-badge--mute {
  background: var(--csa-hover);
  color: var(--csa-fg-3);
  border-color: transparent;
}
.sl-csa .csa-badge--mute::before { display: none; }

.sl-csa .csa-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  max-width: 100%;
  flex-wrap: wrap;
  padding: 4px;
  margin: 0 0 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--csa-border);
  border-radius: 12px;
  box-shadow: var(--csa-shadow-sm);
  backdrop-filter: blur(8px);
}
.sl-csa .csa-tabs__item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 500;
  color: var(--csa-fg-2);
  transition: color 0.15s, background 0.15s, box-shadow 0.15s;
}
.sl-csa .csa-tabs__item:hover:not(.is-disabled):not(.is-active) {
  color: var(--csa-fg);
  background: var(--csa-hover);
}
.sl-csa .csa-tabs__item.is-active {
  background: var(--csa-primary);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 4px 12px -4px rgba(37, 99, 235, 0.55);
}
.sl-csa .csa-tabs__item:focus-visible {
  outline: none;
  box-shadow: var(--csa-ring);
}
.sl-csa .csa-tabs__item.is-disabled {
  color: var(--csa-fg-3);
  cursor: not-allowed;
}
.sl-csa .csa-tabs__lock {
  font-family: var(--csa-mono);
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.22);
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.28);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.sl-csa .csa-tabs__item:not(.is-active) .csa-tabs__lock {
  background: var(--csa-hover);
  color: var(--csa-fg-3);
  border-color: var(--csa-border-strong);
}
.sl-csa .csa-frame {
  max-width: clamp(720px, 92vw, 1400px);
  margin-inline: auto;
}
.sl-csa .csa-help {
  font-size: 12px;
  color: var(--csa-fg-2);
  margin-bottom: 14px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid var(--csa-border);
  border-radius: var(--csa-radius-sm);
  line-height: 1.55;
}
.sl-csa .csa-help code,
.sl-csa .csa-step__desc code {
  font-family: var(--csa-mono);
  font-size: 11px;
  background: var(--csa-hover);
  padding: 1px 5px;
  border-radius: 4px;
}
.sl-csa .csa-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 56px 24px;
  text-align: center;
  color: var(--csa-fg-3);
  background: var(--csa-panel);
  border: 1px dashed var(--csa-border-strong);
  border-radius: var(--csa-radius);
  box-shadow: var(--csa-shadow-sm);
  font-size: 13px;
}
.sl-csa .csa-empty::before {
  content: "";
  width: 44px;
  height: 44px;
  border-radius: 10px;
  margin-bottom: 6px;
  border: 1px solid var(--csa-border);
  box-shadow: var(--csa-shadow-sm);
  background: conic-gradient(var(--csa-hover) 0 25%, #ffffff 0 50%, var(--csa-hover) 0 75%, #ffffff 0) 0 0 / 11px 11px;
}
.sl-csa .csa-empty em {
  font-style: normal;
  color: var(--csa-fg-2);
  font-weight: 500;
}
.sl-csa .csa-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 9px 13px;
  border-radius: var(--csa-radius-sm);
  font-size: 12px;
  font-family: var(--csa-mono);
  border: 1px solid transparent;
  animation: csa-slide-in 0.18s ease-out;
}
.sl-csa .csa-status::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
}
.sl-csa .csa-status--ok {
  background: var(--csa-success-soft);
  color: var(--csa-success);
  border-color: #bbf7d0;
}
.sl-csa .csa-status--err {
  background: var(--csa-danger-soft);
  color: var(--csa-danger);
  border-color: #fecaca;
}
.sl-csa .csa-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--csa-radius-sm);
  border: 1px solid var(--csa-border-strong);
  background: var(--csa-panel);
  color: var(--csa-fg);
  font-size: 13px;
  font-weight: 500;
  box-shadow: var(--csa-shadow-sm);
  transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
}
.sl-csa .csa-btn:hover:not(:disabled) {
  background: var(--csa-hover);
  border-color: var(--csa-fg-3);
}
.sl-csa .csa-btn:active:not(:disabled) {
  box-shadow: none;
  transform: translateY(1px);
}
.sl-csa .csa-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}
.sl-csa .csa-btn:focus-visible {
  outline: none;
  box-shadow: var(--csa-ring);
}
.sl-csa .csa-btn--primary {
  background: var(--csa-primary);
  border-color: var(--csa-primary);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.3);
}
.sl-csa .csa-btn--primary:hover:not(:disabled) {
  background: var(--csa-primary-hover);
  border-color: var(--csa-primary-hover);
}
.sl-csa .csa-btn--primary:focus-visible {
  box-shadow: var(--csa-ring), 0 1px 2px rgba(37, 99, 235, 0.3);
}
.sl-csa .csa-btn--danger {
  background: var(--csa-danger);
  border-color: var(--csa-danger);
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(220, 38, 38, 0.3);
}
.sl-csa .csa-btn--danger:hover:not(:disabled) {
  background: #b91c1c;
  border-color: #b91c1c;
}
.sl-csa .csa-btn--danger:focus-visible {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.18), 0 1px 2px rgba(220, 38, 38, 0.3);
}
.sl-csa .csa-btn--ghost {
  border-color: transparent;
  box-shadow: none;
  color: var(--csa-fg-2);
}
.sl-csa .csa-btn--ghost:hover:not(:disabled) {
  background: var(--csa-hover);
  color: var(--csa-fg);
  border-color: transparent;
}
.sl-csa .csa-btn--sm {
  padding: 4px 10px;
  font-size: 12px;
}
.sl-csa .csa-card {
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  border-radius: var(--csa-radius);
  box-shadow: var(--csa-shadow-sm);
  margin-bottom: 12px;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.sl-csa .csa-card:hover {
  border-color: var(--csa-border-strong);
  box-shadow: var(--csa-shadow-md);
}
.sl-csa .csa-card__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 16px;
}
.sl-csa .csa-card__row.is-clickable { cursor: pointer; }
.sl-csa .csa-card__row.is-clickable:hover { background: #fafafa; }
.sl-csa .csa-card__name {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.005em;
}
.sl-csa .csa-card__id {
  font-family: var(--csa-mono);
  font-size: 11px;
  color: var(--csa-fg-3);
}
.sl-csa .csa-card__ver {
  margin-left: auto;
  font-family: var(--csa-mono);
  font-size: 10px;
  color: var(--csa-fg-2);
  background: var(--csa-hover);
  border: 1px solid var(--csa-border);
  border-radius: 999px;
  padding: 1px 8px;
}
.sl-csa .csa-caret {
  width: 0; height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid var(--csa-fg-3);
  transition: transform 0.18s;
}
.sl-csa .csa-caret.is-open { transform: rotate(180deg); }
.sl-csa .csa-card__action {
  margin-left: 8px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-family: var(--csa-mono);
  color: var(--csa-fg-2);
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.sl-csa .csa-card__action:hover {
  background: var(--csa-hover);
  color: var(--csa-fg);
  border-color: var(--csa-border-strong);
}
.sl-csa .csa-card__action--danger:hover {
  background: var(--csa-danger-soft);
  color: var(--csa-danger);
  border-color: #fecaca;
}
.sl-csa .csa-grid {
  display: grid;
  gap: 10px;
  padding: 2px 16px 16px;
}
@media (max-width: 640px) {
  .sl-csa .csa-grid { gap: 8px; padding: 2px 12px 14px; }
}
.sl-csa .csa-piece {
  text-align: center;
}
.sl-csa .csa-piece__tile {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border: 1px solid var(--csa-border);
  border-radius: var(--csa-radius-sm);
  background: conic-gradient(#ececee 0 25%, #ffffff 0 50%, #ececee 0 75%, #ffffff 0) 0 0 / 12px 12px;
  box-shadow: inset 0 0 0 1px rgba(24, 24, 27, 0.03);
  overflow: hidden;
}
.sl-csa .csa-piece__tile img {
  width: 74%;
  height: 74%;
  object-fit: contain;
  image-rendering: auto;
}
.sl-csa .csa-piece__key {
  display: block;
  margin-top: 5px;
  font-family: var(--csa-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--csa-fg-2);
}
.sl-csa .csa-piece__label {
  display: block;
  font-size: 10px;
  color: var(--csa-fg-3);
}
.sl-csa .csa-piece__fid {
  display: block;
  font-family: var(--csa-mono);
  font-size: 9px;
  color: var(--csa-fg-3);
  word-break: break-all;
  line-height: 1.3;
}
.sl-csa .csa-piece--click .csa-piece__tile {
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.sl-csa .csa-piece--click .csa-piece__tile:hover {
  border-color: var(--csa-primary);
  box-shadow: var(--csa-ring);
  transform: translateY(-1px);
}
.sl-csa .csa-piece--click .csa-piece__hint {
  position: absolute;
  inset: auto 0 0 0;
  padding: 2px 0;
  font-size: 10px;
  background: rgba(37, 99, 235, 0.92);
  color: #fff;
  opacity: 0;
  transition: opacity 0.15s;
}
.sl-csa .csa-piece--click .csa-piece__tile:hover .csa-piece__hint {
  opacity: 1;
  border-radius: 0 0 7px 7px;
}
.sl-csa .csa-up {
  cursor: pointer;
  text-align: center;
  position: relative;
}
.sl-csa .csa-up__tile {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border: 1px dashed var(--csa-border-strong);
  border-radius: var(--csa-radius-sm);
  background: #fafafa;
  font-family: var(--csa-mono);
  font-size: 10px;
  color: var(--csa-fg-3);
  padding: 6px;
  word-break: break-all;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.sl-csa .csa-up:hover .csa-up__tile {
  border-color: var(--csa-primary);
  background: var(--csa-primary-soft);
  color: var(--csa-primary);
}
.sl-csa .csa-up.is-set .csa-up__tile {
  border-style: solid;
  border-color: var(--csa-success);
  background: var(--csa-success-soft);
  color: var(--csa-success);
  font-weight: 600;
}
.sl-csa .csa-up input[type="file"] { display: none; }
.sl-csa .csa-up__key {
  display: block;
  margin-top: 5px;
  font-family: var(--csa-mono);
  font-size: 10px;
  color: var(--csa-fg-2);
}
.sl-csa .csa-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(24, 24, 27, 0.5);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  animation: csa-fade-in 0.16s ease-out;
}
.sl-csa .csa-modal__card {
  width: min(420px, 100%);
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  border-radius: 12px;
  box-shadow: var(--csa-shadow-lg);
  padding: 18px 20px;
  animation: csa-pop-in 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.1);
}
.sl-csa .csa-modal__title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}
.sl-csa .csa-modal__title code {
  font-family: var(--csa-mono);
  font-size: 12px;
  color: var(--csa-fg-2);
}
.sl-csa .csa-modal__desc {
  font-size: 12px;
  color: var(--csa-fg-2);
  margin-bottom: 12px;
}
.sl-csa .csa-modal__desc code {
  font-family: var(--csa-mono);
  font-size: 10px;
  background: var(--csa-hover);
  padding: 1px 4px;
  border-radius: 4px;
  word-break: break-all;
}
.sl-csa .csa-modal__file {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--csa-border-strong);
  border-radius: var(--csa-radius-sm);
  background: var(--csa-panel);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.sl-csa .csa-modal__file:hover { border-color: var(--csa-fg-3); }
.sl-csa .csa-modal__file:focus-visible {
  outline: none;
  border-color: var(--csa-primary);
  box-shadow: var(--csa-ring);
}
.sl-csa .csa-modal__file::file-selector-button {
  font: inherit;
  font-size: 12px;
  margin-right: 10px;
  padding: 4px 10px;
  border: 1px solid var(--csa-border-strong);
  border-radius: 6px;
  background: var(--csa-hover);
  color: var(--csa-fg-2);
  cursor: pointer;
  transition: background 0.12s;
}
.sl-csa .csa-modal__file::file-selector-button:hover { background: var(--csa-border); }
.sl-csa .csa-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.sl-csa .csa-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 12px;
  margin: 12px 0;
}
@media (max-width: 640px) {
  .sl-csa .csa-form { grid-template-columns: 1fr; }
}
.sl-csa .csa-field { display: flex; flex-direction: column; gap: 4px; }
.sl-csa .csa-field__label {
  font-size: 12px;
  font-weight: 500;
  color: var(--csa-fg-2);
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.sl-csa .csa-field__label code {
  font-family: var(--csa-mono);
  font-size: 10px;
  font-weight: 400;
  color: var(--csa-fg-3);
}
.sl-csa .csa-field__input,
.sl-csa .csa-field__select,
.sl-csa .csa-field__area {
  padding: 7px 10px;
  border: 1px solid var(--csa-border-strong);
  border-radius: var(--csa-radius-sm);
  background: var(--csa-panel);
  font-size: 13px;
  box-shadow: var(--csa-shadow-sm);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.sl-csa .csa-field__input:hover,
.sl-csa .csa-field__select:hover,
.sl-csa .csa-field__area:hover { border-color: var(--csa-fg-3); }
.sl-csa .csa-field__input:focus,
.sl-csa .csa-field__select:focus,
.sl-csa .csa-field__area:focus {
  outline: none;
  border-color: var(--csa-primary);
  box-shadow: var(--csa-ring);
}
.sl-csa .csa-field__area { resize: vertical; }
.sl-csa .csa-field--wide { grid-column: 1 / -1; }
.sl-csa .csa-step {
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  border-radius: var(--csa-radius);
  box-shadow: var(--csa-shadow-sm);
  padding: 18px;
  margin-bottom: 12px;
}
.sl-csa .csa-step__title {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}
.sl-csa .csa-step__no {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--csa-primary);
  color: #ffffff;
  font-family: var(--csa-mono);
  font-size: 10.5px;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.35);
  flex: none;
}
.sl-csa .csa-step__desc {
  font-size: 12px;
  color: var(--csa-fg-2);
  margin-bottom: 12px;
}
.sl-csa .csa-json {
  width: 100%;
  min-height: 220px;
  padding: 10px 12px;
  border: 1px solid var(--csa-border-strong);
  border-radius: var(--csa-radius-sm);
  background: #fbfbfc;
  font-family: var(--csa-mono);
  font-size: 11.5px;
  line-height: 1.6;
  resize: vertical;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.sl-csa .csa-json:hover { border-color: var(--csa-fg-3); }
.sl-csa .csa-json:focus {
  outline: none;
  border-color: var(--csa-primary);
  box-shadow: var(--csa-ring);
}
.sl-csa .csa-json::placeholder { color: var(--csa-fg-3); }

/* ── 游戏卡片列表（GameListView）── */
.sl-csa .csa-games {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.sl-csa .csa-game-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  border-radius: 14px;
  box-shadow: var(--csa-shadow-sm);
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s;
}
.sl-csa .csa-game-card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: linear-gradient(180deg, var(--csa-primary), #60a5fa);
  opacity: 0;
  transition: opacity 0.18s;
}
.sl-csa .csa-game-card:hover {
  border-color: #c7d7fe;
  box-shadow: var(--csa-shadow-md);
  transform: translateY(-2px);
}
.sl-csa .csa-game-card:hover::before { opacity: 1; }
.sl-csa .csa-game-card:focus-visible {
  outline: none;
  box-shadow: var(--csa-ring);
}
.sl-csa .csa-game-card__top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sl-csa .csa-game-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  flex: none;
  border-radius: 12px;
  border: 1px solid #dbeafe;
  background:
    linear-gradient(160deg, #eff6ff 0%, #fff 68%),
    var(--csa-panel);
  color: var(--csa-primary);
  font-family: var(--csa-mono);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.sl-csa .csa-game-card__titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.sl-csa .csa-game-card__name {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.015em;
}
.sl-csa .csa-game-card__id {
  font-family: var(--csa-mono);
  font-size: 11px;
  color: var(--csa-fg-3);
}
.sl-csa .csa-game-card__go {
  font-family: var(--csa-mono);
  font-size: 14px;
  color: var(--csa-fg-3);
  transition: color 0.15s, transform 0.15s;
}
.sl-csa .csa-game-card:hover .csa-game-card__go {
  color: var(--csa-primary);
  transform: translateX(2px);
}
.sl-csa .csa-game-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sl-csa .csa-game-card__meta .csa-badge { box-shadow: none; }
.sl-csa .csa-game-card__hint {
  font-size: 11px;
  color: var(--csa-fg-3);
  padding-top: 2px;
  border-top: 1px dashed var(--csa-border);
}

/* ── 详情页头部（GameDetail）── */
.sl-csa .csa-detail-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  padding: 12px 14px;
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  border-radius: 12px;
  box-shadow: var(--csa-shadow-sm);
}
.sl-csa .csa-detail-head__title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.sl-csa .csa-detail-head__title h3 {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
}
.sl-csa .csa-crumb {
  font-family: var(--csa-mono);
  font-size: 11px;
  color: var(--csa-fg-3);
}
.sl-csa .csa-crumb button {
  color: var(--csa-primary);
  font-family: inherit;
  font-size: inherit;
}
.sl-csa .csa-crumb button:hover { text-decoration: underline; }

@keyframes csa-fade-in {
  from { opacity: 0; }
}
@keyframes csa-pop-in {
  from { opacity: 0; transform: translateY(8px) scale(0.97); }
}
@keyframes csa-slide-in {
  from { opacity: 0; transform: translateY(-4px); }
}
@media (max-width: 640px) {
  .sl-csa { padding: 16px 16px 28px; }
  .sl-csa .csa-card__row { padding: 10px 12px; }
  .sl-csa .csa-step { padding: 14px; }
}
@media (prefers-reduced-motion: reduce) {
  .sl-csa *,
  .sl-csa *::before,
  .sl-csa *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
