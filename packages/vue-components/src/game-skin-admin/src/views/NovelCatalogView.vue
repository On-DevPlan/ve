<!-- NovelCatalogView — 「小说」tab：管理公共内置书目录 novel_reader_catalog:index。
     fr 客户端匿名 PublicKvReader 拉取；个人进度走 fr_novel_reader:*（本 tab 不管理）。
     深链：?tab=novel -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { kvV1Service } from '@api/services';
import { jwtAuth } from '@api/http/auth-store';
import {
  isKvKeyMissing,
  resolveGroupRole,
  type GroupRole,
} from '../composables/kvHelpers';
import {
  NOVEL_CATALOG,
  NOVEL_DEFAULT_CATALOG,
  emptyNovelDraft,
  validateNovelEntry,
  type NovelCatalogEntry,
} from '../composables/novelRegistry';

const catalog = ref<NovelCatalogEntry[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const status = ref<{ ok: boolean; text: string } | null>(null);
const myRole = ref<GroupRole | null>(null);
const saving = ref(false);
const editing = ref<NovelCatalogEntry | null>(null);
const isNew = ref(false);

const loginHint = computed(() => (jwtAuth.state.token ? null : '未登录 · 只读'));
const canEdit = computed(() => {
  const r = myRole.value;
  return !!jwtAuth.state.token && (r === 'owner' || r === 'admin' || r === 'writer');
});

function normalizeEntry(raw: unknown): NovelCatalogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  const title = typeof o.title === 'string' ? o.title : '';
  const fileName = typeof o.fileName === 'string' ? o.fileName : '';
  if (!id || !title) return null;
  return {
    id,
    title,
    fileName: fileName || `${id}.txt`,
    source: o.source === 'imported' ? 'imported' : 'builtIn',
    remoteUrl: typeof o.remoteUrl === 'string' ? o.remoteUrl : o.remoteUrl === null ? null : '',
    importedAt: typeof o.importedAt === 'number' ? o.importedAt : null,
    fileId: typeof o.fileId === 'string' ? o.fileId : null,
    updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : null,
  };
}

async function loadCatalog() {
  loading.value = true;
  error.value = null;
  status.value = null;
  try {
    myRole.value = await resolveGroupRole(NOVEL_CATALOG.groupId, [
      NOVEL_CATALOG.kvIndexKey,
      'game-center_catalog:index',
      'chess_skin:index',
    ]);
    try {
      const item = await kvV1Service.get({
        key: NOVEL_CATALOG.kvIndexKey,
        groupId: NOVEL_CATALOG.groupId,
      });
      const parsed = JSON.parse(item.value) as unknown;
      const list = Array.isArray(parsed)
        ? parsed.map(normalizeEntry).filter((e): e is NovelCatalogEntry => !!e)
        : [];
      catalog.value = list;
    } catch (e) {
      if (isKvKeyMissing(e)) {
        catalog.value = [];
      } else {
        throw e;
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    catalog.value = [];
  } finally {
    loading.value = false;
  }
}

async function persist(next: NovelCatalogEntry[]) {
  saving.value = true;
  status.value = null;
  try {
    const stamped = next.map((e) => ({
      ...e,
      source: e.source ?? 'builtIn',
      updatedAt: Date.now(),
    }));
    await kvV1Service.set({
      key: NOVEL_CATALOG.kvIndexKey,
      value: JSON.stringify(stamped),
      groupId: NOVEL_CATALOG.groupId,
      tags: [NOVEL_CATALOG.tagPrefix],
      ttl: 0,
      visibility: 'public',
    });
    catalog.value = stamped;
    status.value = { ok: true, text: `已发布 ${stamped.length} 本内置书（public）` };
    editing.value = null;
    isNew.value = false;
  } catch (e) {
    status.value = { ok: false, text: e instanceof Error ? e.message : String(e) };
  } finally {
    saving.value = false;
  }
}

function openCreate() {
  if (!canEdit.value) return;
  isNew.value = true;
  editing.value = emptyNovelDraft();
  status.value = null;
}

function openEdit(entry: NovelCatalogEntry) {
  if (!canEdit.value) return;
  isNew.value = false;
  editing.value = { ...entry };
  status.value = null;
}

function cancelEdit() {
  editing.value = null;
  isNew.value = false;
}

async function saveEdit() {
  if (!editing.value || !canEdit.value) return;
  const err = validateNovelEntry(editing.value);
  if (err) {
    status.value = { ok: false, text: err };
    return;
  }
  const draft = {
    ...editing.value,
    id: editing.value.id.trim(),
    title: editing.value.title.trim(),
    fileName: editing.value.fileName.trim(),
    remoteUrl: editing.value.remoteUrl?.trim() || null,
  };
  const next = [...catalog.value];
  const idx = next.findIndex((e) => e.id === draft.id);
  if (isNew.value) {
    if (idx >= 0) {
      status.value = { ok: false, text: `id「${draft.id}」已存在` };
      return;
    }
    next.push(draft);
  } else {
    if (idx < 0) {
      status.value = { ok: false, text: '条目不存在' };
      return;
    }
    next[idx] = draft;
  }
  await persist(next);
}

async function removeEntry(id: string) {
  if (!canEdit.value) return;
  if (!window.confirm(`删除内置书「${id}」？客户端将不再展示（本地已下载的文件不受影响）。`)) {
    return;
  }
  await persist(catalog.value.filter((e) => e.id !== id));
}

async function seedDefault() {
  if (!canEdit.value) return;
  if (catalog.value.length > 0) {
    if (!window.confirm('目录非空，用默认 Seven Day 覆盖？')) return;
  }
  await persist(NOVEL_DEFAULT_CATALOG.map((e) => ({ ...e })));
}

onMounted(loadCatalog);
</script>

<template>
  <section>
    <p class="csa-help">
      管理 fr 小说阅读器<strong>公共内置书目录</strong>
      （<code>{{ NOVEL_CATALOG.kvIndexKey }}</code>，tag
      <code>{{ NOVEL_CATALOG.tagPrefix }}</code>，groupId
      {{ NOVEL_CATALOG.groupId }}，<strong>visibility=public</strong>）。
      App 匿名拉取后合并本地书架；用户进度 / 导入书走个人
      <code>fr_novel_reader:*</code>，不在此管理。正文仍由
      <code>remoteUrl</code> 下载到本机。
    </p>

    <div class="csa-detail__status">
      <span
        v-if="loading"
        class="csa-badge csa-badge--info"
      >加载目录…</span>
      <span
        v-else-if="error"
        class="csa-badge csa-badge--danger"
      >{{ error }}</span>
      <span
        v-else-if="loginHint"
        class="csa-badge csa-badge--warn"
      >{{ loginHint }}</span>
      <template v-else>
        <span class="csa-badge">{{ myRole ?? '未登录' }}</span>
        <span class="csa-badge csa-badge--ok">{{ catalog.length }} 本内置书</span>
        <span
          v-if="canEdit"
          class="csa-badge csa-badge--ok"
        >可编辑</span>
        <span
          v-else
          class="csa-badge csa-badge--mute"
        >只读</span>
        <button
          class="csa-btn csa-btn--ghost csa-btn--sm"
          @click="loadCatalog"
        >
          刷新
        </button>
        <button
          v-if="canEdit"
          class="csa-btn csa-btn--sm"
          :disabled="saving"
          @click="seedDefault"
        >
          写入默认 Seven Day
        </button>
        <button
          v-if="canEdit"
          class="csa-btn csa-btn--primary csa-btn--sm"
          :disabled="saving"
          @click="openCreate"
        >
          新增
        </button>
      </template>
    </div>

    <div
      v-if="status"
      :class="['csa-status', status.ok ? 'csa-status--ok' : 'csa-status--err']"
    >
      {{ status.text }}
    </div>

    <div
      v-if="!loading && !error && catalog.length === 0"
      class="csa-empty"
    >
      <span>目录为空或尚未发布</span>
      <span>登录后点「写入默认 Seven Day」或「新增」发布第一本书。</span>
    </div>

    <ul
      v-else-if="catalog.length > 0"
      class="csa-novel-list"
    >
      <li
        v-for="book in catalog"
        :key="book.id"
        class="csa-card"
      >
        <div class="csa-card__row">
          <div>
            <div class="csa-card__name">
              {{ book.title }}
            </div>
            <div class="csa-card__id">
              {{ book.id }} · {{ book.fileName }}
            </div>
            <div
              v-if="book.remoteUrl"
              class="csa-novel-url"
            >
              {{ book.remoteUrl }}
            </div>
          </div>
          <div class="csa-novel-actions">
            <button
              v-if="canEdit"
              class="csa-card__action"
              @click="openEdit(book)"
            >
              编辑
            </button>
            <button
              v-if="canEdit"
              class="csa-card__action csa-card__action--danger"
              @click="removeEntry(book.id)"
            >
              删除
            </button>
          </div>
        </div>
      </li>
    </ul>

    <div
      v-if="editing"
      class="csa-modal"
      @click.self="cancelEdit"
    >
      <div class="csa-modal__card csa-novel-modal">
        <div class="csa-modal__title">
          {{ isNew ? '新增内置书' : '编辑内置书' }}
        </div>
        <div class="csa-form">
          <label class="csa-field">
            <span class="csa-field__label">id <code>builtin_…</code></span>
            <input
              v-model="editing.id"
              class="csa-field__input"
              :disabled="!isNew || saving"
              placeholder="builtin_seven_day"
            >
          </label>
          <label class="csa-field">
            <span class="csa-field__label">title</span>
            <input
              v-model="editing.title"
              class="csa-field__input"
              :disabled="saving"
              placeholder="Seven Day"
            >
          </label>
          <label class="csa-field">
            <span class="csa-field__label">fileName</span>
            <input
              v-model="editing.fileName"
              class="csa-field__input"
              :disabled="saving"
              placeholder="sevenDay.txt"
            >
          </label>
          <label class="csa-field csa-field--wide">
            <span class="csa-field__label">remoteUrl</span>
            <input
              v-model="editing.remoteUrl"
              class="csa-field__input"
              :disabled="saving"
              placeholder="https://…/book.txt"
            >
          </label>
        </div>
        <div class="csa-modal__actions">
          <button
            class="csa-btn csa-btn--ghost"
            :disabled="saving"
            @click="cancelEdit"
          >
            取消
          </button>
          <button
            class="csa-btn csa-btn--primary"
            :disabled="saving"
            @click="saveEdit"
          >
            {{ saving ? '发布中…' : '发布到 KV' }}
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
}
.csa-novel-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.csa-novel-url {
  margin-top: 4px;
  font-family: var(--csa-mono);
  font-size: 10px;
  color: var(--csa-fg-3);
  word-break: break-all;
  line-height: 1.4;
  max-width: min(72vw, 640px);
}
.csa-novel-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.csa-novel-modal {
  width: min(520px, 100%);
}
</style>
