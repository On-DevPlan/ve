// src/hooks/useECharts.ts —— 展示视图的 ECharts 生命周期封装。
//
// 按需注册(bar + pie + grid + tooltip + legend + canvas),避免整包体积;
// 组件挂在 ShadowRoot 里,echarts.init 对 shadow 内元素正常工作(china-map 已验证)。
//
// v1.6.3 修复:容器用 callback ref 而非 useRef —— 展示页 tab 在「图表/表格」间切换时,
// 图表容器会卸载再重挂(object ref 不通知 React 再跑 effect);callback ref + el state
// 让 init effect 在容器重新挂载时重跑,否则第二次切换后图表永远空白。

import { useCallback, useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';

echarts.use([BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export function useECharts(option: EChartsCoreOption | null) {
  // 容器节点用 state 存:callback ref 在每次「挂载/卸载/换节点」时都会被 React 调用,
  // el 从 null → 节点 触发 init effect 重跑(el 依赖进 dependency array)
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => setEl(node), []);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!el) return;
    let chart: echarts.ECharts | null = null;
    try {
      chart = echarts.init(el);
    } catch {
      return; // 环境不支持 canvas(如部分测试环境)→ 静默降级,不阻塞展示
    }
    chartRef.current = chart;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => chart.resize()) : null;
    if (ro) ro.observe(el);
    return () => {
      if (ro) ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [el]);

  useEffect(() => {
    if (chartRef.current && option) {
      chartRef.current.setOption(option, true);
    }
  }, [option, el]);

  return { containerRef, chartRef };
}
