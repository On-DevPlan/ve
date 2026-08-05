export interface KeyStroke {
  code: string;
  label: string;
  isModifier: boolean;
}

export interface Shortcut {
  id: string;
  combo: KeyStroke[];
  description: string;
  condition?: string;
  createdAt: number;
}

export interface Group {
  id: string;
  name: string;
  shortcuts: Shortcut[];
  createdAt: number;
  updatedAt: number;
}
