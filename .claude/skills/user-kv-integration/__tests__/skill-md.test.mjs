// 单元测试:user-kv-integration skill 的"文件存在 + frontmatter 合法"测试。
// 验证两件事:
//   1) SKILL.md 与 references/*.md 都在
//   2) SKILL.md 的 frontmatter 有 name 和 description 字段
//
// 用 Node 内置 assert,避免依赖 vitest。

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = '.claude/skills/user-kv-integration';
const references = [
  'auth-jwt.md',
  'api-reference.md',
  'usage-scope.md',
  'adding-a-component.md',
];

describe('user-kv-integration skill', () => {
  it('has SKILL.md and all references', () => {
    assert.ok(existsSync(`${root}/SKILL.md`), 'SKILL.md missing');
    for (const ref of references) {
      assert.ok(existsSync(`${root}/references/${ref}`), `${ref} missing`);
    }
  });

  it('SKILL.md frontmatter has name and description', () => {
    const content = readFileSync(`${root}/SKILL.md`, 'utf8');
    // 允许 CRLF —— 仓库里的 skill 文档是 CRLF 行尾(Windows),写死 /^---\n/ 会误报
    assert.match(content, /^---\r?\n/, 'should start with YAML frontmatter');
    assert.match(content, /name:\s*user-kv-integration/, 'should declare name');
    assert.match(content, /description:/, 'should declare description');
  });

  it('each ref has substantive content (>5 lines)', () => {
    for (const ref of references) {
      const content = readFileSync(`${root}/references/${ref}`, 'utf8');
      assert.ok(content.split('\n').length > 5, `${ref} too short`);
    }
  });

  it('every [[wikilink]] in SKILL.md resolves to an existing ref', () => {
    // 指向不存在的 ref 会让读者跟着死链走 —— 改文件名却忘了改引用是最常见的失效。
    const content = readFileSync(`${root}/SKILL.md`, 'utf8');
    const links = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
    assert.ok(links.length > 0, 'SKILL.md should reference at least one ref');
    for (const link of new Set(links)) {
      assert.ok(existsSync(`${root}/references/${link}.md`), `[[${link}]] has no ref file`);
    }
  });
});
