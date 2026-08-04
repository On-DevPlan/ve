// 第 5 幕 —— 收尾。
//
// 三段式:三条要点回顾横向排开 → 大标语 → Powered by Remotion 署名。
// 最后 12 帧整体淡出 + 轻微缩放,给"片子结束"一个明确的收束动作
// (不淡出的话循环播放时会硬切,观感突兀)。
//
// 时间轴(90 帧):
//   f2+   三条要点错峰弹入
//   f28   大标语上浮
//   f48   署名淡入
//   f78   整体淡出

import type { JSX } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { FloatingParticles } from '../components/FloatingParticles';
import { SceneBackdrop } from '../components/SceneBackdrop';
import { MONO_FONT, PALETTE, SANS_FONT } from '../constants';

/** 三条要点回顾 —— 对应前三幕各自的结论 */
const TAKEAWAYS = [
  { value: '2', label: '个文件加一个组件', color: PALETTE.vue },
  { value: '2', label: '套框架同页共存', color: PALETTE.react },
  { value: '0', label: '行手动注册配置', color: PALETTE.accent },
] as const;

export function OutroScene(): JSX.Element {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      name="OutroScene"
      style={{
        // 整幕末尾统一淡出 + 收缩
        opacity: interpolate(frame, [78, 90], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.4, 0, 1, 1),
        }),
        scale: interpolate(frame, [78, 90], [1, 1.04], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.4, 0, 1, 1),
          output: 'perceptual-scale',
        }),
      }}
    >
      <SceneBackdrop glowA={PALETTE.accent} glowB={PALETTE.violet} />
      <FloatingParticles count={80} color={PALETTE.accent} />

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
        }}
      >
        {/* 三条要点:大数字 + 说明,错峰 9 帧弹入 */}
        <div style={{ display: 'flex', gap: 90, marginBottom: 74 }}>
          {TAKEAWAYS.map((item, i) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                opacity: interpolate(frame, [2 + i * 9, 24 + i * 9], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                }),
                scale: interpolate(frame, [2 + i * 9, 30 + i * 9], [0.7, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.spring({ damping: 200 }),
                  output: 'perceptual-scale',
                }),
              }}
            >
              <span
                style={{
                  fontFamily: SANS_FONT,
                  fontSize: 132,
                  fontWeight: 800,
                  lineHeight: 1,
                  color: item.color,
                  textShadow: `0 0 40px ${item.color}66`,
                }}
              >
                {item.value}
              </span>
              <span
                style={{
                  fontFamily: SANS_FONT,
                  fontSize: 28,
                  fontWeight: 500,
                  color: PALETTE.muted,
                  letterSpacing: 1,
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* 大标语 */}
        <div
          style={{
            fontFamily: SANS_FONT,
            fontSize: 92,
            fontWeight: 800,
            letterSpacing: 2,
            background: `linear-gradient(120deg, ${PALETTE.text} 15%, ${PALETTE.accent} 60%, ${PALETTE.violet} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            opacity: interpolate(frame, [28, 52], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(frame, [28, 52], ['0px 30px', '0px 0px'], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.spring({ damping: 200 }),
            }),
          }}
        >
          一套协议,两种框架
        </div>

        {/* 署名 */}
        <div
          style={{
            marginTop: 40,
            fontFamily: MONO_FONT,
            fontSize: 26,
            color: PALETTE.muted,
            letterSpacing: 3,
            opacity: interpolate(frame, [48, 70], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          POWERED BY REMOTION
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
