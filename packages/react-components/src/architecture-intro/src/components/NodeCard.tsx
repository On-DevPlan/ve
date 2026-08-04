// NodeCard —— 架构图里的一个"盒子"(Host / Adapter / 组件包 / ShadowRoot)。
//
// 视觉:玻璃质感面板 + 顶部一道强调色高光 + 可选的辉光。
// 动画:spring 缩放弹入 + 淡入,由 delay 控制出场顺序,让架构图"逐级搭建"
// 而不是整张图一起闪现 —— 逐级出场才能让观众跟上依赖方向。

import type { JSX, ReactNode } from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { MONO_FONT, PALETTE, SANS_FONT } from '../constants';

interface Props {
  /** 主标题,如 'Vue 3 Host' */
  title: string;
  /** 副标题(等宽字体),如 'createApp()' */
  subtitle?: string;
  /** 强调色 */
  color: string;
  /** 出场延迟(帧) */
  delay: number;
  /** 面板宽度(px) */
  width: number;
  /** 是否常亮辉光(用于强调当前讲述的节点) */
  glow?: boolean;
  /** 额外内容,渲染在副标题下方 */
  children?: ReactNode;
}

export function NodeCard({
  title,
  subtitle,
  color,
  delay,
  width,
  glow = false,
  children,
}: Props): JSX.Element {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: 'relative',
        width,
        padding: '26px 30px',
        borderRadius: 18,
        background: `linear-gradient(160deg, ${PALETTE.surface}f0, ${PALETTE.bg}e0)`,
        border: `1px solid ${color}44`,
        boxShadow: glow
          ? `0 0 0 1px ${color}22, 0 18px 50px -18px ${color}88, inset 0 1px 0 ${color}22`
          : `0 18px 40px -22px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
        // 弹入:spring 缩放。output: 'perceptual-scale' 让视觉尺寸线性变化
        // (线性 scale 在大尺寸端观感会"变慢")
        scale: interpolate(frame, [delay, delay + 22], [0.86, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.spring({ damping: 200 }),
          output: 'perceptual-scale',
        }),
        opacity: interpolate(frame, [delay, delay + 14], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
        translate: interpolate(frame, [delay, delay + 22], ['0px 18px', '0px 0px'], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.spring({ damping: 200 }),
        }),
      }}
    >
      {/* 顶部高光条:一道从中心向两侧衰减的强调色,给玻璃面板一个"受光边" */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 24,
          right: 24,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
      />
      <div
        style={{
          fontFamily: SANS_FONT,
          fontSize: 34,
          fontWeight: 700,
          color: PALETTE.text,
          letterSpacing: 0.5,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            marginTop: 8,
            fontFamily: MONO_FONT,
            fontSize: 22,
            color,
            letterSpacing: 0.5,
          }}
        >
          {subtitle}
        </div>
      ) : null}
      {children}
    </div>
  );
}
