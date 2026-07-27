// keymap.ts —— KeyboardEvent.code → 显示标签
// 覆盖常用键;未命中时返回 key.toUpperCase() 作为兜底

export const MODIFIER_CODES = new Set([
  'ControlLeft', 'ControlRight',
  'ShiftLeft', 'ShiftRight',
  'AltLeft', 'AltRight',
  'MetaLeft', 'MetaRight',
]);

export const LABEL_MAP: Record<string, string> = {
  ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
  ShiftLeft: 'Shift', ShiftRight: 'Shift',
  AltLeft: 'Alt', AltRight: 'Alt',
  MetaLeft: '⌘', MetaRight: '⌘',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Enter: 'Enter', Escape: 'Esc', Tab: 'Tab', Backspace: '⌫', Delete: 'Del',
  Space: 'Space',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
  Semicolon: ';', Quote: "'", Backslash: '\\', Comma: ',', Period: '.', Slash: '/',
  Backquote: '`',
};

export function labelFor(code: string, fallbackKey: string): string {
  if (LABEL_MAP[code]) return LABEL_MAP[code];
  if (code.startsWith('Key')) return code.slice(3); // KeyR → R
  if (code.startsWith('Digit')) return code.slice(5); // Digit1 → 1
  if (code.startsWith('F') && /^F\d{1,2}$/.test(code)) return code; // F1..F12
  return fallbackKey.toUpperCase();
}

export function isModifier(code: string): boolean {
  return MODIFIER_CODES.has(code);
}
