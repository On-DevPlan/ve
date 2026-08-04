// architecture-intro 组件的 config(对应 spec §4.1 ComponentConfig)。
//
// 这是一个 Remotion 驱动的项目原理介绍动效:
//   - 用 @remotion/player 在详情页内嵌一段 16s / 1920x1080 / 30fps 的合成
//   - 5 幕场景(标题 / 架构 / 跨框架隔离 / 自动发现 / 收尾)由 TransitionSeries 串联
//   - 全部动画由 useCurrentFrame() + interpolate() 帧驱动,不用 CSS transition/animation
//     (CSS 动画在 Remotion 渲染管线里不会被采样,只有帧驱动的值才可复现)
//
// 注释约定:
//   - id / name 与目录名一致,manifest 扫描器按 id 索引
//   - route.path 必须以 /components/ 开头且末段 == id(见 eslint rules/valid-component-config.js)
//   - mount.kind = 'react' → 详情页用 ReactMountAdapter 挂载
//   - isolation.mode = 'shadow-dom':Player 是一个受控尺寸的普通 DOM 子树,
//     没有 window 级副作用,默认隔离即可(与 html-light / gaussian-splat-viewer 不同)
//   - platform = 'pc':16:9 视频 + 时间轴控件在窄屏上信息密度不可读

import type { ComponentConfig } from '@style-library/component-contract';

export default {
  id: 'architecture-intro',
  name: 'ArchitectureIntro',
  title: '项目架构介绍动效',
  description:
    '基于 Remotion 的项目原理介绍动效:5 幕场景 + 粒子背景 + 架构连线 + 场景过渡,全程帧驱动可逐帧回放,远超传统 PPT。',
  version: '1.0.0',
  framework: 'react',
  entry: './index.tsx',
  group: '数据可视化',
  category: '动效',
  tags: ['remotion', 'animation', 'intro', 'architecture', 'player', 'motion-graphics'],
  platform: 'pc',
  status: 'experimental',
  route: { path: '/components/architecture-intro', title: '项目架构介绍动效' },
  mount: { kind: 'react', propsMode: 'default' },
  isolation: { mode: 'shadow-dom' },
  theme: { mode: 'css-variables', namespace: 'sl' },
  capabilities: { resizable: true, fullscreen: true, fullscreenMode: 'container' },
  dependencies: [
    { name: 'remotion', version: '^4.0.505', sharing: 'component' },
    { name: '@remotion/player', version: '^4.0.505', sharing: 'component' },
    { name: '@remotion/transitions', version: '^4.0.505', sharing: 'component' },
  ],
} satisfies ComponentConfig;
