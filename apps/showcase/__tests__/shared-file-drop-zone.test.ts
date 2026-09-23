// shared-file-drop-zone.test.ts —— FileDropZone 的 descriptor 与行为测试。
//
// 这组测试同时承担「构建链路」验证职责：import descriptor 会连带触发
//   import FileDropZone from './FileDropZone.vue'   → SFC 编译
//   import css from './style.css?inline'            → Vite CSS 管线
// SFC 编译这条链路在测试里被真实覆盖；而 **CSS 内容本身测不到** ——
// vitest 默认 css:false，`?inline` 在这套环境里会被置成空串。CSS 的最终验证
// 依赖真实构建（接上第一个调用点后，产物里应出现对应的 CSS）。
//
// 另外两个已知测不到的点：
//   - jsdom 不做浏览器「同值不触发 change」的优化，所以 input.value 重置
//     只能验证动作无副作用，无法复现「选同一个文件第二次无反应」的真实场景；
//   - jsdom 里 `input[type=file].value` 不接受非空赋值，无法断言"确实被清空"。

import { describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import FileDropZone, { formatRejectInfo } from '@/shared/components/FileDropZone';

// descriptor 不是组件，测试要挂的是它携带的组件本体。
const FileDropZoneComponent = FileDropZone.Component;

function makeFile(name: string, type = '', content = 'x'): File {
  return new File([content], name, { type });
}

/** 把 File 列表塞进 input.files（jsdom 里该属性只读，需要 defineProperty 覆盖）。 */
async function pickFiles(wrapper: VueWrapper, files: File[]): Promise<void> {
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, 'files', { value: files, configurable: true });
  await input.trigger('change');
}

describe('FileDropZone descriptor', () => {
  it('导出合法的 descriptor', () => {
    expect(FileDropZone.meta).toEqual({ name: 'FileDropZone', host: 'vue' });
    expect(FileDropZone.Component).toBeTruthy();
    expect(typeof FileDropZone.css).toBe('string');
  });

  it('把 descriptor 直接当组件渲染会立刻抛错（防误用哨兵）', () => {
    // 没有哨兵时这里只会静默渲染出一个空组件 + 一条 Vue warn。
    expect(() => mount(FileDropZone as never)).toThrow(/不是组件/);
  });
});

describe('FileDropZone 校验与派发', () => {
  it('accept 命中时回调 onSelect', async () => {
    const onSelect = vi.fn();
    const wrapper = mount(FileDropZoneComponent, { props: { accept: '.toml', onSelect } });
    await pickFiles(wrapper, [makeFile('config.toml')]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toHaveLength(1);
  });

  it('MIME 为空串时回退到扩展名判定（Windows 上 .toml 的常见情形）', async () => {
    const onSelect = vi.fn();
    const onReject = vi.fn();
    const wrapper = mount(FileDropZoneComponent, {
      props: { accept: '.toml', onSelect, onReject },
    });
    await pickFiles(wrapper, [makeFile('config.toml', '')]);
    expect(onReject).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('accept 不命中时 onReject 的 reason 为 type', async () => {
    const onSelect = vi.fn();
    const onReject = vi.fn();
    const wrapper = mount(FileDropZoneComponent, {
      props: { accept: '.toml', onSelect, onReject },
    });
    await pickFiles(wrapper, [makeFile('photo.png', 'image/png')]);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject.mock.calls[0][0].reason).toBe('type');
  });

  it('MIME 通配符也能命中（image/*）', async () => {
    const onSelect = vi.fn();
    const wrapper = mount(FileDropZoneComponent, { props: { accept: 'image/*', onSelect } });
    await pickFiles(wrapper, [makeFile('photo.png', 'image/png')]);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('超过 maxSizeMb 时 onReject 的 reason 为 size', async () => {
    const onReject = vi.fn();
    const wrapper = mount(FileDropZoneComponent, {
      // 0.00005 MB ≈ 52 字节，下面文件 100 字节
      props: { maxSizeMb: 0.00005, onReject },
    });
    await pickFiles(wrapper, [makeFile('big.toml', '', 'x'.repeat(100))]);
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject.mock.calls[0][0].reason).toBe('size');
  });
});

describe('FileDropZone multiple 语义', () => {
  it('multiple=false 时只取第一个', async () => {
    const onSelect = vi.fn();
    const wrapper = mount(FileDropZoneComponent, { props: { multiple: false, onSelect } });
    await pickFiles(wrapper, [makeFile('a.toml'), makeFile('b.toml')]);
    expect(onSelect.mock.calls[0][0]).toHaveLength(1);
  });

  it('multiple=true 时全部通过', async () => {
    const onSelect = vi.fn();
    const wrapper = mount(FileDropZoneComponent, { props: { multiple: true, onSelect } });
    await pickFiles(wrapper, [makeFile('a.toml'), makeFile('b.toml')]);
    expect(onSelect.mock.calls[0][0]).toHaveLength(2);
  });

  it('change 处理完后 input.value 归零', async () => {
    const wrapper = mount(FileDropZoneComponent, { props: { onSelect: vi.fn() } });
    const input = wrapper.find('input[type="file"]');
    await pickFiles(wrapper, [makeFile('a.toml')]);
    expect((input.element as HTMLInputElement).value).toBe('');
  });
});

describe('FileDropZone 拒绝提示文案', () => {
  it('三种原因都有对应文案', () => {
    const cases = [
      ['type', '类型不在允许范围内'],
      ['size', '超过体积上限'],
      ['directory', '不能拖入文件夹'],
    ] as const;
    for (const [reason, text] of cases) {
      expect(formatRejectInfo({ file: makeFile('a.png'), reason })).toBe(
        `已忽略「a.png」：${text}`,
      );
    }
  });
});

describe('FileDropZone bare 形态', () => {
  it('按钮只带 buttonClass，不带内置样式类', () => {
    const wrapper = mount(FileDropZoneComponent, {
      props: { variant: 'bare', buttonClass: 'sl-cs-btn sl-cs-btn--primary', label: '选文件' },
    });
    expect(wrapper.classes()).toContain('sl-file-drop--bare');
    expect(wrapper.find('button').classes()).toEqual(['sl-cs-btn', 'sl-cs-btn--primary']);
    expect(wrapper.find('.sl-file-drop__btn').exists()).toBe(false);
    expect(wrapper.find('button').text()).toBe('选文件');
  });

  it('不传 buttonClass 时回落到内置样式（全仓库统一外观）', () => {
    const wrapper = mount(FileDropZoneComponent, {
      props: { variant: 'bare', label: '选择 .toml 文件' },
    });
    expect(wrapper.classes()).toContain('sl-file-drop--bare');
    expect(wrapper.find('button').classes()).toEqual(['sl-file-drop__btn']);
    expect(wrapper.find('button').text()).toBe('选择 .toml 文件');
    // 不传 hint 就不渲染提示行，回落样式也不会凭空多一行
    expect(wrapper.find('.sl-file-drop__hint').exists()).toBe(false);
  });

  it('不自动生成提示行（要的就是「只有一个按钮」）', () => {
    const wrapper = mount(FileDropZoneComponent, {
      props: { variant: 'bare', buttonClass: 'x', accept: '.toml', maxSizeMb: 1 },
    });
    expect(wrapper.find('.sl-file-drop__hint').exists()).toBe(false);
  });

  it('显式传 hint 时仍渲染提示行', () => {
    const wrapper = mount(FileDropZoneComponent, {
      props: { variant: 'bare', buttonClass: 'x', hint: '只支持 toml' },
    });
    expect(wrapper.find('.sl-file-drop__hint').text()).toBe('只支持 toml');
  });

  it('点击按钮触发选择器，且校验语义与其它形态一致', async () => {
    const onSelect = vi.fn();
    const onReject = vi.fn();
    const wrapper = mount(FileDropZoneComponent, {
      props: { variant: 'bare', buttonClass: 'x', accept: '.toml', onSelect, onReject },
    });
    const inputEl = wrapper.find('input[type="file"]').element as HTMLInputElement;
    const click = vi.spyOn(inputEl, 'click').mockImplementation(() => {});
    await wrapper.find('button').trigger('click');
    expect(click).toHaveBeenCalledTimes(1);

    await pickFiles(wrapper, [makeFile('photo.png', 'image/png')]);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onReject.mock.calls[0][0].reason).toBe('type');
  });

  it('拖拽照常接管（这是相对原生 input 方案的主要增量）', async () => {
    const onSelect = vi.fn();
    const wrapper = mount(FileDropZoneComponent, {
      props: { variant: 'bare', buttonClass: 'x', accept: '.toml', onSelect },
    });
    await wrapper.trigger('drop', {
      dataTransfer: { items: [], files: [makeFile('dropped.toml', '')] },
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('FileDropZone tile 形态', () => {
  /** 把 input.click 打桩，用来断言「有没有真的去开选择器」。 */
  function stubInputClick(wrapper: VueWrapper) {
    const inputEl = wrapper.find('input[type="file"]').element as HTMLInputElement;
    const click = vi.spyOn(inputEl, 'click').mockImplementation(() => {});
    return { inputEl, click };
  }

  it('渲染格内文本而不是按钮', () => {
    const wrapper = mount(FileDropZoneComponent, {
      props: { variant: 'tile', text: 'head.webp' },
    });
    expect(wrapper.classes()).toContain('sl-file-drop--tile');
    expect(wrapper.find('.sl-file-drop__btn').exists()).toBe(false);
    expect(wrapper.find('.sl-file-drop__tile-text').text()).toBe('head.webp');
  });

  it('imageUrl 非空时渲染预览图，为空时完全不渲染（避免 src="" 的破图）', () => {
    const withImg = mount(FileDropZoneComponent, {
      props: { variant: 'tile', imageUrl: 'blob:cover' },
    });
    expect(withImg.find('.sl-file-drop__tile-img').attributes('src')).toBe('blob:cover');

    const noImg = mount(FileDropZoneComponent, {
      props: { variant: 'tile', accept: 'image/*' },
    });
    expect(noImg.find('.sl-file-drop__tile-img').exists()).toBe(false);
  });

  it('tile 形态不自动生成 hint（格内空间有限）', () => {
    const wrapper = mount(FileDropZoneComponent, {
      props: { variant: 'tile', accept: 'image/*', maxSizeMb: 2 },
    });
    expect(wrapper.find('.sl-file-drop__tile-hint').exists()).toBe(false);
  });

  it('显式传 hint 时渲染底部覆盖条', () => {
    const wrapper = mount(FileDropZoneComponent, {
      props: { variant: 'tile', hint: '点击选择文件替换' },
    });
    expect(wrapper.find('.sl-file-drop__tile-hint').text()).toBe('点击选择文件替换');
  });

  it('点击整格触发选择器', async () => {
    const wrapper = mount(FileDropZoneComponent, { props: { variant: 'tile' } });
    const { click } = stubInputClick(wrapper);
    await wrapper.trigger('click');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('点到隐藏 input 自身时不再转发（否则 input.click() 冒泡回来会无限递归）', async () => {
    const wrapper = mount(FileDropZoneComponent, { props: { variant: 'tile' } });
    const { click } = stubInputClick(wrapper);
    await wrapper.find('input[type="file"]').trigger('click');
    expect(click).not.toHaveBeenCalled();
  });

  it('button 形态整格不响应点击（只认按钮）', async () => {
    const wrapper = mount(FileDropZoneComponent, { props: {} });
    const { click } = stubInputClick(wrapper);
    await wrapper.trigger('click');
    expect(click).not.toHaveBeenCalled();
  });

  it('disabled 时点击整格不触发选择器，且不参与 Tab 焦点', async () => {
    const wrapper = mount(FileDropZoneComponent, {
      props: { variant: 'tile', disabled: true },
    });
    const { click } = stubInputClick(wrapper);
    await wrapper.trigger('click');
    expect(click).not.toHaveBeenCalled();
    expect(wrapper.attributes('tabindex')).toBeUndefined();
    expect(wrapper.attributes('aria-disabled')).toBe('true');
  });

  it('键盘 Enter / Space 触发选择器（tile 的根是 div，可达性要自己补）', async () => {
    const wrapper = mount(FileDropZoneComponent, { props: { variant: 'tile' } });
    const { click } = stubInputClick(wrapper);
    await wrapper.trigger('keydown', { key: 'Enter' });
    await wrapper.trigger('keydown', { key: ' ' });
    expect(wrapper.attributes('tabindex')).toBe('0');
    expect(click).toHaveBeenCalledTimes(2);
  });

  it('tile 形态仍走完整 accept 校验', async () => {
    const onSelect = vi.fn();
    const onReject = vi.fn();
    const wrapper = mount(FileDropZoneComponent, {
      props: { variant: 'tile', accept: 'image/*', onSelect, onReject },
    });
    await pickFiles(wrapper, [makeFile('note.txt', 'text/plain')]);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onReject.mock.calls[0][0].reason).toBe('type');
  });
});

describe('FileDropZone zone 形态', () => {
  /** 把 input.click 打桩，用来断言「有没有真的去开选择器」。 */
  function stubInputClick(wrapper: VueWrapper) {
    const inputEl = wrapper.find('input[type="file"]').element as HTMLInputElement;
    const click = vi.spyOn(inputEl, 'click').mockImplementation(() => {});
    return { inputEl, click };
  }

  it('渲染框内文字而不是按钮（整块即触发区，不再套一层按钮）', () => {
    const wrapper = mount(FileDropZoneComponent, { props: { variant: 'zone' } });
    expect(wrapper.classes()).toContain('sl-file-drop--zone');
    expect(wrapper.find('.sl-file-drop__btn').exists()).toBe(false);
    expect(wrapper.find('.sl-file-drop__zone-title').text()).toBe('点击或拖拽文件到此处');
    // 无障碍名称取主文案，而不是「支持 .toml」这种副文案
    expect(wrapper.attributes('aria-label')).toBe('点击或拖拽文件到此处');
  });

  it('主文案可用 label 覆盖', () => {
    const wrapper = mount(FileDropZoneComponent, {
      props: { variant: 'zone', label: '选个 TOML 吧' },
    });
    expect(wrapper.find('.sl-file-drop__zone-title').text()).toBe('选个 TOML 吧');
  });

  it('副文案由 accept 生成，逗号分隔会拆成多个类型', () => {
    const one = mount(FileDropZoneComponent, { props: { variant: 'zone', accept: '.toml' } });
    expect(one.find('.sl-file-drop__zone-hint').text()).toBe('支持 .toml');

    const two = mount(FileDropZoneComponent, {
      props: { variant: 'zone', accept: '.toml,.txt' },
    });
    expect(two.find('.sl-file-drop__zone-hint').text()).toBe('支持 .toml / .txt');
  });

  it('显式 hint 优先于 accept 生成', () => {
    const wrapper = mount(FileDropZoneComponent, {
      props: { variant: 'zone', accept: '.toml', hint: '单个不超过 1 MB' },
    });
    expect(wrapper.find('.sl-file-drop__zone-hint').text()).toBe('单个不超过 1 MB');
  });

  it('既无 hint 又无 accept 时不渲染副文案', () => {
    const wrapper = mount(FileDropZoneComponent, { props: { variant: 'zone' } });
    expect(wrapper.find('.sl-file-drop__zone-hint').exists()).toBe(false);
  });

  it('点击整块触发选择器', async () => {
    const wrapper = mount(FileDropZoneComponent, { props: { variant: 'zone' } });
    const { click } = stubInputClick(wrapper);
    await wrapper.trigger('click');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('点到隐藏 input 自身时不再转发（否则 input.click() 冒泡回来会无限递归）', async () => {
    const wrapper = mount(FileDropZoneComponent, { props: { variant: 'zone' } });
    const { click } = stubInputClick(wrapper);
    await wrapper.find('input[type="file"]').trigger('click');
    expect(click).not.toHaveBeenCalled();
  });

  it('键盘 Enter / Space 触发选择器；disabled 时不可点也不参与 Tab', async () => {
    const wrapper = mount(FileDropZoneComponent, { props: { variant: 'zone' } });
    const { click } = stubInputClick(wrapper);
    expect(wrapper.attributes('role')).toBe('button');
    expect(wrapper.attributes('tabindex')).toBe('0');
    await wrapper.trigger('keydown', { key: 'Enter' });
    await wrapper.trigger('keydown', { key: ' ' });
    expect(click).toHaveBeenCalledTimes(2);

    const disabled = mount(FileDropZoneComponent, {
      props: { variant: 'zone', disabled: true },
    });
    const stub = stubInputClick(disabled);
    await disabled.trigger('click');
    expect(stub.click).not.toHaveBeenCalled();
    expect(disabled.attributes('tabindex')).toBeUndefined();
    expect(disabled.attributes('aria-disabled')).toBe('true');
  });

  it('仍走完整 accept 校验与拖拽接管（形态只换外观，不换语义）', async () => {
    const onSelect = vi.fn();
    const onReject = vi.fn();
    const wrapper = mount(FileDropZoneComponent, {
      props: { variant: 'zone', accept: '.toml', onSelect, onReject },
    });
    await pickFiles(wrapper, [makeFile('photo.png', 'image/png')]);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onReject.mock.calls[0][0].reason).toBe('type');

    await wrapper.trigger('drop', {
      dataTransfer: { items: [], files: [makeFile('dropped.toml', '')] },
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('FileDropZone 拖拽', () => {
  it('拖入目录时 onReject 的 reason 为 directory', async () => {
    const onSelect = vi.fn();
    const onReject = vi.fn();
    const wrapper = mount(FileDropZoneComponent, { props: { onSelect, onReject } });

    const dirFile = makeFile('some-folder');
    const item = {
      kind: 'file',
      webkitGetAsEntry: () => ({ isDirectory: true, name: 'some-folder' }),
      getAsFile: () => dirFile,
    };
    await wrapper.find('.sl-file-drop').trigger('drop', {
      dataTransfer: { items: [item], files: [] },
    });

    expect(onSelect).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onReject.mock.calls[0][0].reason).toBe('directory');
  });

  it('拖入普通文件走 dt.files 兜底分支（items 为空）', async () => {
    const onSelect = vi.fn();
    const wrapper = mount(FileDropZoneComponent, { props: { accept: '.toml', onSelect } });
    await wrapper.find('.sl-file-drop').trigger('drop', {
      dataTransfer: { items: [], files: [makeFile('dropped.toml', '')] },
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('disabled 时不响应拖拽', async () => {
    const onSelect = vi.fn();
    const wrapper = mount(FileDropZoneComponent, { props: { disabled: true, onSelect } });
    await wrapper.find('.sl-file-drop').trigger('drop', {
      dataTransfer: { items: [], files: [makeFile('a.toml')] },
    });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
