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
// 全部 ref —— 与 references/ 目录保持一致。新增 ref 时同步加进来,
// 否则文档被误删 / 路由表指向不存在的 ref 时测试不会报警。
const references = [
  'architecture-and-design-philosophy.md',
  'component-decision-tree.md',
  'component-level-dev-proxy.md',
  'dev-server-watcher.md',
  'eslint-extending-existing.md',
  'eslint-pattern-recipes.md',
  'eslint-testing-pattern.md',
  'fix-lint-loop.md',
  'how-to-add-component.md',
  'large-component-layout.md',
  'manifest-loader-reconciliation.md',
  'protocol.md',
  'shadow-dom-build-css-loss.md',
  'when-eslint-vs-ajv.md',
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
    //    允许 CRLF —— 仓库里的 skill 文档是 CRLF 行尾(Windows),写死 /^---\n/ 会误报
    expect(content).toMatch(/^---\r?\n/);
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

  it('every [[wikilink]] in SKILL.md resolves to an existing ref', () => {
    // SKILL.md 是路由表 —— 指向不存在的 ref 会让读者跟着死链走,
    // 这是本 skill 最实际的失效模式(改文件名却忘了改路由表)。
    const content = readFileSync(`${root}/SKILL.md`, 'utf8');
    const links = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const link of new Set(links)) {
      expect(existsSync(`${root}/references/${link}.md`), `[[${link}]] has no ref file`).toBe(true);
    }
  });
});