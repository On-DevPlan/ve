// 第 4 幕 —— 零配置自动发现。
//
// 讲的是 architecture-and-design-philosophy §5 的双轨制:
//   import.meta.glob 扫 loader,manifestPlugin 扫 metadata,
//   加组件只写两个文件,其余全自动。
//
// 视觉:左边一棵文件树(逐行点亮 + 扫描高亮条),右边两条产出管道
// (loader 表 / manifest JSON),中间箭头把两侧连起来。
//
// 时间轴(130 帧):
//   f4    文件树容器弹入
//   f14+  文件树逐行点亮(每行 6 帧)
//   f56   扫描高亮条开始上下扫
//   f62   右侧两条产出管道弹入
//   f86   底部结论字幕

import type { JSX } from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';
import { FloatingParticles } from '../components/FloatingParticles';
import { SceneBackdrop } from '../components/SceneBackdrop';
import { SceneLabel } from '../components/SceneLabel';
import { MONO_FONT, PALETTE, SANS_FONT } from '../constants';

/**
 * 文件树行。depth 控制缩进,highlight 标记"作者手写的那两个文件"——
 * 高亮的两行是本幕的论点:只有这两个是人写的,其余都是自动的。
 */
const TREE = [
  { text: 'packages/react-components/', depth: 0, highlight: false },
  { text: 'src/', depth: 1, highlight: false },
  { text: 'architecture-intro/', depth: 2, highlight: false },
  { text: 'component.config.ts', depth: 3, highlight: true },
  { text: 'index.tsx', depth: 3, highlight: true },
  { text: 'index.css', depth: 3, highlight: false },
] as const;

/** 右侧两条自动产出管道 */
const PIPELINES = [
  {
    title: 'import.meta.glob',
    detail: "'../../packages/*/src/*/index.tsx'",
    result: '→ loaders["architecture-intro"]',
    color: PALETTE.react,
    delay: 62,
    top: 320,
  },
  {
    title: 'manifestPlugin',
    detail: 'fast-glob + ajv 校验',
    result: '→ component-manifest.json',
    color: PALETTE.violet,
    delay: 74,
    top: 560,
  },
] as const;

export function DiscoveryScene(): JSX.Element {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill name="DiscoveryScene">
      <SceneBackdrop glowA={PALETTE.violet} glowB={PALETTE.accent} />
      <FloatingParticles count={38} color={PALETTE.accent} />
      <SceneLabel index="03" title="零配置:双轨自动发现" color={PALETTE.vue} />

      {/* 左:文件树面板 */}
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 320,
          width: 700,
          padding: '32px 36px',
          borderRadius: 22,
          overflow: 'hidden',
          background: `linear-gradient(165deg, ${PALETTE.surface}f5, ${PALETTE.bg}f0)`,
          border: `1px solid ${PALETTE.border}`,
          boxShadow: '0 30px 70px -30px rgba(0, 0, 0, 0.95)',
          scale: interpolate(frame, [4, 28], [0.9, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.spring({ damping: 200 }),
            output: 'perceptual-scale',
          }),
          opacity: interpolate(frame, [4, 20], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        {/* 扫描条:f56 之后开始在面板内上下扫,表现"构建时正在扫描文件系统" */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 90,
            background: `linear-gradient(180deg, transparent, ${PALETTE.vue}22, transparent)`,
            top: `${((frame - 56) * 3.2) % 480 - 90}px`,
            opacity: interpolate(frame, [56, 70], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        />

        {TREE.map((row, i) => (
          <div
            key={row.text}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginLeft: row.depth * 34,
              padding: '11px 16px',
              marginBottom: 6,
              borderRadius: 9,
              fontFamily: MONO_FONT,
              fontSize: 27,
              // 高亮行(作者手写的两个文件)用绿色 + 背景块区分
              color: row.highlight ? PALETTE.vue : PALETTE.muted,
              background: row.highlight ? `${PALETTE.vue}14` : 'transparent',
              border: row.highlight
                ? `1px solid ${PALETTE.vue}3a`
                : '1px solid transparent',
              opacity: interpolate(frame, [14 + i * 6, 30 + i * 6], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
              translate: interpolate(
                frame,
                [14 + i * 6, 30 + i * 6],
                ['-22px 0px', '0px 0px'],
                {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              ),
            }}
          >
            {/* 手写文件前面加一个 ✎,自动文件留空,视觉上一眼分出"谁是人写的" */}
            <span style={{ width: 26, color: row.highlight ? PALETTE.vue : 'transparent' }}>
              {row.highlight ? '✎' : '·'}
            </span>
            {row.text}
          </div>
        ))}
      </div>

      {/* 中间箭头:两条从文件树指向右侧管道的曲线 */}
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{ position: 'absolute', inset: 0 }}
      >
        {PIPELINES.map((p) => (
          <path
            key={p.title}
            // 三次贝塞尔:自文件树右缘平滑弯向管道左缘
            d={`M870 500 C 960 500, 960 ${p.top + 90}, 1050 ${p.top + 90}`}
            stroke={p.color}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={220}
            style={{
              strokeDashoffset: interpolate(
                frame,
                [p.delay - 10, p.delay + 16],
                [220, 0],
                {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              ),
              filter: `drop-shadow(0 0 6px ${p.color}aa)`,
            }}
          />
        ))}
      </svg>

      {/* 右:两条产出管道 */}
      {PIPELINES.map((p) => (
        <div
          key={p.title}
          style={{
            position: 'absolute',
            left: 1070,
            top: p.top,
            width: 680,
            padding: '28px 34px',
            borderRadius: 20,
            background: `linear-gradient(160deg, ${PALETTE.surface}f5, ${PALETTE.bg}f0)`,
            border: `1px solid ${p.color}44`,
            boxShadow: `0 24px 60px -28px ${p.color}66`,
            scale: interpolate(frame, [p.delay, p.delay + 24], [0.9, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.spring({ damping: 200 }),
              output: 'perceptual-scale',
            }),
            opacity: interpolate(frame, [p.delay, p.delay + 16], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: interpolate(
              frame,
              [p.delay, p.delay + 24],
              ['26px 0px', '0px 0px'],
              {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: Easing.spring({ damping: 200 }),
              },
            ),
          }}
        >
          <div
            style={{
              fontFamily: MONO_FONT,
              fontSize: 31,
              fontWeight: 600,
              color: p.color,
            }}
          >
            {p.title}
          </div>
          <div
            style={{
              marginTop: 10,
              fontFamily: MONO_FONT,
              fontSize: 22,
              color: PALETTE.muted,
            }}
          >
            {p.detail}
          </div>
          <div
            style={{
              marginTop: 18,
              paddingTop: 18,
              borderTop: `1px solid ${p.color}22`,
              fontFamily: MONO_FONT,
              fontSize: 24,
              color: PALETTE.text,
            }}
          >
            {p.result}
          </div>
        </div>
      ))}

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
          opacity: interpolate(frame, [86, 108], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: interpolate(frame, [86, 108], ['0px 16px', '0px 0px'], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        写两个文件 —— 卡片、路由、独立 chunk 全部自动生成
      </div>
    </AbsoluteFill>
  );
}
