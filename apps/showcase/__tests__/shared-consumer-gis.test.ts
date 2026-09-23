// shared-consumer-gis.test.ts —— gis 两个消费点的装配回归。
//
// 与 shared-consumer-game-skin-admin.test.ts 同一目的：单测覆盖 FileDropZone 本体、
// 构建覆盖打包，但都不覆盖「Vue 业务组件 → SharedMount → descriptor → 组件本体」
// 这条装配链路。gis 这次还额外引入了两处**形态变化**，必须锁住：
//   1) ControlPanel「导入文件」由原生 <button> + 隐藏 input 换成 FileDropZone
//      的 bare 形态 —— 按钮还在，但它是共享组件内部渲染的；
//   2) PointEditor「添加图片」由 <label> 包 input 换成 bare 形态的 <button> ——
//      元素类型变了，样式也从 scoped 挪到了非 scoped 块（scoped 的 [data-v-*]
//      加不到子组件内部元素上）。
//
// 测不到的点：vitest 默认 css:false，`?inline` 在这里是空串，所以断言不了
// <style>。样式落点由真实构建验证。

import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import ControlPanel from '../../../packages/vue-components/src/gis/ControlPanel.vue';
import PointEditor from '../../../packages/vue-components/src/gis/PointEditor.vue';

function makeFile(name: string, type = '', content = 'x'): File {
  return new File([content], name, { type });
}

/** 把 File 列表塞进 input.files（jsdom 里该属性只读，需要 defineProperty 覆盖）。 */
async function pickFiles(wrapper: VueWrapper, files: File[]): Promise<void> {
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, 'files', { value: files, configurable: true });
  await input.trigger('change');
}

async function dropFiles(wrapper: VueWrapper, files: File[]): Promise<void> {
  await wrapper.find('.sl-file-drop').trigger('drop', {
    dataTransfer: { items: [], files },
  });
}

/** 一份能通过 validateJsonData 的最小合法数据。 */
function validPayload(): string {
  return JSON.stringify({
    version: '2.0.0',
    format: 'gis-travel-diary',
    data: { points: [{ id: 'p1', lon: 116.4, lat: 39.9, title: '天安门' }], routes: [] },
  });
}

/** FileReader 是异步的：等 promise 链走完（readAsText / readAsDataURL 各一轮）。 */
async function settle(): Promise<void> {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushPromises();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ControlPanel 消费共享 FileDropZone', () => {
  function mountPanel(): VueWrapper {
    return mount(ControlPanel);
  }

  it('「导入文件」渲染成共享组件的 bare 按钮，不再是原生 input 触发', () => {
    const wrapper = mountPanel();

    // bare 形态：外观由消费方的 buttonClass 提供
    expect(wrapper.find('.sl-file-drop--bare').exists()).toBe(true);
    const btn = wrapper.find('.sl-file-drop--bare button');
    expect(btn.classes()).toContain('data-btn');
    expect(btn.classes()).toContain('import-btn');
    expect(btn.text()).toBe('导入文件');

    // 导出 / 加载预设仍是原生按钮，导入那处已经不在 .data-buttons 的直接子级里
    expect(wrapper.findAll('.data-buttons > button')).toHaveLength(2);
  });

  it('选中合法 .json 后照旧派发 importData', async () => {
    const wrapper = mountPanel();
    await pickFiles(wrapper, [makeFile('diary.json', 'application/json', validPayload())]);
    await settle();

    const emitted = wrapper.emitted('importData');
    expect(emitted).toBeTruthy();
    const payload = emitted![0][0] as { points: unknown[] };
    expect(payload.points).toHaveLength(1);
  });

  it('拖拽填入与点击选择走同一条回调（这是本次改造新增的能力）', async () => {
    const wrapper = mountPanel();
    await dropFiles(wrapper, [makeFile('diary.json', '', validPayload())]);
    await settle();

    expect(wrapper.emitted('importData')).toBeTruthy();
  });

  it('拒绝非 .json 时给出原因，且不派发 importData', async () => {
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);

    const wrapper = mountPanel();
    await dropFiles(wrapper, [makeFile('note.txt', 'text/plain')]);
    await settle();

    expect(wrapper.emitted('importData')).toBeFalsy();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(String(alertSpy.mock.calls[0][0])).toContain('已忽略');
    expect(String(alertSpy.mock.calls[0][0])).toContain('note.txt');
  });
});

describe('PointEditor 消费共享 FileDropZone', () => {
  function mountEditor(): VueWrapper {
    return mount(PointEditor, { props: { show: true, point: null } });
  }

  it('「添加图片」渲染成 bare 按钮，且不再直接挂着原生 file input', () => {
    const wrapper = mountEditor();

    const btn = wrapper.find('.image-upload button.upload-btn');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toBe('添加图片');
    // 改造前是 <label class="upload-btn"><input type="file"></label>
    expect(wrapper.find('.image-upload > label.upload-btn').exists()).toBe(false);
    expect(wrapper.find('.image-upload > input').exists()).toBe(false);
  });

  it('一次选多张图会全部读入（原实现只取 files[0]，与 multiple 声明相悖）', async () => {
    const wrapper = mountEditor();
    await pickFiles(wrapper, [
      makeFile('a.png', 'image/png'),
      makeFile('b.png', 'image/png'),
    ]);
    await settle();

    const thumbs = wrapper.findAll('.image-item img');
    expect(thumbs).toHaveLength(2);
    for (const thumb of thumbs) {
      expect((thumb.element as HTMLImageElement).src.startsWith('data:')).toBe(true);
    }
  });

  it('拖拽填入图片同样会被读入', async () => {
    const wrapper = mountEditor();
    await dropFiles(wrapper, [makeFile('c.png', 'image/png')]);
    await settle();

    expect(wrapper.findAll('.image-item img')).toHaveLength(1);
  });
});
