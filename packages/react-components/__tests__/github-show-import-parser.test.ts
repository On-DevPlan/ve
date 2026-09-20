// __tests__/github-show-import-parser.test.ts —— TOML 导入解析器单测。
// 覆盖:基础解析 / name 自动解析 / 未知 key 建列 / 现有列匹配 /
//       缺 repo_url / 文件内重复 / is_fork 别名 / 行内注释 / 转义 / 其它表头警告。

import { describe, expect, it } from 'vitest';
import { parseImportToml } from '../src/github-show/src/engine/import-parser';
import { FORMAT_PROMPT, buildGhReposPrompt } from '../src/github-show/src/engine/import-prompts';

describe('parseImportToml', () => {
  it('空文本返回空结果', () => {
    const r = parseImportToml('', []);
    expect(r.projects).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.pendingColumnTitles).toEqual([]);
  });

  it('基础解析:repo_url + name 自动解析', () => {
    const toml = [
      '[[projects]]',
      'repo_url = "https://github.com/vuejs/core"',
      '',
      '[[projects]]',
      'repo_url = "https://github.com/vitejs/vite"',
      'name = "vite"',
    ].join('\n');
    const r = parseImportToml(toml, []);
    expect(r.projects).toHaveLength(2);
    expect(r.projects[0].name).toBe('vuejs/core'); // 从链接推导
    expect(r.projects[1].name).toBe('vite'); // 显式 name 优先
    expect(r.projects[0].repoUrl).toBe('https://github.com/vuejs/core');
    expect(r.errors).toEqual([]);
  });

  it('未知 key 进 pendingValues + pendingColumnTitles;现有列按 title 匹配进 values', () => {
    const toml = [
      '[[projects]]',
      'repo_url = "https://github.com/a/b"',
      'visibility = "公开"',
      '技术栈 = "Vue"',
    ].join('\n');
    const r = parseImportToml(toml, [{ id: 'col1', title: '技术栈' }]);
    expect(r.pendingColumnTitles).toEqual(['visibility']);
    expect(r.projects[0].pendingValues).toEqual({ visibility: '公开' });
    expect(r.projects[0].values).toEqual({ col1: 'Vue' }); // 匹配到现有列
  });

  it('缺 repo_url 整条跳过并报错', () => {
    const toml = '[[projects]]\nname = "orphan"';
    const r = parseImportToml(toml, []);
    expect(r.projects).toEqual([]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('repo_url');
  });

  it('文件内重复 repoUrl 保留首条 + warning(归一化后比较)', () => {
    const toml = [
      '[[projects]]',
      'repo_url = "https://github.com/a/b"',
      '[[projects]]',
      'repo_url = "https://www.github.com/a/b.git"', // 同仓库,不同写法
    ].join('\n');
    const r = parseImportToml(toml, []);
    expect(r.projects).toHaveLength(1);
    expect(r.projects[0].repoUrl).toBe('https://github.com/a/b');
    expect(r.warnings.some((w) => w.includes('重复'))).toBe(true);
  });

  it('is_fork 布尔别名容忍 + 非法值 warning', () => {
    const toml = [
      '[[projects]]',
      'repo_url = "https://github.com/a/b"',
      'is_fork = "yes"',
      '[[projects]]',
      'repo_url = "https://github.com/c/d"',
      'is_fork = "maybe"',
    ].join('\n');
    const r = parseImportToml(toml, []);
    expect(r.projects[0].isFork).toBe(true);
    expect(r.projects[1].isFork).toBeUndefined();
    expect(r.warnings.some((w) => w.includes('is_fork'))).toBe(true);
  });

  it('行内 # 注释(引号值后)被剥离', () => {
    const toml = '[[projects]]\nrepo_url = "https://github.com/a/b" # 主仓库';
    const r = parseImportToml(toml, []);
    expect(r.projects[0].repoUrl).toBe('https://github.com/a/b');
  });

  it('双引号内转义还原', () => {
    const toml = '[[projects]]\nrepo_url = "https://github.com/a/b"\nhighlights = "支持 \\"引用\\" 与 \\\\ 反斜杠"';
    const r = parseImportToml(toml, []);
    expect(r.projects[0].highlights).toBe('支持 "引用" 与 \\ 反斜杠');
  });

  it('其它表头警告但不阻断', () => {
    const toml = '[[repos]]\nrepo_url = "https://github.com/a/b"\n[[projects]]\nrepo_url = "https://github.com/c/d"';
    const r = parseImportToml(toml, []);
    expect(r.projects).toHaveLength(1);
    expect(r.projects[0].repoUrl).toBe('https://github.com/c/d');
    expect(r.warnings.some((w) => w.includes('[[repos]]'))).toBe(true);
  });

  it('中文字段值原样保留', () => {
    const toml = '[[projects]]\nrepo_url = "https://github.com/a/b"\nhighlights = "组合式 API、高性能虚拟 DOM"';
    const r = parseImportToml(toml, []);
    expect(r.projects[0].highlights).toBe('组合式 API、高性能虚拟 DOM');
  });
});

describe('import-prompts', () => {
  it('FORMAT_PROMPT 无 emoji 且声明 [[projects]]', () => {
    expect(FORMAT_PROMPT).toContain('[[projects]]');
    expect(FORMAT_PROMPT).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it('buildGhReposPrompt 按选项生成对应命令', () => {
    const p = buildGhReposPrompt({ months: 6, scope: 'mine', fork: 'exclude', visibility: 'public' });
    expect(p).toContain('6 months ago');
    expect(p).toContain('--visibility public');
    expect(p).toContain('.isFork == false');
    expect(p).not.toContain('user/orgs'); // 仅个人仓库,不遍历组织
    expect(p).toContain('gh auth status');
    expect(p).toContain('gh api user --jq .login');
    expect(p).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });

  it('组织范围 + 包含 fork 时命令包含组织遍历与 is_fork 字段', () => {
    const p = buildGhReposPrompt({ months: 36, scope: 'mine+orgs', fork: 'include', visibility: 'all' });
    expect(p).toContain('36 months ago');
    expect(p).toContain('user/orgs');
    expect(p).not.toContain('--visibility public');
    expect(p).not.toContain('.isFork == false');
    expect(p).toContain('is_fork = false');
    expect(p).toContain('macOS');
  });
});
