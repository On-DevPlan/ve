// covers-first-upload.test.ts —— 「covers tab 缺封面首次上传」的逻辑链回归。
//
// 场景：目录有游戏、game-center_skin:index key 不存在（首次上传）、角色 owner。
// 打开封面管理弹窗 → 缺封面 tile 无预览图但仍可点（点击 → 隐藏 input 收到
// 程序化 click）→ 选图 → ensureSkin 建条目 → replacePiece 上传 → KV public 持久化。
// 全链路 mock @api/services。布局层塌缩回归（内层 tile 撑满外壳）由
// shared-consumer-game-skin-admin.test.ts 的源码锁 + 真实构建负责。

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const kvGet = vi.hoisted(() => vi.fn());
const kvSet = vi.hoisted(() => vi.fn());
const fileUpload = vi.hoisted(() => vi.fn());
const fileDelete = vi.hoisted(() => vi.fn());

const { ApiError } = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(
      public code: number,
      message: string,
    ) {
      super(message);
    }
  }
  return { ApiError };
});

vi.mock('@api/services', () => ({
  ApiError,
  kvV1Service: { get: kvGet, set: kvSet },
  fileV1Service: { upload: fileUpload, delete: fileDelete },
}));

vi.mock('@api/http/auth-store', () => ({
  jwtAuth: { state: { token: 'test-token' } },
}));

import CoversListView from '../../../packages/vue-components/src/game-skin-admin/src/views/CoversListView.vue';

const CATALOG = [{ slug: 'mygame', title: 'My Game', description: 'd', categories: ['board'] }];

function dispatchKvGet(key: string) {
  if (key === 'game-center_catalog:index') {
    return { value: JSON.stringify(CATALOG), myRole: 'owner' };
  }
  // skin 索引不存在：首次上传场景
  throw new ApiError(50, 'key not found');
}

async function pickFilesOn(input: HTMLInputElement, files: File[]): Promise<void> {
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change'));
}

describe('CoversListView 缺封面首次上传', () => {
  beforeEach(() => {
    kvGet.mockReset();
    kvSet.mockReset();
    fileUpload.mockReset();
    fileDelete.mockReset();
    kvGet.mockImplementation(({ key }: { key: string }) => dispatchKvGet(key));
    kvSet.mockResolvedValue({});
    fileUpload.mockResolvedValue({
      fileId: 'f-123',
      size: 100,
      contentType: 'image/png',
      url: '/files/f-123',
    });
    fileDelete.mockResolvedValue({});
  });

  it('索引缺失时 role 解析 → 弹窗可开 → 选图后 ensureSkin + replacePiece 全链路走通', async () => {
    const wrapper = mount(CoversListView, { attachTo: document.body });
    await flushPromises();

    // role 探测：skin key 缺失 → probe catalog key 带回 owner
    expect(kvGet).toHaveBeenCalledWith({ key: 'game-center_skin:index', groupId: 190 });

    // 列表渲染出 1 款游戏，管理封面按钮可点（canEdit）
    const btn = wrapper.findAll('button').find((b) => b.text() === '管理封面');
    expect(btn, '管理封面按钮应存在').toBeTruthy();
    expect(btn!.attributes('disabled'), 'canEdit 时按钮不应禁用').toBeUndefined();

    // 打开封面管理弹窗
    await btn!.trigger('click');
    await flushPromises();
    expect(wrapper.find('.csa-modal').exists()).toBe(true);

    // 弹窗里有两个 tile（small / large），各带一个 file input
    const inputs = wrapper.findAll('input[type="file"]');
    expect(inputs.length).toBe(2);

    // 缺封面时 tile 无预览图（imageUrl 为空），但仍渲染 hint 与可点击根节点
    expect(wrapper.findAll('.sl-file-drop--tile').length).toBe(2);
    expect(wrapper.find('.sl-file-drop--tile img').exists()).toBe(false);

    // 点击 tile 根 → 隐藏 input 收到程序化 click（真实浏览器的弹选择器路径）
    const clickSpy = vi.fn();
    inputs[0].element.addEventListener('click', clickSpy);
    await wrapper.find('.sl-file-drop--tile').trigger('click');
    expect(clickSpy, '点击 tile 应触发 input.click()').toHaveBeenCalledTimes(1);

    // 模拟在第一个 tile（small）选图
    const file = new File(['img'], 'cover.png', { type: 'image/png' });
    await pickFilesOn(inputs[0].element as HTMLInputElement, [file]);
    await flushPromises();

    // 上传链路：fileV1Service.upload 应被调用
    expect(fileUpload, '选图后应触发 upload').toHaveBeenCalledTimes(1);
    expect(fileUpload.mock.calls[0][0]).toMatchObject({
      groupId: 190,
      tags: [
        'game-center-skin',
        'game-center-skin:mygame',
        'game-center-skin:mygame:small',
      ],
    });

    // ensureSkin + replacePiece 各 persist 一次 KV index
    expect(kvSet.mock.calls.length).toBe(2);
    const lastValue = JSON.parse(kvSet.mock.calls[1][0].value);
    expect(lastValue).toHaveLength(1);
    expect(lastValue[0]).toMatchObject({ id: 'mygame', displayName: 'My Game' });
    expect(lastValue[0].pieces.small).toMatchObject({ fileId: 'f-123', fileName: 'cover.png' });
    expect(kvSet.mock.calls[1][0]).toMatchObject({ visibility: 'public' });

    // 状态条成功
    const status = wrapper.find('.csa-status');
    expect(status.exists()).toBe(true);
    expect(status.text()).toContain('已替换并发布');

    wrapper.unmount();
  });
});
