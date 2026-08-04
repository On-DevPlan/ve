// architecture-intro —— 组件顶层入口(glob 唯一扫描目标)。
//
// 职责只有"组合":把 IntroVideo 合成塞进 <Player>,外面套一层适配 showcase
// 主题的外壳(标题栏 + 说明文字)。所有动画逻辑在 src/ 下。
//
// 为什么用 <Player> 而不是 <Composition>:
//   <Composition> 只在 Remotion Studio / CLI 渲染管线里有意义 —— 它是"注册一个
//   可渲染的合成"的声明。本组件跑在 showcase 详情页(一个普通 Vite + React 环境),
//   没有 Studio,需要的是一个能在任意 React 树里播放的播放器,那就是 <Player>。
//
// 注意 CSS side-effect import 必须在最顶部:
//   ReactMountAdapter 的 adoptStylesInto 靠扫描 document.head 的 <style> 把样式
//   克隆进 ShadowRoot;import 晚了会在首帧看到无样式画面。

import './index.css';
import { useRef, type JSX } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { IntroVideo } from './src/IntroVideo';
import { TOTAL_DURATION, VIDEO } from './src/constants';

interface Props {
  /** 是否自动播放,默认 true */
  autoPlay?: boolean;
  /** 是否循环,默认 true */
  loop?: boolean;
}

export default function ArchitectureIntro(props: Props = {}): JSX.Element {
  const autoPlay = props.autoPlay ?? true;
  const loop = props.loop ?? true;

  // Player 句柄。当前 UI 用 Player 自带的 controls,这个 ref 留给后续
  // 想加"跳到第 N 幕"之类的宿主级控制 —— PlayerRef 提供 seekTo()。
  const playerRef = useRef<PlayerRef>(null);

  return (
    <div className="sl-ai-shell">
      <header className="sl-ai-header">
        <div>
          <h2 className="sl-ai-title">项目架构介绍动效</h2>
          <p className="sl-ai-subtitle">
            Remotion 帧驱动合成 · 5 幕 · {VIDEO.width}×{VIDEO.height} · {VIDEO.fps}fps ·{' '}
            {Math.round((TOTAL_DURATION / VIDEO.fps) * 10) / 10}s
          </p>
        </div>
        <span className="sl-ai-badge">@remotion/player</span>
      </header>

      {/* 16:9 容器。Player 用 style.width='100%' 自适应,内部按 compositionWidth
          等比缩放,所以任意容器宽度下画面都不变形。 */}
      <div className="sl-ai-stage">
        <Player
          ref={playerRef}
          component={IntroVideo}
          durationInFrames={TOTAL_DURATION}
          compositionWidth={VIDEO.width}
          compositionHeight={VIDEO.height}
          fps={VIDEO.fps}
          autoPlay={autoPlay}
          loop={loop}
          controls
          doubleClickToFullscreen
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <footer className="sl-ai-footer">
        全程由 <code>useCurrentFrame()</code> + <code>interpolate()</code> 驱动,可逐帧回放;
        场景过渡走 <code>@remotion/transitions</code> 的 <code>fade</code> / <code>slide</code>。
      </footer>
    </div>
  );
}
