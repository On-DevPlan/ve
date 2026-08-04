// FloatingParticles —— 帧驱动的粒子背景层。
//
// 关键点:粒子的初始位置/大小/速度由"确定性伪随机"生成,而不是 Math.random()。
// Remotion 会对同一帧多次求值(预览拖拽、渲染重试、并发渲染分片),Math.random()
// 会让每次求值画面不同 —— 渲染出来就是闪烁的雪花噪点。用 index 作为种子的
// 纯函数保证同 index 永远得到同一个粒子。

import type { JSX } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * 确定性伪随机:同一个 seed 永远返回同一个 [0, 1) 的值。
 * 取 sin 的小数部分,是 shader 里常见的廉价 hash。
 */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface Particle {
  /** 起始横向位置(百分比) */
  x: number;
  /** 起始纵向位置(百分比) */
  y: number;
  /** 直径(px) */
  size: number;
  /** 纵向漂移速度(百分比/帧) */
  drift: number;
  /** 呼吸周期(帧) */
  period: number;
  /** 基础透明度 */
  opacity: number;
}

/** 用 index 派生一个稳定的粒子。四个不同的 seed 偏移避免各属性相关。 */
function makeParticle(index: number): Particle {
  return {
    x: pseudoRandom(index + 1) * 100,
    y: pseudoRandom(index + 41) * 100,
    size: 1.5 + pseudoRandom(index + 83) * 4.5,
    drift: 0.015 + pseudoRandom(index + 127) * 0.05,
    period: 60 + pseudoRandom(index + 167) * 120,
    opacity: 0.15 + pseudoRandom(index + 211) * 0.45,
  };
}

interface Props {
  /** 粒子数量,默认 60 */
  count?: number;
  /** 粒子颜色,默认品牌青 */
  color?: string;
}

export function FloatingParticles({
  count = 60,
  color = '#39e0d0',
}: Props): JSX.Element {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill name="Particles" style={{ pointerEvents: 'none' }}>
      {Array.from({ length: count }, (_, i) => {
        const p = makeParticle(i);
        // 向上漂移并在顶部回绕(取模),保证任意长度的场景都不会"漂完"留白
        const y = (p.y - frame * p.drift * 100 / durationInFrames * 6 + 200) % 100;
        // 呼吸:sin 波调制透明度,让粒子层有生命感而不是静态噪点
        const breath = 0.55 + 0.45 * Math.sin((frame / p.period) * Math.PI * 2 + i);

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${y}%`,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: color,
              opacity: p.opacity * breath,
              boxShadow: `0 0 ${p.size * 3}px ${color}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}
