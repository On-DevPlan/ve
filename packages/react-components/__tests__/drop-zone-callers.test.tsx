// @vitest-environment jsdom
// drop-zone-callers.test.tsx —— 「选文件区」各调用点的契约：拖放区外观只有共享层一份。
//
// 为什么单开这一组：zone 的虚线框是共享层的唯一事实源，而「消费方有没有把框画回去」
// 这类退化既不在组件单测里、也不在构建检查里 —— vitest 默认 css:false，`?inline` 拿到
// 的是空串，样式内容断言不到。所以两头都验：
//   1) 真实挂载两个代表性调用点（shortcut-library 的 TOML 弹窗、user-space 的上传
//      弹窗），断言渲染出 .sl-file-drop--zone；
//   2) 读四个调用点源码 + 消费方 CSS，锁定「调用点用 zone」「不再自画 dashed 框」。
//
// 文件原名 toml-import-zone.test.tsx；user-space 的 UploadFileModal 也并入 zone 后
// 改名 —— 覆盖范围已不止 TOML 弹窗。

// Mark the test environment as a React act()-aware runtime.
// @ts-expect-error - React exposes this global to test runners.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ImportModal from '../src/shortcut-library/src/pages/ImportModal';
import UploadFileModal from '../src/user-space/src/pages/UploadFileModal';

/** 仓库根。__dirname = packages/react-components/__tests__ */
const ROOT = resolve(__dirname, '../../..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('真实挂载：调用点渲染出共享层的 zone', () => {
  it('shortcut-library 文件页：整块即触发区，框内只有文字', async () => {
    await act(async () => {
      root.render(
        <ImportModal
          onImport={() => ({ groupsAdded: 0, groupsAppended: 0, shortcutsAdded: 0, errors: [] })}
          onClose={() => {}}
        />,
      );
    });

    const tabs = container.querySelectorAll('.sl-sl-modal__tab');
    expect(tabs).toHaveLength(2);
    await act(async () => {
      (tabs[1] as HTMLElement).click();
    });

    const zone = container.querySelector('.sl-file-drop--zone');
    expect(zone).toBeTruthy();
    // 不再套一层按钮
    expect(container.querySelector('.sl-file-drop__btn')).toBeNull();
    // 文案由共享层生成：主文案 + 由 accept 推出的副文案
    expect(zone!.textContent).toContain('点击或拖拽文件到此处');
    expect(zone!.textContent).toContain('支持 .toml');
    // 根是 div，键盘可达性得自己补
    expect(zone!.getAttribute('role')).toBe('button');
  });

  it('user-space 上传弹窗：文件字段的控件就是 zone（表单标签留给宿主）', async () => {
    await act(async () => {
      root.render(
        <UploadFileModal
          open
          saving={false}
          progress={null}
          onUpload={async () => {}}
          onClose={() => {}}
        />,
      );
    });

    // 该弹窗 portal 到 document.body（测试里没有 [data-sl-portal] 锚点）
    const zone = document.body.querySelector('.sl-file-drop--zone');
    expect(zone).toBeTruthy();
    expect(document.body.querySelector('.sl-file-drop__btn')).toBeNull();
    expect(document.body.querySelector('.sl-us-field__label')?.textContent).toBe('文件');
    expect(zone!.textContent).toContain('点击或拖拽文件到此处');
    // 没有 accept（不限制类型）→ 共享层不渲染副文案
    expect(zone!.querySelector('.sl-file-drop__zone-hint')).toBeNull();
  });
});

describe('拖放区外观只有共享层一份', () => {
  const callers = [
    ['shortcut-library', 'packages/react-components/src/shortcut-library/src/pages/ImportModal.tsx'],
    ['github-show', 'packages/react-components/src/github-show/src/components/ImportModal.tsx'],
    ['color-studio', 'packages/react-components/src/color-studio/src/components/ImportModal.tsx'],
    ['user-space', 'packages/react-components/src/user-space/src/pages/UploadFileModal.tsx'],
  ] as const;

  it('四处调用点都用 variant: zone，且不再自备按钮类名', () => {
    for (const [name, rel] of callers) {
      const src = read(rel);
      expect(src, name).toContain("variant: 'zone'");
      expect(src, name).not.toContain("variant: 'bare'");
      // zone 没有按钮，buttonClass 无意义；写了会被共享层忽略，属误用
      expect(src, name).not.toContain('buttonClass');
    }
  });

  it('消费方不再自画虚线框（否则框套框 / 边框粗细不一）', () => {
    const zones = [
      ['shortcut-library', 'packages/react-components/src/shortcut-library/index.css', '.sl-sl-modal__file-zone'],
      ['github-show', 'packages/react-components/src/github-show/index.css', '.sl-gh-import__file-zone'],
      ['color-studio', 'packages/react-components/src/color-studio/index.css', '.sl-cs-import__file-zone'],
    ] as const;

    for (const [name, rel, sel] of zones) {
      const css = read(rel);
      const start = css.indexOf(`${sel} {`);
      expect(start, `${name} 里找不到 ${sel} 的规则`).toBeGreaterThan(-1);
      const block = css.slice(start, css.indexOf('}', start));
      expect(block, name).not.toContain('dashed');
    }
  });

  it('user-space 的 UploadFileModal 里也没有 dashed（框只能来自共享层）', () => {
    expect(read(callers[3][1])).not.toContain('dashed');
  });
});
