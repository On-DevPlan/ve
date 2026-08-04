// 第 3 幕 —— Shadow DOM 隔离。
//
// 讲的是 architecture-and-design-philosophy §6.1:两个不同框架的组件挂在同一页,
// 各自被 ShadowRoot 封起来,样式互不穿透。
//
// 视觉隐喻:两个并排的"容器",容器边框有一圈扫描光带(表示隔离边界是活的),
// 中间一道竖直虚线 + "样式不穿透"标签。
//
// 时间轴(120 帧):
//   f4/f12  左右两个容器弹入
//   f30     中央隔离带出现
//   f46     容器内的样式条目逐条点亮
//   f80     底部结论字幕

import type { JSX } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { FloatingParticles } from '../components/FloatingParticles';
import { SceneBackdrop } from '../components/SceneBackdrop';
import { SceneLabel } from '../components/SceneLabel';
import { MONO_FONT, PALETTE, SANS_FONT } from '../constants';

/** 每个容器里列出的"局部样式"条目 —— 用来演示两侧同名 class 不冲突 */
const REACT_STYLES = ['.sl-btn { color: #61dafb }', 'createRoot(portal)', 'React 19 reconciler'];
const VUE_STYLES = ['.sl-btn { color: #42d392 }', 'createApp().mount()', 'Vue 3 runtime'];

/**
 * 一侧的隔离容器。
 * 因为左右两侧结构完全对称、只有颜色/文案/延迟不同,抽成局部组件比复制一遍更安全 ——
 * 复制的话调整边框圆角要改两处,很容易漂移。
 */
function IsolatedBox({
  title,
  badge,
  color,
  items,
  delay,
  left,
}: {
  title: string;
  badge: string;
  color: string;
  items: readonly string[];
  delay: number;
  left: number;
}): JSX.Element {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: 300,
        width: 620,
        height: 470,
        borderRadius: 24,
        overflow: 'hidden',
        background: `linear-gradient(165deg, ${PALETTE.surface}f5, ${PALETTE.bg}f0)`,
        border: `1px solid ${color}55`,
        boxShadow: `0 0 0 1px ${color}18, 0 30px 70px -30px ${color}66`,
        scale: interpolate(frame, [delay, delay + 24], [0.9, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.spring({ damping: 200 }),
          output: 'perceptual-scale',
        }),
        opacity: interpolate(frame, [delay, delay + 16], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      }}
    >
      {/* 扫描光带:一条水平高光沿容器自上而下循环移动,周期 90 帧。
          表现"ShadowRoot 边界是运行时活跃的",也让静态面板不呆板。 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 120,
          background: `linear-gradient(180deg, transparent, ${color}1c, transparent)`,
          top: `${((frame * 1.6) % 590) - 120}px`,
        }}
      />

      {/* 容器标题栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '26px 32px',
          borderBottom: `1px solid ${color}28`,
        }}
      >
        <span
          style={{
            fontFamily: SANS_FONT,
            fontSize: 36,
            fontWeight: 700,
            color: PALETTE.text,
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontFamily: MONO_FONT,
            fontSize: 20,
            color,
            padding: '7px 16px',
            borderRadius: 999,
            border: `1px solid ${color}44`,
            background: `${color}12`,
          }}
        >
          {badge}
        </span>
      </div>

      {/* #shadow-root 标记 —— 明确告诉观众边界在哪一层 */}
      <div
        style={{
          margin: '26px 32px 0',
          padding: '14px 20px',
          borderRadius: 12,
          border: `1px dashed ${color}55`,
          fontFamily: MONO_FONT,
          fontSize: 22,
          color,
          background: `${color}0d`,
        }}
      >
        #shadow-root (open)
      </div>

      {/* 局部样式条目:每条延迟 10 帧点亮,形成"逐条注入"节奏 */}
      <div
        style={{
          padding: '22px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {items.map((item, i) => (
          <div
            key={item}
            style={{
              fontFamily: MONO_FONT,
              fontSize: 24,
              color: PALETTE.text,
              padding: '14px 20px',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.035)',
              borderLeft: `3px solid ${color}`,
              opacity: interpolate(
                frame,
                [46 + i * 10, 64 + i * 10],
                [0, 1],
                {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              ),
              translate: interpolate(
                frame,
                [46 + i * 10, 64 + i * 10],
                ['-16px 0px', '0px 0px'],
                {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              ),
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MicroFrontendScene(): JSX.Element {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="MicroFrontendScene">
      <SceneBackdrop glowA={PALETTE.react} glowB={PALETTE.vue} />
      <FloatingParticles count={35} color={PALETTE.violet} />
      <SceneLabel index="02" title="Shadow DOM:样式互不穿透" color={PALETTE.violet} />

      <IsolatedBox
        title="React 组件"
        badge="framework: react"
        color={PALETTE.react}
        items={REACT_STYLES}
        delay={4}
        left={200}
      />
      <IsolatedBox
        title="Vue 组件"
        badge="framework: vue"
        color={PALETTE.vue}
        items={VUE_STYLES}
        delay={12}
        left={1100}
      />

      {/* 中央隔离带:竖直虚线 + 徽标。这是本幕的"论点所在" */}
      <div
        style={{
          position: 'absolute',
          left: 860,
          top: 300,
          width: 200,
          height: 470,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: interpolate(frame, [30, 52], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        {/* 上半段虚线:自中心向上生长 */}
        <div
          style={{
            width: 0,
            borderLeft: `2px dashed ${PALETTE.accent}66`,
            height: interpolate(frame, [30, 58], ['0px', '175px'], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        />
        <div
          style={{
            margin: '16px 0',
            padding: '14px 20px',
            borderRadius: 14,
            border: `1px solid ${PALETTE.accent}55`,
            background: `${PALETTE.bg}f0`,
            fontFamily: SANS_FONT,
            fontSize: 24,
            fontWeight: 600,
            color: PALETTE.accent,
            textAlign: 'center',
            lineHeight: 1.4,
            scale: interpolate(frame, [36, 58], [0.7, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.spring({ damping: 200 }),
              output: 'perceptual-scale',
            }),
          }}
        >
          样式
          <br />
          不穿透
        </div>
        {/* 下半段虚线 */}
        <div
          style={{
            width: 0,
            borderLeft: `2px dashed ${PALETTE.accent}66`,
            height: interpolate(frame, [30, 58], ['0px', '175px'], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 900,
          textAlign: 'center',
          fontFamily: SANS_FONT,
          fontSize: 34,
          fontWeight: 500,
          color: PALETTE.muted,
          letterSpacing: 1,
          opacity: interpolate(frame, [80, 102], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [80, 102], ['0px 16px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        同名 class 各自生效 —— adoptStylesInto 按 djb2 指纹去重克隆
      </div>
    </AbsoluteFill>
  );
}
