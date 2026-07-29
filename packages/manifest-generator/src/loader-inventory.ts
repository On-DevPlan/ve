// manifest-generator —— 构建期"Loader Inventory"扫描器。
// 对应 docs/architecture/manifest-loader-reconciliation.md §4.1:
//   扫描 packages/{vue,react}-components/src/<id>/ 下的 index.{vue,tsx},
//   返回一条 LoaderEntry —— 这就是运行时 import.meta.glob 会吃到的入口文件集合。
//
// 与 scanner.ts 的差别:
//   - scanner 找的是 component.config.ts(元数据入口)→ 给 manifest 用
//   - 本文件找的是 index.{vue,tsx}(代码入口)→ 给"对账"用
//
// 对账的目的见 reconcile.ts 与 docs/architecture/manifest-loader-reconciliation.md §1。
// 简单说:Manifest 和 Loader 是两套独立发现系统,只在"目录名 === config.id"这个隐含约定上对齐,
// 这里把 Loader 那一侧的真实产物也枚举出来,然后跟 Manifest 比对,在构建期就把不一致阻断。

import fs from 'node:fs/promises'; // 异步 fs API(readdir)
import fsSync from 'node:fs'; // 同步 fs API(existsSync —— 单文件存在性检查足够轻)
import path from 'node:path'; // 路径拼接与解析

// 一条 Loader Inventory 记录。
//   - id:           组件 id,等于目录名(glob key 也是这个)
//   - framework:    从 root 所在包推断;vue-components → 'vue',其它 → 'react'
//   - entryPath:    index.{vue,tsx} 的绝对路径(优先 index.vue)
//   - absolutePath: 同上 + path.resolve,主要用于"对账时打印具体路径"
export interface LoaderEntry {
  id: string;
  framework: 'vue' | 'react';
  entryPath: string;
  absolutePath: string;
}

// 主入口:扫描每个 root 下的子目录,挑出有 index.{vue,tsx} 的那些。
//   - root 形如 '/abs/path/to/packages/vue-components/src'
//   - 遍历 root/<subdir>/index.{vue,tsx},优先 index.vue
//   - 不存在的 root 静默跳过(watcher 还没准备好 / 临时 IO 错误都不应该崩)
//   - 没有 index 文件的子目录也静默跳过(可能是子目录、测试夹具、其他用途)
//
// framework 推断用 path.normalize + includes('vue-components') 字符串匹配:
// 仓库只有 vue-components / react-components 两个包,这种最简的字符串匹配即可,
// 避免引入额外的 package 元数据配置。
export async function buildLoaderInventory(roots: string[]): Promise<LoaderEntry[]> {
  const entries: LoaderEntry[] = [];
  for (const root of roots) {
    // root 不存在时静默跳过 —— watcher 第一次跑、目录被临时重命名、CI 跨平台路径差异都属此类
    let dirents;
    try {
      dirents = await fs.readdir(root, { withFileTypes: true });
    } catch {
      // ENOENT / EACCES 等都归类为"暂时不可用",不抛错
      continue;
    }
    // framework 推断:root 含 'vue-components' 子串 → 'vue',否则 → 'react'
    // 这里用 normalized path 是为了避免 Windows 下大小写/反斜杠差异导致漏判
    const normalizedRoot = path.normalize(root).replace(/\\/g, '/');
    const framework: 'vue' | 'react' = normalizedRoot.includes('vue-components') ? 'vue' : 'react';
    for (const dir of dirents) {
      // 只看直接子目录(component 都是 packages/{vue,react}-components/src/<id>/ 这种一层结构)
      if (!dir.isDirectory()) continue;
      const subdir = path.join(root, dir.name);
      // index.vue 优先(Vue 组件主入口);React 组件走 index.tsx
      const vueEntry = path.join(subdir, 'index.vue');
      const tsxEntry = path.join(subdir, 'index.tsx');
      // 用 existsSync 而不是 readdir —— readdir 还要再深入一层,existsSync 一步到位
      // 同步开销可忽略(单文件 + 子目录数量有限),避免把整个循环变成 await 链
      let entryPath: string | null = null;
      if (fsSync.existsSync(vueEntry)) entryPath = vueEntry;
      else if (fsSync.existsSync(tsxEntry)) entryPath = tsxEntry;
      // 没有 entry 文件 → 跳过(可能是测试夹具、嵌套子目录、过渡期文件)
      if (!entryPath) continue;
      entries.push({
        id: dir.name,
        framework,
        entryPath,
        absolutePath: path.resolve(entryPath),
      });
    }
  }
  return entries;
}