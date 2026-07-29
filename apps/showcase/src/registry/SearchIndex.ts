// registry/SearchIndex.ts —— 组件清单的纯前端搜索/过滤索引。
//
// 职责:
//   1) 接受外部 entries ref(由 ComponentRegistry 提供)
//   2) 暴露 query(关键词)与 group(分组)两个响应式输入
//   3) computed results 自动随输入变化,无副作用
//   4) 接受 platform ref 做平台过滤(PC / 手机端)
//
// 设计要点:
//   - 不维护自己的数据副本,直接复用 registry 的 entries,避免双源
//   - group 与 query 同时生效:先 group 后 query,语义清晰
//   - 大小写不敏感;中文按字面包含匹配(不切词,简单够用)
//   - 搜索字段:title / description / tags / group / category 全都纳入
//   - platform 过滤:传入 platform ref,自动过滤只显示匹配当前平台的组件;
//     不传 platform 则保持向后兼容(显示全部)

import type { ManifestEntry, Platform } from '@style-library/component-contract';
import { ref, computed, type Ref } from 'vue';

// 工厂签名:接受外部 entries ref(只读) + 可选的 platform ref
export function createSearchIndex(
  entries: Ref<readonly ManifestEntry[]>,
  platform?: Ref<Platform>,
) {
  // 搜索关键词 —— 空字符串表示"全部"
  const query = ref('');
  // 分组过滤 —— undefined 表示"不按 group 过滤"
  const group = ref<string | undefined>(undefined);

  // computed —— 输入变化时自动重算;Vue 内部会缓存相同输入的结果
  const results = computed(() => {
    // trim + 小写,空串短路返回全部
    const q = query.value.trim().toLowerCase();
    // 复制为可变数组后 filter —— 直接对 readonly 调 filter 在某些类型下会报错
    return [...entries.value].filter((e) => {
      // 0) platform 过滤:pc 端只看 pc/both,mobile 端只看 mobile/both
      if (platform) {
        const p = platform.value;
        if (p === 'pc' && e.platform === 'mobile') return false;
        if (p === 'mobile' && e.platform === 'pc') return false;
      }
      // 1) group 过滤:不匹配直接淘汰
      if (group.value && e.group !== group.value) return false;
      // 2) 关键词为空,放行(已经被 group 过滤过)
      if (!q) return true;
      // 3) 把 title / description / tags / group / category 拼成 haystack
      //    然后做大小写不敏感的子串匹配
      const hay = [e.title, e.description, ...e.tags, e.group, e.category]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  });

  return { query, group, results };
}

// 工厂返回类型别名 —— 让 composable / 测试可以显式声明,不必每次手写结构
export type SearchIndexReturn = ReturnType<typeof createSearchIndex>;
