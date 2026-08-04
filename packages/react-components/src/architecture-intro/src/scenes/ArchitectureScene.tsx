// 第 2 幕 —— 分层架构。
//
// 讲的是 architecture-and-design-philosophy §2:Host 不感知框架,
// 通过 MountAdapter 把 React / Vue 组件挂进同一棵 DOM。
//
// 布局是手算的三层网格,坐标写死在 LAYOUT 里,SVG 连线共用同一套坐标系
// (viewBox = 1920x1080,与合成尺寸 1:1)。这样连线端点和卡片边缘严格对齐 ——
// 用百分比或 flex 布局做不到这一点,因为 SVG 拿不到 flex 计算后的位置。
//
// 时间轴(130 帧):
//   f4   Host 卡片弹入
//   f16  两条主干连线生长
//   f24  两个 Adapter 卡片弹入
//   f44  两条支线生长
//   f48  两个组件包卡片弹入
//   f78  底部结论字幕淡入

import type { JSX } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { FloatingParticles } from '../components/FloatingParticles';
import { FlowConnector } from '../components/FlowConnector';
import { NodeCard } from '../components/NodeCard';
import { SceneBackdrop } from '../components/SceneBackdrop';
import { SceneLabel } from '../components/SceneLabel';
import { PALETTE, SANS_FONT } from '../constants';

/**
 * 三层网格的绝对坐标(px,合成坐标系)。
 * 卡片高度约 128px(padding 26*2 + 标题 41 + 副标题 34),
 * 连线端点用的 y 值 = top + 128,改 NodeCard 的 padding/字号要同步核对。
 */
const LAYOUT = {
  /** 第 1 层:Vue Host。居中,宽 460 */
  hostLeft: 730,
  hostTop: 235,
  hostWidth: 460,
  /** 第 2/3 层卡片宽度 */
  cardWidth: 400,
  /** 左列 / 右列的卡片 left 值(中心分别在 x=560 / x=1360) */
  leftCol: 360,
  rightCol: 1160,
  /** 第 2 层(Adapter)/ 第 3 层(组件包)的 top */
  adapterTop: 495,
  packageTop: 725,
} as const;

export function ArchitectureScene(): JSX.Element {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="ArchitectureScene">
      <SceneBackdrop glowA={PALETTE.react} glowB={PALETTE.vue} />
      <FloatingParticles count={40} color={PALETTE.react} />
      <SceneLabel index="01" title="分层架构:Host 不感知框架" color={PALETTE.accent} />

      {/* 连线层。放在卡片下方(先渲染)让卡片盖住线的端点,视觉上线是"插进"卡片的 */}
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Host → 左 Adapter(正交折线:下 → 左 → 下) */}
        <FlowConnector
          d="M960 363 V430 H560 V495"
          length={532}
          color={PALETTE.react}
          delay={16}
        />
        {/* Host → 右 Adapter */}
        <FlowConnector
          d="M960 363 V430 H1360 V495"
          length={532}
          color={PALETTE.vue}
          delay={20}
        />
        {/* 左 Adapter → react-components */}
        <FlowConnector d="M560 623 V725" length={102} color={PALETTE.react} delay={44} />
        {/* 右 Adapter → vue-components */}
        <FlowConnector d="M1360 623 V725" length={102} color={PALETTE.vue} delay={50} />
      </svg>

      {/* 第 1 层:Vue Host */}
      <div
        style={{
          position: 'absolute',
          left: LAYOUT.hostLeft,
          top: LAYOUT.hostTop,
        }}
      >
        <NodeCard
          title="Vue 3 Host"
          subtitle="createApp() + RouterView"
          color={PALETTE.accent}
          delay={4}
          width={LAYOUT.hostWidth}
          glow
        />
      </div>

      {/* 第 2 层:两个 Adapter */}
      <div
        style={{ position: 'absolute', left: LAYOUT.leftCol, top: LAYOUT.adapterTop }}
      >
        <NodeCard
          title="ReactMountAdapter"
          subtitle="createRoot(portal)"
          color={PALETTE.react}
          delay={24}
          width={LAYOUT.cardWidth}
        />
      </div>
      <div
        style={{ position: 'absolute', left: LAYOUT.rightCol, top: LAYOUT.adapterTop }}
      >
        <NodeCard
          title="VueMountAdapter"
          subtitle="createApp().mount()"
          color={PALETTE.vue}
          delay={32}
          width={LAYOUT.cardWidth}
        />
      </div>

      {/* 第 3 层:两个组件包 */}
      <div
        style={{ position: 'absolute', left: LAYOUT.leftCol, top: LAYOUT.packageTop }}
      >
        <NodeCard
          title="react-components"
          subtitle="index.tsx"
          color={PALETTE.react}
          delay={48}
          width={LAYOUT.cardWidth}
        />
      </div>
      <div
        style={{ position: 'absolute', left: LAYOUT.rightCol, top: LAYOUT.packageTop }}
      >
        <NodeCard
          title="vue-components"
          subtitle="index.vue"
          color={PALETTE.vue}
          delay={56}
          width={LAYOUT.cardWidth}
        />
      </div>

      {/* 底部结论字幕。这是本幕的"一句话要点",画面其它元素都在为它服务 */}
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
          opacity: interpolate(frame, [78, 100], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [78, 100], ['0px 16px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        统一 MountAdapter 协议 —— 不共享运行时,只共享 DOM 节点
      </div>
    </AbsoluteFill>
  );
}
