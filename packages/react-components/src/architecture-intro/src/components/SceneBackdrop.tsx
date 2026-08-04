// SceneBackdrop —— 所有场景共用的底层背景。
//
// 三层叠加:纯色底 → 双色径向光晕 → 网格线。抽出来的理由是 5 幕都要它,
// 且每幕自己再画一遍的话,色值/光晕位置会慢慢漂移不一致。
//
// 注意:背景本身是静态的(不随 frame 变化)。动感由上层的 FloatingParticles
// 和场景内容提供 —— 背景也动会让画面失焦。

import type { JSX } from 'react';
import { AbsoluteFill } from 'remotion';
import { PALETTE } from '../constants';

interface Props {
  /** 左上角光晕色,默认品牌青 */
  glowA?: string;
  /** 右下角光晕色,默认强调紫 */
  glowB?: string;
}

export function SceneBackdrop({
  glowA = PALETTE.accent,
  glowB = PALETTE.violet,
}: Props): JSX.Element {
  return (
    <AbsoluteFill name="Backdrop" style={{ backgroundColor: PALETTE.bg }}>
      {/* 双色径向光晕:给深色底一点体积感,避免"纯黑板报"观感 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 55% at 18% 12%, ${glowA}22, transparent 70%), radial-gradient(ellipse 65% 60% at 85% 88%, ${glowB}20, transparent 72%)`,
        }}
      />
      {/* 网格线:80px 间距的极淡蓝线,暗示"工程/蓝图"语境 */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(120, 160, 255, 0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(120, 160, 255, 0.045) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />
      {/* 底部渐深:压住画面下沿,让字幕区域有对比度 */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, transparent 55%, rgba(3, 5, 12, 0.75) 100%)',
        }}
      />
    </AbsoluteFill>
  );
}
