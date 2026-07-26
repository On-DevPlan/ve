// 单元测试:component-contract 类型契约。
// 用"静态类型断言 + 最小合法实例"的方式验证 types.ts 的关键 interface 可用。
// 因为这是类型层契约,真正的运行时校验在 component-config.schema.json(由 manifest-generator 调用 ajv)做。

import { describe, it, expect } from 'vitest'; // vitest 三件套
import type {
  ComponentConfig, // 组件配置
  ManifestEntry, // manifest 单条
  MountAdapter, // 统一挂载协议
  Framework, // 框架联合类型
} from '../src/types';

describe('component-contract types', () => {
  it('accepts a minimal Vue component config', () => {
    // 故意只填必填字段,验证最少可用形态
    const cfg: ComponentConfig = {
      id: 'button',
      name: 'Button',
      title: '按钮',
      description: '基础按钮',
      version: '1.0.0',
      framework: 'vue',
      entry: './index.vue',
      group: '基础',
      category: '交互',
      tags: ['button'],
      // mount.kind 是必填,其它可选
      mount: { kind: 'vue' },
    };
    // 字段访问正常
    expect(cfg.id).toBe('button');
    // 类型层断言:framework 必须是 Framework 联合之一
    expect(cfg.framework).toBe<Framework>('vue');
  });

  it('MountAdapter interface is structurally typed', () => {
    // 鸭子类型:只要对象形状对得上 MountAdapter 就合法
    const adapter: MountAdapter = {
      // canHandle 只在框架为 vue 时返回 true
      canHandle: (f) => f === 'vue',
      // mount 返回一个只有 unmount 的最小已挂载句柄
      mount: async () => ({ unmount: () => {} }),
    };
    expect(adapter.canHandle('vue')).toBe(true);
    expect(adapter.canHandle('react')).toBe(false);
  });

  it('ManifestEntry requires entryChunk and loaderKey', () => {
    // ManifestEntry 比 ComponentConfig 多了两个强制字段:
    //   assets.entryChunk —— 详情页 chunk
    //   loaderKey         —— registry.load() 的 key
    const entry: ManifestEntry = {
      id: 'button',
      name: 'Button',
      title: '按钮',
      description: '基础按钮',
      version: '1.0.0',
      framework: 'vue',
      group: '基础',
      category: '交互',
      tags: ['button'],
      // route.path 必须以 /components/ 开头(运行时校验)
      route: { path: '/components/button', title: '按钮' },
      mount: { kind: 'vue' },
      isolation: { mode: 'shadow-dom' },
      assets: { entryChunk: 'assets/button.js' },
      loaderKey: 'button',
    };
    expect(entry.loaderKey).toBe('button');
  });
});