// IntroVideo —— 主合成:TransitionSeries 串联 5 幕。
//
// 过渡编排(见 remotion-markup/transitions.md):
//   1→2  slide(from-right)  横向推进,呼应"从标题进入正文"
//   2→3  fade               同为架构类内容,柔和切换
//   3→4  slide(from-bottom) 纵向推进,标记话题转向"构建期"
//   4→5  fade               收尾用最柔和的方式
//
// 时长核对(改动任一场景时必须重算):
//   sum(SCENE) = 90 + 130 + 120 + 130 + 90 = 560
//   4 段过渡 × 20 帧,过渡期两幕重叠 → 总长 560 - 80 = 480 = TOTAL_DURATION
// TOTAL_DURATION 被 index.tsx 的 <Player durationInFrames> 消费;
// 两者不一致会导致末幕被截断或结尾出现黑帧。

import type { JSX } from 'react';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { SCENE, TRANSITION_FRAMES } from './constants';
import { ArchitectureScene } from './scenes/ArchitectureScene';
import { DiscoveryScene } from './scenes/DiscoveryScene';
import { MicroFrontendScene } from './scenes/MicroFrontendScene';
import { OutroScene } from './scenes/OutroScene';
import { TitleScene } from './scenes/TitleScene';

export function IntroVideo(): JSX.Element {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENE.title} name="01 标题">
        <TitleScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: 'from-right' })}
        timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE.architecture} name="02 分层架构">
        <ArchitectureScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE.microFrontend} name="03 Shadow DOM">
        <MicroFrontendScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: 'from-bottom' })}
        timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE.discovery} name="04 自动发现">
        <DiscoveryScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
      />

      <TransitionSeries.Sequence durationInFrames={SCENE.outro} name="05 收尾">
        <OutroScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
}
