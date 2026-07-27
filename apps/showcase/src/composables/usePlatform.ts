// composables/usePlatform.ts —— 检测当前设备平台(PC / 手机端)。
//
// 职责:
//   1) 通过 UA + 屏幕宽度判断当前设备是 mobile 还是 pc
//   2) 暴露 Platform 响应式 ref(模块级单例),给 SearchIndex / HomePage 做平台过滤
//   3) 窗口 resize 超过阈值时自动切换(平板折叠屏场景)
//   4) 支持手动切换(PC 上调试 mobile 视图)
//
// 检测策略:
//   - 先匹配 UA 中的移动端关键词(Android / iPhone / iPad / Mobile 等)
//   - 再匹配屏幕宽度(<= 768px 视为手机端)
//   - UA 匹配优先于宽度,因为用户代理比 CSS 像素更可靠地反映设备类型
//
// 设计要点:
//   - 模块级单例 ref —— 确保 main.ts 和 HomePage 拿到同一个 platform 信号,
//     一次切换全局生效
//   - resize 监听器永不清除(与应用同生命周期),不构成泄漏。

import { ref } from 'vue';
import type { Platform } from '@style-library/component-contract';

// UA 正则:识别常见移动端用户代理
const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;

// 屏幕宽度阈值:<= 768px 视为手机端
const MOBILE_WIDTH_THRESHOLD = 768;

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isMobileByUA = MOBILE_UA.test(ua);
  const isMobileByWidth = window.innerWidth <= MOBILE_WIDTH_THRESHOLD;
  return isMobileByUA || isMobileByWidth ? 'mobile' : 'pc';
}

// 模块级单例 ref —— 保证全应用共享同一 platform 信号
const platform = ref<Platform>(detectPlatform());

// 立刻挂载 resize 监听(模块加载时),不需要等 Vue 生命周期
window.addEventListener('resize', () => {
  platform.value = detectPlatform();
});

export function usePlatform() {
  return { platform };
}

export type UsePlatformReturn = ReturnType<typeof usePlatform>;
