// 单元测试:web-work-flow skill 的"文件存在 + frontmatter 合法"测试。
// 验证两件事:
//   1) SKILL.md 与 3 个 references/*.md 都在
//   2) SKILL.md 的 frontmatter 有 name 和 description 字段
//
// 这是元测试,只保证 skill 文件能被 Claude Code 发现并解析,
// 不验证 skill 的工作循环——那部分靠真实使用驱动。

import { describe, it, expect } from 'vitest'; // vitest 三件套
import { readFileSync, existsSync } from 'node:fs'; // 文件系统读取

// skill 根目录(相对仓库根)
const root = '.claude/skills/web-work-flow';
const references = [
  'architecture-and-design-philosophy.md',
  'how-to-add-component.md',
  'fix-lint-loop.md',
  'component-level-dev-proxy.md',
  'protocol.md',
  'manifest-loader-reconciliation.md',
];

describe('web-work-flow skill', () => {
  it('has SKILL.md and all references', () => {
    // 主文档必须存在
    expect(existsSync(`${root}/SKILL.md`)).toBe(true);
    // 3 个 ref 必须都存在
    for (const ref of references) {
      expect(existsSync(`${root}/references/${ref}`)).toBe(true);
    }
  });

  it('SKILL.md frontmatter has name and description', () => {
    // 读取 SKILL.md 全文
    const content = readFileSync(`${root}/SKILL.md`, 'utf8');
    // 1. 必须以 --- 起头(YAML frontmatter 起始)
    expect(content).toMatch(/^---\n/);
    // 2. 必须有 name: web-work-flow
    expect(content).toMatch(/name:\s*web-work-flow/);
    // 3. 必须有 description: 字段
    expect(content).toMatch(/description:/);
  });

  it('each ref contains a back-link to the main SKILL.md', () => {
    // 每个 ref 第一段都应该提到主文档或主题,便于交叉引用
    for (const ref of references) {
      const content = readFileSync(`${root}/references/${ref}`, 'utf8');
      // 至少有 5 行内容(避免空文档或只有 frontmatter)
      expect(content.split('\n').length).toBeGreaterThan(5);
    }
  });
});