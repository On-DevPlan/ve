// manifest-generator —— 构建期"组件配置扫描器"。
// 对应 spec §6.1 manifest 生成流水线:
//   scanner 扫描 packages/{vue,react}-components/**/component.config.ts →
//   validator 校验字段(由 validateConfig 完成)→
//   resolver / generator 见 generator.ts。
//
// 本文件只负责"找到 + 加载 + 校验",不负责去重与拼装 manifest。

import fg from 'fast-glob'; // glob 匹配,跨平台且比 node-glob 更轻
import path from 'node:path'; // 仅用于取 dirname
import { pathToFileURL } from 'node:url'; // Windows 下把文件路径转 file:// URL 才能动态 import
// 类型与运行时校验函数都从 component-contract 拿
import type { ComponentConfig } from '@style-library/component-contract';
import { validateConfig } from '@style-library/component-contract';

// 扫描结果的一条记录
//   - filePath: component.config.ts 的绝对路径
//   - configDir: 该文件所在目录(下游 generator 会用来推断 assets)
//   - config:   经过 schema 校验的 ComponentConfig
export interface ScannedConfig {
  filePath: string;
  configDir: string;
  config: ComponentConfig;
}

// 扫描选项
//   - roots: glob 模式数组,例如 ['packages/vue-components/**/component.config.ts']
//   - cwd:   glob 的工作目录,默认 process.cwd()
export interface ScanOptions {
  roots: string[];
  cwd?: string;
}

// 主入口:扫描 → 动态 import → schema 校验 → 返回数组
export async function scanConfigs(opts: ScanOptions): Promise<ScannedConfig[]> {
  const cwd = opts.cwd ?? process.cwd();
  // fast-glob 在 Windows 上要求 forward-slash 风格(pattern 里的 \ 被当作转义),
  // 作者可能用 path.join 拼出反斜杠路径,我们统一规范成 POSIX 分隔符。
  const patterns = opts.roots.map((r) => r.replace(/\\/g, '/'));
  const files = await fg(patterns, { cwd, absolute: true });
  const out: ScannedConfig[] = [];
  for (const filePath of files) {
    // 动态 import 一个 .ts 文件:
    //   Node 22 在 experimental-strip-types 下能直接吃 .ts;这里走 ESM 默认行为
    //   pathToFileURL 是为了 Windows:路径里的空格/中文/反斜杠都不能直接给 import()
    const mod = await import(/* @vite-ignore */ pathToFileURL(filePath).href);
    // component.config.ts 必须 default export 一个 config 对象
    const config = mod.default as ComponentConfig;
    // ajv 校验 schema;失败直接抛错(构建期阻断)
    const v = validateConfig(config);
    if (!v.ok) {
      throw new Error(`Invalid config at ${filePath}: ${JSON.stringify(v.errors)}`);
    }
    out.push({
      filePath,
      configDir: path.dirname(filePath),
      config,
    });
  }
  return out;
}