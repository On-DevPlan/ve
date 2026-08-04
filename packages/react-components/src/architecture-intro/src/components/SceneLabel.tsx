// SceneLabel —— 每幕左上角的"章节标记"。
//
// 由一个序号胶囊 + 标题 + 一条自左向右生长的下划线组成。
// 作用是给观众持续的"我在第几幕"定位感 —— 这是 PPT 页码的动效等价物,
// 也是让 5 幕看起来是"一部片子"而不是"5 段无关动画"的关键。

import type { JSX } from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { MONO_FONT, PALETTE, SANS_FONT } from '../constants';

interface Props {
  /** 序号,如 '01' */
  index: string;
  /** 章节标题 */
  title: string;
  /** 强调色(胶囊边框 + 下划线),默认品牌青 */
  color?: string;
}

export function SceneLabel({
  index,
  title,
  color = PALETTE.accent,
}: Props): JSX.Element {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: 'absolute',
        top: 92,
        left: 120,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        // 整块从左侧滑入 + 淡入,0.5s 内完成
        opacity: interpolate(frame, [0, 15], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
        translate: interpolate(frame, [0, 15], ['-40px 0px', '0px 0px'], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <span
          style={{
            fontFamily: MONO_FONT,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: 2,
            color,
            padding: '7px 18px',
            borderRadius: 999,
            border: `1px solid ${color}55`,
            background: `${color}12`,
          }}
        >
          {index}
        </span>
        <span
          style={{
            fontFamily: SANS_FONT,
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: 1,
            color: PALETTE.text,
          }}
        >
          {title}
        </span>
      </div>
      {/* 下划线:延迟 6 帧后自左生长,制造"写下标题"的节奏 */}
      <div
        style={{
          height: 2,
          borderRadius: 2,
          background: `linear-gradient(90deg, ${color}, transparent)`,
          width: interpolate(frame, [6, 30], ['0px', '460px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      />
    </div>
  );
}
