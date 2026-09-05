<!-- CoversListView — 「游戏封面」tab 的列表页。
     游戏列表来自 fr 发布的 KV 目录（game-center_catalog:index），
     封面资产管理走 game-center_skin:index（small 卡片小图 / large 轮播大图）。
     目录缺失（未发布）时给出发布命令提示；封面缺图的行给 warn 徽标。
     深链：?tab=covers 直达本页。 -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { kvV1Service } from '@api/services';
import { useSkinAdmin, type UseSkinAdmin } from '../composables/useSkinAdmin';

interface CatalogEntry {
  slug: string;
  title: string;
  description?: string;
  mode?: string;
  categories?: string[];
  isOnline?: boolean;
}

const COVER_ASSET_KEYS = ['small', 'large'] as const;

const admin: UseSkinAdmin = useSkinAdmin('game-center');
const catalog = ref<CatalogEntry[] | null>(null);
const catalogError = ref<string | null>(null);

const manager = ref<string | null>(null); // 正在管理封面的 slug
const uploading = ref<string | null>(null); // 正在上传的 assetKey
const status = ref<{ ok: boolean; text: string } | null>(null);

const skinsById = computed(() => new Map(admin.index.value.map((m) => [m.id, m])));

function coverOf(slug: string, key: string): string {
  const m = skinsById.value.get(slug);
  return admin.previewFileUrl(m?.pieces?.[key]?.fileId ?? '');
}

function hasCover(slug: string, key: string): boolean {
  const m = skinsById.value.get(slug);
  return typeof m?.pieces?.[key]?.fileId === 'string' && (m?.pieces?.[key]?.fileId?.length ?? 0) > 0;
}

function categoryLabel(cat: string): string | null {
  switch (cat) {
    case 'multiplayer':
      return '联机';
    case 'board':
      return '棋游';
    case 'arcade':
      return '街机';
    case 'puzzle':
      return '益智';
    case 'party':
      return '派对';
    case 'music':
      return '音游';
    default:
      return null;
  }
}

async function loadCatalog() {
  catalogError.value = null;
  try {
    const item = await kvV1Service.get({
      key: 'game-center_catalog:index',
      groupId: admin.entry.groupId,
    });
    const parsed = JSON.parse(item.value) as unknown;
    catalog.value = Array.isArray(parsed) ? (parsed as CatalogEntry[]) : [];
  } catch (e) {
    catalogError.value = e instanceof Error ? e.message : String(e);
    catalog.value = null;
  }
}

onMounted(() => {
  if (admin.loginHint.value === null) admin.loadIndex();
  loadCatalog();
});

function openManager(slug: string) {
  if (!admin.canEdit.value) return;
  manager.value = slug;
  status.value = null;
}

async function onPick(slug: string, key: string, e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  uploading.value = key;
  status.value = null;
  try {
    const title = catalog.value?.find((c) => c.slug === slug)?.title;
    await admin.ensureSkin(slug, title);
    const r = await admin.replacePiece(slug, key, file, file.name);
    const extra =
      r.orphanedFailed.length > 0
        ? `（旧文件清理失败 ${r.orphanedFailed.length} 个）`
        : r.orphanedCleaned.length > 0
          ? `（旧文件 ${r.orphanedCleaned.length} 个已清理）`
          : '';
    status.value = { ok: true, text: `${slug} / ${key} 已替换并发布${extra}` };
  } catch (err) {
    status.value = { ok: false, text: err instanceof Error ? err.message : String(err) };
  } finally {
    uploading.value = null;
  }
}
</script>

<template>
  <section>
    <p class="csa-help">
      游戏封面按 fr 发布的 KV 目录（<code>game-center_catalog:index</code>）列出全部游戏；
      封面资产写在 <code>game-center_skin:index</code>（每款 <code>small</code> / <code>large</code>，<strong>visibility=public</strong>）。
      封面索引尚未创建时会显示 0 条记录，上传第一张图时自动建 key。
      fr 走匿名 public 读；若索引误落 private，ve 能预览但 App 看不见。
    </p>

    <!-- 状态徽标 -->
    <div class="csa-detail__status">
      <span
        v-if="catalog === null && !catalogError"
        class="csa-badge csa-badge--info"
      >加载目录…</span>
      <span
        v-else-if="admin.loading.value"
        class="csa-badge csa-badge--info"
      >加载封面索引…</span>
      <span
        v-else-if="catalogError"
        class="csa-badge csa-badge--danger"
      >{{ catalogError }}</span>
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
        <span class="csa-badge csa-badge--ok">{{ catalog?.length ?? 0 }} 款游戏（目录）</span>
        <span class="csa-badge csa-badge--mute">{{ admin.index.value.length }} 条封面记录</span>
        <span
          v-if="admin.canEdit.value"
          class="csa-badge csa-badge--ok"
        >可编辑</span>
        <span
          v-else
          class="csa-badge csa-badge--mute"
        >只读</span>
        <button
          class="csa-btn csa-btn--ghost csa-btn--sm"
          @click="() => { loadCatalog(); admin.loadIndex(); }"
        >
          刷新
        </button>
      </template>
    </div>

    <!-- 目录未发布 / 读失败 / 列表 -->
    <div
      v-if="catalog === null && catalogError"
      class="csa-empty"
    >
      <span>目录读取失败</span>
      <span>{{ catalogError }}</span>
      <button
        class="csa-btn"
        @click="loadCatalog"
      >
        重试
      </button>
    </div>
    <div
      v-else-if="catalog === null"
      class="csa-empty"
    >
      <span>正在读取游戏目录…</span>
    </div>
    <div
      v-else-if="catalog.length === 0"
      class="csa-empty"
    >
      <span>KV 目录为空或未发布</span>
      <span>先运行 <code>dart run tool/publish_game_center_index.dart</code>（fr 仓库，需已登录 kvcli），发布后点刷新。</span>
      <button
        class="csa-btn csa-btn--primary"
        @click="loadCatalog"
      >
        刷新目录
      </button>
    </div>
    <ul
      v-else
      class="csa-cover-list"
    >
      <li
        v-for="g in catalog"
        :key="g.slug"
        class="csa-card"
      >
        <div
          class="csa-card__row is-clickable"
          @click="openManager(g.slug)"
        >
          <div class="csa-cover-thumb">
            <img
              v-if="hasCover(g.slug, 'small')"
              :src="coverOf(g.slug, 'small')"
              :alt="g.slug"
              loading="lazy"
            >
            <span
              v-else
              class="csa-cover-thumb__empty"
            >无封面</span>
          </div>
          <div class="csa-cover-info">
            <span class="csa-card__name">{{ g.title }}</span>
            <span class="csa-card__id">{{ g.slug }}</span>
            <p
              v-if="g.description"
              class="csa-cover-desc"
            >
              {{ g.description }}
            </p>
            <div class="csa-cover-badges">
              <span
                v-if="g.mode"
                class="csa-badge csa-badge--mute"
              >{{ g.mode }}</span>
              <span
                v-for="c in g.categories ?? []"
                :key="c"
                :class="['csa-badge', c === 'multiplayer' ? 'csa-badge--info' : 'csa-badge--mute']"
              >{{ categoryLabel(c) ?? c }}</span>
              <span
                v-if="hasCover(g.slug, 'small') && hasCover(g.slug, 'large')"
                class="csa-badge csa-badge--ok"
              >封面齐</span>
              <span
                v-else
                class="csa-badge csa-badge--warn"
              >缺封面</span>
            </div>
          </div>
          <button
            class="csa-btn csa-btn--sm"
            :disabled="!admin.canEdit.value"
            :title="admin.canEdit.value ? '上传 / 替换封面' : '仅 owner/admin 可编辑'"
            @click.stop="openManager(g.slug)"
          >
            管理封面
          </button>
        </div>
      </li>
    </ul>

    <p
      v-if="status"
      :class="['csa-status', status.ok ? 'csa-status--ok' : 'csa-status--err']"
    >
      {{ status.text }}
    </p>
    <!-- 单游戏封面管理模态 -->
    <div
      v-if="manager"
      class="csa-modal"
    >
      <div class="csa-modal__card csa-cover-modal">
        <h3 class="csa-modal__title">
          封面管理 <code>{{ manager }}</code>
        </h3>
        <p class="csa-modal__desc">
          点击图片选择新图（webp / png）。上传自动带三级 tag：<code>game-center-skin / :{{ manager }} / :&lt;asset&gt;</code>，KV index 版本 +1。
        </p>
        <div
          class="csa-grid"
          :style="{ gridTemplateColumns: `repeat(2, 1fr)` }"
        >
          <figure
            v-for="k in COVER_ASSET_KEYS"
            :key="k"
            class="csa-piece csa-piece--click"
          >
            <label class="csa-piece__tile">
              <img
                :src="coverOf(manager, k)"
                :alt="k"
                loading="lazy"
              >
              <span class="csa-piece__hint">{{ uploading === k ? '上传中…' : '点击选择文件替换' }}</span>
              <input
                class="csa-cover-file"
                type="file"
                accept="image/*"
                :disabled="uploading !== null"
                @change="onPick(manager, k, $event)"
              >
            </label>
            <figcaption>
              <span class="csa-piece__key">{{ k }}</span>
              <span class="csa-piece__label">{{ admin.entry.labels[k] }}</span>
            </figcaption>
          </figure>
        </div>
        <div class="csa-modal__actions">
          <button
            class="csa-btn"
            :disabled="uploading !== null"
            @click="manager = null"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.csa-detail__status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 10px 12px;
  background: var(--csa-panel);
  border: 1px solid var(--csa-border);
  border-radius: 10px;
  box-shadow: var(--csa-shadow-sm);
}
.csa-cover-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.csa-cover-list .csa-card {
  margin-bottom: 0;
  border-radius: 12px;
}
.csa-cover-list .csa-card__row {
  gap: 14px;
  padding: 12px 14px;
}
.csa-cover-thumb {
  width: 96px;
  height: 72px;
  flex: none;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--csa-border);
  background: conic-gradient(var(--csa-hover) 0 25%, #ffffff 0 50%, var(--csa-hover) 0 75%, #ffffff 0) 0 0 / 12px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px rgba(17, 24, 39, 0.03);
}
.csa-cover-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.csa-cover-thumb__empty {
  font-family: var(--csa-mono);
  font-size: 10px;
  color: var(--csa-fg-3);
}
.csa-cover-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.csa-cover-desc {
  font-size: 12px;
  color: var(--csa-fg-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.csa-cover-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.csa-cover-badges .csa-badge { box-shadow: none; }
.csa-cover-file { display: none; }
.csa-cover-modal {
  width: min(480px, 100%);
}
@media (max-width: 640px) {
  .csa-cover-thumb { width: 72px; height: 54px; }
  .csa-cover-list .csa-card__row { flex-wrap: wrap; }
}
</style>
