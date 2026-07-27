import { describe, it, expect } from 'vitest';
import { parseImportToml, resolveCombo } from '../src/shortcut-library/import-parser';
import type { KeyStroke } from '../src/shortcut-library/types';

describe('resolveCombo', () => {
  it('resolves Ctrl+R to ControlLeft + KeyR', () => {
    const result = resolveCombo('Ctrl+R');
    expect(result).toBeInstanceOf(Array);
    const keys = result as KeyStroke[];
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatchObject({ code: 'ControlLeft', label: 'Ctrl', isModifier: true });
    expect(keys[1]).toMatchObject({ code: 'KeyR', label: 'R', isModifier: false });
  });

  it('resolves Shift+Alt+F to ShiftLeft + AltLeft + KeyF', () => {
    const result = resolveCombo('Shift+Alt+F');
    expect(result).toBeInstanceOf(Array);
    const keys = result as KeyStroke[];
    expect(keys).toHaveLength(3);
    expect(keys[0]).toMatchObject({ code: 'ShiftLeft', isModifier: true });
    expect(keys[1]).toMatchObject({ code: 'AltLeft', isModifier: true });
    expect(keys[2]).toMatchObject({ code: 'KeyF', isModifier: false });
  });

  it('resolves ArrowUp', () => {
    const result = resolveCombo('↑');
    expect(result).toBeInstanceOf(Array);
    const keys = result as KeyStroke[];
    expect(keys[0]).toMatchObject({ code: 'ArrowUp', label: '↑' });
  });

  it('rejects modifier-only combo (Ctrl+Shift)', () => {
    const result = resolveCombo('Ctrl+Shift');
    expect(typeof result).toBe('string');  // error string
  });

  it('rejects empty combo', () => {
    const result = resolveCombo('');
    expect(typeof result).toBe('string');
  });

  it('resolves single letter', () => {
    const result = resolveCombo('X');
    expect(result).toBeInstanceOf(Array);
    expect((result as KeyStroke[])[0]).toMatchObject({ code: 'KeyX', label: 'X' });
  });

  it('resolves F1..F12', () => {
    const result = resolveCombo('F7');
    expect(result).toBeInstanceOf(Array);
    expect((result as KeyStroke[])[0]).toMatchObject({ code: 'F7' });
  });
});

describe('parseImportToml', () => {
  it('parses a valid TOML with one group and one shortcut', () => {
    const toml = `[[groups]]
name = "VSCode"

[[groups.shortcuts]]
combo = "Ctrl+R"
desc = "打开目录"
`;
    const result = parseImportToml(toml);
    expect(result.errors).toHaveLength(0);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].name).toBe('VSCode');
    expect(result.groups[0].shortcuts).toHaveLength(1);
    expect(result.groups[0].shortcuts[0].description).toBe('打开目录');
    expect(result.groups[0].shortcuts[0].combo.length).toBeGreaterThan(0);
  });

  it('parses two groups with multiple shortcuts', () => {
    const toml = `[[groups]]
name = "Editor"

[[groups.shortcuts]]
combo = "Ctrl+S"
desc = "保存"

[[groups]]
name = "Browser"

[[groups.shortcuts]]
combo = "Ctrl+T"
desc = "新标签页"

[[groups.shortcuts]]
combo = "Ctrl+W"
desc = "关闭标签页"
`;
    const result = parseImportToml(toml);
    expect(result.errors).toHaveLength(0);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].shortcuts).toHaveLength(1);
    expect(result.groups[1].shortcuts).toHaveLength(2);
  });

  it('returns empty result for empty input', () => {
    const result = parseImportToml('');
    expect(result.groups).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('returns errors for malformed combo in shortcut entry', () => {
    const toml = `[[groups]]
name = "Test"

[[groups.shortcuts]]
combo = "Ctrl+Shift"
desc = "modifier only"
`;
    const result = parseImportToml(toml);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    // shortcut with bad combo is still included with empty combo
  });

  it('rejects unknown keys in TOML', () => {
    const toml = `[[groups]]
name = "Test"
color = "red"
`;
    const result = parseImportToml(toml);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('skips comment lines', () => {
    const toml = `# 这是一个注释
[[groups]]
name = "G"

[[groups.shortcuts]]
combo = "A"
desc = "only A"
`;
    const result = parseImportToml(toml);
    expect(result.errors).toHaveLength(0);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].shortcuts).toHaveLength(1);
  });

  it('handles desc before combo order-independently', () => {
    const toml = `[[groups]]
name = "Editor"

[[groups.shortcuts]]
desc = "保存文件"
combo = "Ctrl+S"

[[groups.shortcuts]]
combo = "Ctrl+X"
desc = "剪切"
`;
    const result = parseImportToml(toml);
    expect(result.errors).toHaveLength(0);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].shortcuts).toHaveLength(2);
    expect(result.groups[0].shortcuts[0].description).toBe('保存文件');
    expect(result.groups[0].shortcuts[1].description).toBe('剪切');
    expect(result.groups[0].shortcuts[1].combo).toHaveLength(2);
  });
});
