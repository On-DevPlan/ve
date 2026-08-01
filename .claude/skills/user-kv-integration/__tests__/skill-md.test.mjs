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
const references = ['protocol.md'];

describe('user-kv-integration skill', () => {
  it('has SKILL.md and all references', () => {
    assert.ok(existsSync(`${root}/SKILL.md`), 'SKILL.md missing');
    for (const ref of references) {
      assert.ok(existsSync(`${root}/references/${ref}`), `${ref} missing`);
    }
  });

  it('SKILL.md frontmatter has name and description', () => {
    const content = readFileSync(`${root}/SKILL.md`, 'utf8');
    assert.match(content, /^---\n/, 'should start with YAML frontmatter');
    assert.match(content, /name:\s*user-kv-integration/, 'should declare name');
    assert.match(content, /description:/, 'should declare description');
  });

  it('each ref has substantive content (>5 lines)', () => {
    for (const ref of references) {
      const content = readFileSync(`${root}/references/${ref}`, 'utf8');
      assert.ok(content.split('\n').length > 5, `${ref} too short`);
    }
  });
});