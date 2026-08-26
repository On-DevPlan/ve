// packages/react-components/src/color-studio/src/components/ui/Btn.tsx
//
// 统一按钮基元:4 variant × 2 size × 全状态(hover/active/disabled/focus-visible)。
// icon prop 传 IconName 时左侧渲染 icon。

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconOnly?: boolean;
  children?: ReactNode;
}

export function Btn({
  variant = 'secondary',
  size = 'md',
  icon,
  iconOnly = false,
  children,
  className,
  type = 'button',
  ...rest
}: Props) {
  const cls = [
    'sl-cs-btn',
    `sl-cs-btn--${variant}`,
    `sl-cs-btn--${size}`,
    iconOnly ? 'sl-cs-btn--icon-only' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 13 : 15} />}
      {!iconOnly && children}
    </button>
  );
}
