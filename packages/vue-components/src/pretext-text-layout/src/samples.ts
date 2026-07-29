import type { SampleText } from './types';

// 多语言样例:刻意混排 CJK / 阿拉伯语 RTL / Emoji —— pretext 的卖点之一就是
// "支持你都没听说过的所有语言"。每段都是若干句完整文本,方便观察断行。
export const SAMPLES: SampleText[] = [
  {
    id: 'mixed',
    label: '混合(招牌)',
    note: '中英 + 阿拉伯语 RTL + Emoji',
    text:
      'Pretext 是一个纯 JavaScript/TypeScript 的多行文本测量与排版引擎。AGI 春天到了. بدأت الرحلة 🚀 它绕开 getBoundingClientRect、offsetHeight 这类会触发重排的 DOM 测量 API,改用浏览器自身的字体引擎作为基准,在 JS 层完成断行与高度计算。这意味着虚拟滚动、聊天气泡、自适应排版这些场景,再也不用偷偷把节点塞进 DOM 去量高度了。',
  },
  {
    id: 'english',
    label: 'English',
    note: 'Latin 拉丁文',
    text:
      'Pretext is a pure JavaScript and TypeScript library for multiline text measurement and layout. It is fast, accurate, and supports all the languages you did not even know about. By side-stepping DOM measurements such as getBoundingClientRect and offsetHeight, which trigger layout reflow, it unlocks proper virtualization without guesstimates and fancy userland layouts like masonry.',
  },
  {
    id: 'cjk',
    label: '中日韩',
    note: 'CJK 无空格断行',
    text:
      '前端开发里,文本布局一直是个让人头疼的问题。尤其是当页面里有大量文字内容时,浏览器需要不断计算每个元素的尺寸和位置,这个过程叫做"布局重排"。每一次你测量一个按钮的文字是否会换行,浏览器都可能重新计算整个页面的布局,这就像你为了检查一个房间的大小,却要重新测量整栋房子一样低效。',
  },
  {
    id: 'arabic',
    label: 'العربية',
    note: '阿拉伯语 RTL 双向混排',
    text:
      'بدأت الرحلة في الصباح الباكر. The journey began at dawn, مروراً بالمدن القديمة والوديان الخضراء. لقد كانت رحلة لا تُنسى مليئة بالذكريات 🌅. Each stop along the way revealed a new story, and every story carried a piece of the land.',
  },
];

export const DEFAULT_SAMPLE_ID = 'mixed';
