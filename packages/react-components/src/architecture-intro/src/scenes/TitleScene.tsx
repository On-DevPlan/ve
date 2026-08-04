// 第 1 幕 —— 标题。
//
// 节奏设计(90 帧 / 3s):
//   f0    背景 + 粒子已在
//   f6    "ve" 巨型字标 spring 弹入并解除模糊
//   f22   中文主标题逐字上浮
//   f40   分隔线自中心展开
//   f48   三枚技术徽章依次弹入
// 每层间隔约 0.5s —— 比"全部一起淡入"更能引导视线自上而下。

import type { JSX } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { FloatingParticles } from '../components/FloatingParticles';
import { SceneBackdrop } from '../components/SceneBackdrop';
import { MONO_FONT, PALETTE, SANS_FONT } from '../constants';

/** 副标题下方的三枚技术徽章。抽成数组是为了让出场延迟按 index 递推。 */
const BADGES = [
  { label: 'Vue 3 Host', color: PALETTE.vue },
  { label: 'React 19 组件', color: PALETTE.react },
  { label: 'Shadow DOM 隔离', color: PALETTE.accent },
] as const;

export function TitleScene(): JSX.Element {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="TitleScene">
      <SceneBackdrop />
      <FloatingParticles count={70} color={PALETTE.accent} />

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
        }}
      >
        {/* 巨型字标。blur → 清晰的"聚焦"入场比单纯缩放更有电影感 */}
        <div
          style={{
            fontFamily: SANS_FONT,
            fontSize: 260,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: -6,
            background: `linear-gradient(135deg, ${PALETTE.text} 10%, ${PALETTE.accent} 55%, ${PALETTE.violet} 95%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            scale: interpolate(frame, [6, 34], [0.72, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.spring({ damping: 200 }),
              output: 'perceptual-scale',
            }),
            opacity: interpolate(frame, [6, 24], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            filter: `blur(${interpolate(frame, [6, 30], [18, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}px)`,
          }}
        >
          ve
        </div>

        {/* 中文主标题:上浮 + 字距收拢,收拢让文字有"落定"感 */}
        <div
          style={{
            marginTop: 12,
            fontFamily: SANS_FONT,
            fontSize: 76,
            fontWeight: 700,
            color: PALETTE.text,
            opacity: interpolate(frame, [22, 44], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(frame, [22, 44], ['0px 34px', '0px 0px'], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.spring({ damping: 200 }),
            }),
            letterSpacing: interpolate(frame, [22, 50], [18, 6], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          跨框架组件展示中心
        </div>

        {/* 分隔线:自中心向两侧展开 */}
        <div
          style={{
            marginTop: 34,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${PALETTE.accent}cc, transparent)`,
            width: interpolate(frame, [40, 66], ['0px', '620px'], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        />

        {/* 技术徽章:index * 7 帧的错峰,形成从左到右的"点亮"序列 */}
        <div style={{ marginTop: 34, display: 'flex', gap: 20 }}>
          {BADGES.map((badge, i) => (
            <div
              key={badge.label}
              style={{
                fontFamily: MONO_FONT,
                fontSize: 26,
                color: badge.color,
                padding: '12px 26px',
                borderRadius: 999,
                border: `1px solid ${badge.color}44`,
                background: `${badge.color}10`,
                opacity: interpolate(frame, [48 + i * 7, 68 + i * 7], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }),
                translate: interpolate(
                  frame,
                  [48 + i * 7, 68 + i * 7],
                  ['0px 20px', '0px 0px'],
                  {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: Easing.spring({ damping: 200 }),
                  },
                ),
              }}
            >
              {badge.label}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
