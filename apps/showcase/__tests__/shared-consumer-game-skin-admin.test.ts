// shared-consumer-game-skin-admin.test.ts —— 共享组件「真实消费点」的装配回归。
//
// 为什么单开一组：单测覆盖 FileDropZone 本体、构建覆盖打包，但两者都不覆盖
// 「Vue 业务组件 → SharedMount → descriptor → 组件本体」这条装配链路：
//   - descriptor 是否会被误当组件渲染（哨兵会不会误报）；
//   - props 回调（onSelect / onReject）能否真的透传回业务组件；
//   - 业务侧基于 hint 的展示逻辑（已选文件名 / 拒绝原因）是否成立；
//   - 拖拽填入这条新增能力在业务组件里是否真的通。
//
// 测不到的点：vitest 默认 css:false，`?inline` 在这里是空串 → lightEnv 的注入
// 会被 `if (!css) continue` 跳过，所以断言不了 <style>。样式落点由真实构建验证
// （产物 vc-game-skin-admin-*.js 内含 .sl-file-drop 的 CSS 文本）。
//
// 弹窗里的选图点是 zone 形态（虚线拖放区）后，断言点从 `.sl-file-drop__btn` /
// `.sl-file-drop__hint` 换到了根的 `--zone` 与 `.sl-file-drop__zone-hint` ——
// zone 框内没有按钮，禁用落在根节点的 aria-disabled 与隐藏 input 上。

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount, type VueWrapper } from '@vue/test-utils';
import EmojiUploadModal from '../../../packages/vue-components/src/game-skin-admin/src/views/EmojiUploadModal.vue';

/** 仓库根。__dirname = apps/showcase/__tests__（要上三级才是仓根）。 */
const ROOT = resolve(__dirname, '..', '..', '..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function makeFile(name: string, type = ''): File {
  return new File(['x'], name, { type });
}

/** 把 File 列表塞进 input.files（jsdom 里该属性只读，需要 defineProperty 覆盖）。 */
async function pickFiles(wrapper: VueWrapper, files: File[]): Promise<void> {
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, 'files', { value: files, configurable: true });
  await input.trigger('change');
}

function mountModal(busy = false): VueWrapper {
  return mount(EmojiUploadModal, {
    props: { open: true, busy, tagPrefix: 'emoji/common' },
  });
}

/** 表单里的两个 text input：emojiId 在前，displayName 在后。 */
function emojiIdValue(wrapper: VueWrapper): string {
  return (wrapper.findAll('input[type="text"]')[0].element as HTMLInputElement).value;
}

describe('EmojiUploadModal 消费共享 FileDropZone', () => {
  it('渲染的是共享组件的 zone 形态，而不是原生 file input / 自备按钮', () => {
    const wrapper = mountModal();
    expect(wrapper.find('.sl-file-drop').exists()).toBe(true);
    // 虚线拖放区：整块即触发区，框内只有文字
    expect(wrapper.find('.sl-file-drop--zone').exists()).toBe(true);
    expect(wrapper.find('.sl-file-drop__zone-title').text()).toBe('点击或拖拽文件到此处');
    expect(wrapper.find('.sl-file-drop__btn').exists()).toBe(false);
    // 重构前这里是 <input class="csa-modal__file" type="file">，改完后不该再出现。
    expect(wrapper.find('.csa-modal__file').exists()).toBe(false);
  });

  it('选中合法图片后仍从文件名推导 emojiId（原有便利行为不回归）', async () => {
    const wrapper = mountModal();
    await pickFiles(wrapper, [makeFile('Thumbs Up.webp', 'image/webp')]);
    expect(emojiIdValue(wrapper)).toBe('thumbs-up');
    expect(wrapper.find('.sl-file-drop__zone-hint').text()).toContain('已选择：Thumbs Up.webp');
  });

  it('拒绝不支持的类型时提示行给出原因，且不污染 emojiId', async () => {
    const wrapper = mountModal();
    await pickFiles(wrapper, [makeFile('note.txt', 'text/plain')]);
    const hint = wrapper.find('.sl-file-drop__zone-hint').text();
    expect(hint).toContain('已忽略');
    expect(hint).toContain('类型不在允许范围内');
    expect(emojiIdValue(wrapper)).toBe('');
  });

  it('拖拽填入与点击选择走同一条回调', async () => {
    const wrapper = mountModal();
    await wrapper.find('.sl-file-drop').trigger('drop', {
      dataTransfer: { items: [], files: [makeFile('crown.png', 'image/png')] },
    });
    expect(emojiIdValue(wrapper)).toBe('crown');
    expect(wrapper.find('.sl-file-drop__zone-hint').text()).toContain('已选择：crown.png');
  });

  it('busy 时整块不可交互（zone 没有按钮，禁用落在根与 input 上）', () => {
    const busy = mountModal(true);
    expect(busy.find('.sl-file-drop--zone').attributes('aria-disabled')).toBe('true');
    expect(busy.find('.sl-file-drop--zone').attributes('tabindex')).toBeUndefined();
    expect(busy.find('input[type="file"]').attributes('disabled')).toBeDefined();

    const idle = mountModal(false);
    expect(idle.find('.sl-file-drop--zone').attributes('aria-disabled')).toBeUndefined();
    // 根是 div，键盘可达性靠共享层自己补的 tabindex
    expect(idle.find('.sl-file-drop--zone').attributes('tabindex')).toBe('0');
  });

  it('重新打开弹窗时清空已选文件、emojiId 与提示', async () => {
    const wrapper = mountModal();
    await pickFiles(wrapper, [makeFile('crown.webp', 'image/webp')]);
    expect(wrapper.find('.sl-file-drop__zone-hint').text()).toContain('已选择');

    await wrapper.setProps({ open: false });
    await wrapper.setProps({ open: true });

    expect(wrapper.find('.sl-file-drop__zone-hint').text()).toContain('透明底 webp / png / gif');
    expect(emojiIdValue(wrapper)).toBe('');
  });
});

describe('game-skin-admin 四个选文件点的形态分工', () => {
  // 弹窗里「选文件」是主动作 → zone（与三处 TOML 弹窗、user-space 同一份虚线框）。
  it('两个弹窗用 zone', () => {
    for (const rel of [
      'packages/vue-components/src/game-skin-admin/src/views/EmojiUploadModal.vue',
      'packages/vue-components/src/game-skin-admin/src/views/ReplaceTab.vue',
    ]) {
      expect(read(rel), rel).toContain("variant: 'zone'");
    }
  });

  // 网格格子不能换成 zone（zone 是撑满容器的整块区域，格子是 aspect-ratio 1 的方格），
  // 所以它们保持 tile —— 这条锁住「不要有人把它们也改成 zone」。
  it('两个网格仍用 tile', () => {
    for (const rel of [
      'packages/vue-components/src/game-skin-admin/src/views/ImportTab.vue',
      'packages/vue-components/src/game-skin-admin/src/views/CoversListView.vue',
    ]) {
      expect(read(rel), rel).toContain("variant: 'tile'");
      expect(read(rel), rel).not.toContain("variant: 'zone'");
    }
  });

  // `.sl-csa button` (0,1,1) 压过共享的 `.sl-file-drop__btn` (0,1,0)：它会让 button /
  // bare 形态被擦成一行裸文字（本轮之前两个弹窗就是这样，改成 zone 后框内没有 button，
  // 天然躲开）。但它**不能**照 user-space 那样加 `:not([class*="sl-file-drop"])` ——
  // 那会变成 (0,2,1)，反压 `.sl-csa .csa-btn` (0,2,0)，把整个后台的按钮一起擦掉
  // （jsdom 层叠实测：加 carve-out 后 .csa-btn 的 padding 变 0、背景变透明）。
  it('通配 button reset 保持原样：不加 sl-file-drop carve-out（加了会反压 .csa-btn）', () => {
    for (const rel of [
      'packages/vue-components/src/game-skin-admin/index.css',
      'packages/vue-components/src/game-skin-admin/index.vue',
    ]) {
      const resets = read(rel)
        .split(/\r?\n/)
        .filter((l) => l.trim().startsWith('.sl-csa button {'));
      expect(resets, rel).toHaveLength(1);
      expect(resets[0], rel).not.toContain(':not(');
    }
  });
});
