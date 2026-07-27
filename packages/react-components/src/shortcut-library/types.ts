// types.ts —— 快捷键库的数据模型

export interface KeyStroke {
  code: string;        // KeyboardEvent.code,例如 'KeyR' / 'ControlLeft'
  label: string;       // 显示名,例如 'Ctrl' / 'R' / '↑'
  isModifier: boolean; // Ctrl/Shift/Alt/Meta
}

export interface Shortcut {
  id: string;
  combo: KeyStroke[];  // 顺序:修饰键在前,主键在末尾
  description: string;
  createdAt: number;
}

export interface Group {
  id: string;
  name: string;
  shortcuts: Shortcut[];
  createdAt: number;
  updatedAt: number;
}
