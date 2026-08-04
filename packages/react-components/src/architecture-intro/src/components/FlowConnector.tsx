// FlowConnector —— 架构图里两个节点之间的连线,带"数据流"光点。
//
// 两段动画叠在一条路径上:
//   1) 描边生长(stroke-dashoffset 从满长收到 0)—— 表现"这条依赖被建立"
//   2) 一个沿路径循环移动的光点 —— 表现"数据在流动"
//
// 为什么用 SVG 而不是 div + 旋转:
//   直角折线(节点在不同行列)用 div 拼要三段元素 + 两个圆角,
//   而 SVG path 一行就描述完,且 stroke-dasharray 天然支持描边生长动画。
//
// 为什么不用 CSS @keyframes 做光点:
//   Remotion 渲染时按帧截图,CSS 动画的当前进度不由 frame 决定 ——
//   渲染出来会全帧同一位置(或随机位置)。必须用 frame 算坐标。

import type { JSX } from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';

interface Props {
  /** SVG path 的 d 属性。坐标系 = 父级 svg 的 viewBox */
  d: string;
  /** 路径总长(px)。用于 stroke-dasharray;取略大于真实长度的值即可 */
  length: number;
  /** 线条颜色 */
  color: string;
  /** 描边开始生长的帧 */
  delay: number;
  /** 描边生长时长(帧),默认 26 */
  growFrames?: number;
  /** 光点循环周期(帧),默认 55 */
  pulsePeriod?: number;
}

export function FlowConnector({
  d,
  length,
  color,
  delay,
  growFrames = 26,
  pulsePeriod = 55,
}: Props): JSX.Element {
  const frame = useCurrentFrame();

  // 光点只在描边画完之后才出现,否则会看到点跑在线的前面
  const pulseVisible = frame > delay + growFrames;
  // 光点在路径上的归一化位置:锯齿波(取模),周期 pulsePeriod
  const pulseProgress = ((frame - delay - growFrames) % pulsePeriod) / pulsePeriod;

  return (
    <>
      {/* 底层:静态的极淡导轨,让"线还没画到"的部分也有位置暗示 */}
      <path d={d} stroke={`${color}1f`} strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* 生长层:dashoffset 从 length 收到 0,视觉上就是线从起点长到终点 */}
      <path
        d={d}
        stroke={color}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={length}
        style={{
          strokeDashoffset: interpolate(
            frame,
            [delay, delay + growFrames],
            [length, 0],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
          filter: `drop-shadow(0 0 6px ${color}aa)`,
        }}
      />
      {/* 流动光点:一段很短的 dash 沿路径滑动。
          用 dasharray '10 <length>' 造出"只有 10px 可见"的一小段,
          再用 dashoffset 推着它沿路径走。 */}
      {pulseVisible ? (
        <path
          d={d}
          stroke="#ffffff"
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`10 ${length}`}
          strokeDashoffset={-pulseProgress * length}
          style={{
            // 两端淡出,避免光点"啪"地出现和消失在节点边缘
            opacity: interpolate(pulseProgress, [0, 0.12, 0.88, 1], [0, 1, 1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            filter: `drop-shadow(0 0 10px ${color})`,
          }}
        />
      ) : null}
    </>
  );
}
