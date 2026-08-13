<script setup lang="ts">
// ClassicMode.vue —— 杂志式模式(sidebar + CardGrid,加 ★ 收藏按钮)
//
// 完全复刻 HomePC.vue 当前的展示;
// 增量:
//   1) sidebar 多一行 Mode(经典 / Pin),登录后才显示
//   2) CardGrid 加 :show-pin + :is-pinned + @toggle-pin(每张卡 ★ 按钮)
//   3) 引入 useDesktopStore,store.setMode 触发外层 HomePC shell 的 v-if + Transition 切换

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import CardGrid from '../../components/CardGrid.vue';
import SearchBar from '../../components/SearchBar.vue';
import { useRegistry } from '../../composables/useRegistry';
import { useSearch } from '../../composables/useSearch';
import { usePlatform } from '../../composables/usePlatform';
import { useDesktopStore, type DisplayMode } from '../../composables/useDesktopStore';
import { jwtAuth } from '@/api/http/auth-store';
import { useLoginModalState } from '@/shared/useLoginModal';

const router = useRouter();
const registry = useRegistry();
const { group } = useSearch();
const { platform } = usePlatform();
const { open: openLogin } = useLoginModalState();
const store = useDesktopStore();
const jwtState = computed(() => jwtAuth.state);

// nav 折叠:true = sidebar 收回(0 宽),主区占满
const navCollapsed = ref(false);
function toggleNav() {
  navCollapsed.value = !navCollapsed.value;
}

const groups = computed(() => {
  const set = new Set<string>();
  for (const e of registry.entries.value) set.add(e.group);
  return [...set];
});
const groupCounts = computed(() => {
  const m = new Map<string, number>();
  for (const e of registry.entries.value) m.set(e.group, (m.get(e.group) ?? 0) + 1);
  return m;
});
const totalCount = computed(() => registry.entries.value.length);
const filteredCount = computed(() => group.value ? (groupCounts.value.get(group.value) ?? 0) : totalCount.value);

function open(id: string) {
  const entry = registry.get(id);
  if (entry) router.push(entry.route.path);
}
function selectGroup(g: string | undefined) {
  group.value = g;
}
function togglePlatform(p: 'pc' | 'mobile') {
  platform.value = p;
}

/* ---- 模式 toggle(切到 Pin 模式)---- */
function setMode(m: DisplayMode) {
  store.setMode(m);
}

/* ---- ★ 卡片级 pin(转发 CardGrid 的 toggle-pin)---- */
function onTogglePin(id: string) {
  store.togglePin(id);
  flash(store.isPinned(id) ? '已 pin' : '已取消 pin');
}

const hintText = ref('');
let hintTimer: number | undefined;
function flash(msg: string) {
  hintText.value = msg;
  clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => { hintText.value = ''; }, 1400);
}
</script>

<template>
  <div
    class="home-pc classic-mode"
    :class="{ 'is-nav-collapsed': navCollapsed }"
  >
    <aside class="sidebar">
      <div class="brand">
        wb / showcase
        <small>Style Library — 2026</small>
      </div>

      <div class="search">
        <SearchBar />
      </div>

      <div class="nav-group">
        <div class="nav-title">
          Groups
        </div>
        <div
          class="nav-item"
          :class="{ 'is-active': !group }"
          @click="selectGroup(undefined)"
        >
          <span>All</span><span class="count">{{ totalCount }}</span>
        </div>
        <div
          v-for="g in groups"
          :key="g"
          class="nav-item"
          :class="{ 'is-active': group === g }"
          @click="selectGroup(g)"
        >
          <span>{{ g }}</span><span class="count">{{ groupCounts.get(g) ?? 0 }}</span>
        </div>
      </div>

      <div class="nav-group">
        <div class="nav-title">
          Platform
        </div>
        <div
          class="nav-item"
          :class="{ 'is-active': platform === 'pc' }"
          @click="togglePlatform('pc')"
        >
          <span>PC</span>
        </div>
        <div
          class="nav-item"
          :class="{ 'is-active': platform === 'mobile' }"
          @click="togglePlatform('mobile')"
        >
          <span>Mobile</span>
        </div>
      </div>

      <!-- 模式切换(经典 vs Pin,登录后才显示) —— segmented control 风格,区别于筛选 nav-item -->
      <div
        v-if="jwtState.token"
        class="nav-group"
      >
        <div class="nav-title">
          Mode
        </div>
        <div class="mode-segmented">
          <button
            class="mode-segmented__btn"
            :class="{ 'is-active': store.mode.value === 'classic' }"
            @click="setMode('classic')"
          >
            经典
          </button>
          <button
            class="mode-segmented__btn"
            :class="{ 'is-active': store.mode.value === 'pin' }"
            @click="setMode('pin')"
          >
            Pin
            <span
              v-if="store.pinned.value.size"
              class="mode-segmented__badge"
            >{{ store.pinned.value.size }}</span>
          </button>
        </div>
      </div>

      <div class="sidebar__foot">
        v0.1 · main · <span :class="'platform--' + platform">{{ platform }}</span>
      </div>
      <a
        class="sidebar__github"
        href="https://github.com/On-DevPlan/ve"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="项目 GitHub 仓库(在新标签页打开)"
      >GitHub ↗</a>
    </aside>

    <section class="main">
      <header class="page-head">
        <div class="page-head__title">
          <button
            class="nav-toggle"
            type="button"
            :aria-label="navCollapsed ? '展开导航' : '收回导航'"
            :title="navCollapsed ? '展开导航' : '收回导航'"
            @click="toggleNav"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <h1>组件<em>展示</em></h1>
        </div>
        <div class="page-head__meta">
          <!-- 模式切换(顶栏显眼位置,登录后才显示) -->
          <button
            v-if="jwtState.token"
            class="mode-switch"
            :class="{ 'is-pin': store.mode.value === 'pin' }"
            :title="store.mode.value === 'pin' ? '切回经典模式' : '切换到 Pin 模式'"
            @click="setMode(store.mode.value === 'pin' ? 'classic' : 'pin')"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
            </svg>
            {{ store.mode.value === 'pin' ? '经典' : 'Pin' }}
          </button>
          <div class="crumb">
            Home · {{ group ?? 'All' }} · {{ filteredCount }}
            <span :class="'crumb__platform crumb__platform--' + platform">{{ platform }}</span>
          </div>
          <div class="crumb-auth">
            <template v-if="jwtState.token">
              <span
                class="crumb-user"
                :title="jwtState.jwtUser?.email ?? ''"
              >{{ jwtState.jwtUser?.email }}</span>
              <button
                class="crumb-login crumb-login--ghost"
                @click="jwtAuth.logout()"
              >
                退出
              </button>
            </template>
            <button
              v-else
              class="crumb-login"
              @click="openLogin"
            >
              登录
            </button>
          </div>
        </div>
      </header>
      <CardGrid
        :show-pin="true"
        :is-pinned="(id) => store.isPinned(id)"
        @open="open"
        @toggle-pin="onTogglePin"
      />
    </section>

    <div
      class="hint"
      :class="{ 'is-on': !!hintText }"
    >
      {{ hintText }}
    </div>
  </div>
</template>

<style scoped>
/* === 字体分工 ===
     display : Cormorant Garamond → Songti SC(衬线)
     body    : Inter Tight → PingFang SC(无衬线)
     mono    : JetBrains Mono(等宽) */

.home-pc {
  --paper:       rgba(255, 255, 255, 0.65);
  --ink:         #111;
  --ink-soft:    #555;
  --ink-mute:    #999;
  --line:        #e8e8e8;

  display: grid;
  grid-template-columns: 260px 1fr;
  min-height: 100vh;
  background: #ffffff;
  color: var(--ink);
  font-family: "Inter Tight", "PingFang SC", "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  transition: grid-template-columns .3s ease;
}

/* nav 折叠:sidebar 收成 0,主区占满;CardGrid ResizeObserver 自动重算列数 */
.home-pc.is-nav-collapsed {
  grid-template-columns: 0 1fr;
}

/* === 左侧栏 === */
.sidebar {
  position: sticky; top: 0; align-self: start;
  height: 100vh;
  background: var(--paper);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  border-right: 1px solid var(--line);
  padding: 40px 28px;
  display: flex; flex-direction: column; gap: 28px;
  overflow: hidden;
  transition: padding .3s ease, border-width .3s ease;
}
/* 折叠时 sidebar 内容整体隐藏(宽度已由 grid 收为 0,这里保证不溢出) */
.home-pc.is-nav-collapsed .sidebar {
  padding-left: 0; padding-right: 0;
  border-right-width: 0;
}
.brand {
  font-family: "Cormorant Garamond", "Songti SC", serif;
  font-size: 30px; font-weight: 500; letter-spacing: -0.01em;
  border-bottom: 1px solid var(--ink); padding-bottom: 10px;
}
.brand small {
  display: block; font-family: "JetBrains Mono", monospace;
  font-size: 10px; letter-spacing: 0.22em; color: var(--ink-mute); margin-top: 4px;
}
.search { position: relative; padding: 12px 0; border-bottom: 1px solid var(--line); }
.search :deep(.search) {
  width: 100%; padding: 0; border: none; border-radius: 0;
  background: transparent; font-family: inherit; font-size: 14px; outline: none;
}
.search :deep(.search:focus) { outline: none; }

.nav-group { display: flex; flex-direction: column; gap: 4px; }
.nav-title {
  font-family: "JetBrains Mono", monospace; font-size: 10px;
  letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-mute); margin-bottom: 8px;
}
.nav-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 10px; margin: 0 -10px; font-size: 14px; color: var(--ink-soft);
  cursor: pointer; border-radius: 1px;
}
.nav-item:hover { background: rgba(255, 255, 255, 0.6); color: var(--ink); }
.nav-item.is-active { background: var(--ink); color: #fff; }
.nav-item .count {
  font-family: "JetBrains Mono", monospace; font-size: 10px; color: inherit; opacity: 0.55;
}

/* Mode segmented control —— 比普通 nav-item 更显眼的"切换"语义 */
.mode-segmented {
  display: flex;
  border: 1px solid var(--line); border-radius: 2px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.4);
}
.mode-segmented__btn {
  flex: 1;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 10px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
  background: transparent; color: var(--ink-soft); cursor: pointer;
  border: none; border-right: 1px solid var(--line);
  transition: background .15s, color .15s;
}
.mode-segmented__btn:last-child { border-right: none; }
.mode-segmented__btn:hover { color: var(--ink); background: rgba(255, 255, 255, 0.6); }
.mode-segmented__btn.is-active { background: var(--ink); color: #fff; }
.mode-segmented__badge {
  display: inline-block;
  min-width: 18px; padding: 1px 5px;
  font-size: 9px; letter-spacing: 0.04em;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.25);
  color: inherit;
}
.mode-segmented__btn:not(.is-active) .mode-segmented__badge {
  background: var(--line);
  color: var(--ink-soft);
}
.sidebar__foot {
  margin-top: auto; font-family: "JetBrains Mono", monospace;
  font-size: 10px; letter-spacing: 0.2em; color: var(--ink-mute);
}
.sidebar__foot .platform--pc { color: #2563eb; }
.sidebar__foot .platform--mobile { color: #7c3aed; }

.sidebar__github {
  display: inline-block;
  margin-top: 4px;
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--ink-mute);
  text-decoration: none;
}
.sidebar__github:hover {
  text-decoration: underline;
  color: var(--ink);
}

/* 鉴权态 chip:与 sidebar__foot 分两行,样式紧凑 */
.auth-chip {
  display: flex; align-items: center; gap: 6px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px; color: var(--ink-mute);
  padding: 6px 0;
  border-top: 1px dashed var(--line);
}
.auth-chip__dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--ink-mute); display: inline-block;
}
.auth-chip__dot--mute { background: #d4d4d8; }
.auth-chip__dot--err { background: #ef4444; }
.auth-chip--authenticated .auth-chip__dot { background: #22c55e; }
.auth-chip--restoring .auth-chip__dot { background: #f59e0b; animation: pulse 1.4s ease-in-out infinite; }
.auth-chip__avatar {
  width: 18px; height: 18px; border-radius: 50%; object-fit: cover;
  border: 1px solid var(--line);
}
.auth-chip__name { color: var(--ink); }
.auth-chip__btn {
  margin-left: auto;
  background: transparent; border: 1px solid var(--line); border-radius: 2px;
  padding: 2px 8px; font-family: inherit; font-size: 10px; color: var(--ink-soft);
  cursor: pointer;
}
.auth-chip__btn:hover { background: var(--ink); color: #fff; border-color: var(--ink); }
.auth-chip a { color: var(--ink); text-decoration: underline; }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* === 主体 === */
.main { padding: 5px 72px 96px; transition: padding .3s ease; }
/* 折叠后主区变宽,收缩侧留白让卡片网格用满 */
.home-pc.is-nav-collapsed .main { padding-left: 40px; padding-right: 40px; }
.page-head {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 18px; border-bottom: 1px solid var(--line); margin-bottom: 40px;
}
.page-head__title {
  display: flex; align-items: center; gap: 14px;
}
/* 主区汉堡 —— 始终可见,展开/收起 nav */
.nav-toggle {
  flex-shrink: 0;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: none; border: 1px solid var(--line); border-radius: 2px;
  color: var(--ink-soft); cursor: pointer;
  transition: color .15s, border-color .15s, background .15s;
}
.nav-toggle:hover { color: var(--ink); border-color: var(--ink); background: rgba(255,255,255,.5); }
.page-head h1 {
  font-family: "Cormorant Garamond", "Songti SC", serif; font-size: 42px; font-weight: 500;
}
.page-head h1 em { font-style: italic; color: var(--ink-soft); }
.page-head .crumb {
  font-family: "JetBrains Mono", monospace; font-size: 11px; letter-spacing: 0.18em;
  color: var(--ink-mute); text-transform: uppercase; display: flex; align-items: center; gap: 8px;
}
.crumb__platform { font-size: 9px; padding: 2px 6px; border-radius: 2px; letter-spacing: 0.12em; }
.crumb__platform--pc { background: #2563eb; color: #fff; }
.crumb__platform--mobile { background: #7c3aed; color: #fff; }
.page-head__meta { display: flex; align-items: center; gap: 16px; }
.crumb-auth {
  display: flex; align-items: center; gap: 8px;
  font-family: "JetBrains Mono", monospace; font-size: 11px;
}
.crumb-user {
  color: var(--ink-mute); max-width: 160px; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.crumb-login {
  font-family: "JetBrains Mono", monospace; font-size: 11px;
  letter-spacing: 0.12em; text-transform: uppercase;
  padding: 4px 12px; border: 1px solid var(--line); border-radius: 2px;
  background: transparent; color: var(--ink-soft); cursor: pointer;
  transition: border-color .15s, color .15s;
}
.crumb-login:hover { border-color: var(--ink); color: var(--ink); }
.crumb-login--ghost { border-color: transparent; padding-left: 0; padding-right: 0; }

/* 顶栏模式切换按钮 —— 登录后才显示 */
.mode-switch {
  display: flex; align-items: center; gap: 6px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
  padding: 5px 12px;
  border: 1px solid var(--line); border-radius: 2px;
  background: transparent; color: var(--ink-soft); cursor: pointer;
  transition: border-color .15s, color .15s, background .15s;
}
.mode-switch:hover { border-color: var(--ink); color: var(--ink); background: rgba(255,255,255,.5); }
.mode-switch.is-pin { border-color: var(--ink); color: var(--ink); background: var(--paper); }

.main :deep(.card-grid__viewport) { min-height: 0; }
/* 不覆盖列数 —— CardGrid 虚拟滚动用 ResizeObserver 量容器宽,内联注入
   repeat(N, 280px)。这里只加间距,列数交给子组件自适应。 */
.main :deep(.card-grid) {
  padding-top: 24px;
}
.main :deep(.card) {
  background: var(--paper);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid var(--line); border-radius: 0;
  padding: 28px; display: flex; flex-direction: column; gap: 18px;
  height: auto; min-height: 280px; cursor: pointer;
  transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s;
}
.main :deep(.card:hover),
.main :deep(.card:focus) {
  transform: translateY(-2px);
  border-color: var(--ink);
  box-shadow: 0 18px 40px -28px rgba(0, 0, 0, 0.18);
  outline: none;
}
.main :deep(.card__header) {
  display: flex; justify-content: space-between;
  font-family: "JetBrains Mono", monospace; font-size: 10px;
  letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-mute); margin: 0;
}
.main :deep(.card__title) {
  font-family: "Cormorant Garamond", "Songti SC", serif;
  font-size: 24px; font-weight: 500; color: var(--ink); margin: 0;
}
.main :deep(.card__framework) {
  font-family: "JetBrains Mono", monospace; font-size: 10px;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: var(--ink-mute); background: transparent; padding: 0; border-radius: 0;
}
.main :deep(.card__desc) {
  font-size: 13px; color: var(--ink-soft); line-height: 1.55; margin: 0;
  flex: 1; min-height: 0;
  display: block; -webkit-line-clamp: unset; line-clamp: unset;
  -webkit-box-orient: unset; overflow: visible;
}
.main :deep(.card__meta) {
  display: flex; justify-content: space-between; padding-top: 14px;
  border-top: 1px dashed var(--line);
  font-family: "JetBrains Mono", monospace; font-size: 10px;
  letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-mute);
}
.main :deep(.tag) {
  padding: 0; border-radius: 0; background: transparent;
  font-family: "JetBrains Mono", monospace; font-size: 10px;
  letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-mute);
}
/* card__version 已被 card__pin 替换 —— 不再覆盖 */
.main :deep(.card-grid__empty) {
  padding: 32px; color: var(--ink-mute); text-align: center;
  font-family: "Inter Tight", "PingFang SC", sans-serif;
}

/* hint */
.hint {
  position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
  z-index: 60;
  padding: 10px 16px;
  background: var(--ink); color: #fff;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
  border-radius: 2px;
  opacity: 0; pointer-events: none;
  transition: opacity .2s, transform .2s;
}
.hint.is-on { opacity: 1; transform: translateX(-50%) translateY(-4px); }

/* === 响应式 === */
/* 中等宽度(1024 以下):主区左右留白减半,多给卡片网格空间 */
@media (max-width: 1024px) {
  .main { padding-left: 32px; padding-right: 32px; }
}

/* 窄屏(760 以下):nav 默认收回,侧栏以覆盖层出现;主区占满 */
@media (max-width: 760px) {
  .home-pc { grid-template-columns: 1fr; }
  .home-pc.is-nav-collapsed { grid-template-columns: 1fr; }
  .sidebar {
    position: fixed; left: 0; top: 0; bottom: 0; z-index: 40;
    width: 240px;
    transform: translateX(0);
    transition: transform .3s ease;
    padding: 32px 24px;
  }
  .home-pc.is-nav-collapsed .sidebar {
    transform: translateX(-100%);
    padding-left: 24px; padding-right: 24px;
    border-right-width: 1px;
  }
  .main { padding-left: 20px; padding-right: 20px; }
  .home-pc.is-nav-collapsed .main { padding-left: 20px; padding-right: 20px; }
}
</style>