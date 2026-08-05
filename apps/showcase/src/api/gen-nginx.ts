// api/gen-nginx.ts —— registry → nginx location 片段(prod 路径,SPEC §6)。
//
// 调用方:
//   - `pnpm --filter @style-library/showcase gen:nginx` 输出到
//     nginx/api-locations/generated.conf
//   - Docker builder 阶段同样;`RUN pnpm gen:nginx && nginx -t` 必须过
//
// 三个不能省的 nginx 细节:
//   1) `location ^~` 而非普通前缀,否则 default.conf 的 static 正则会赢过
//   2) `proxy_pass` 不带尾斜杠,否则 nginx 会剥 location 前缀导致后端 404
//   3) 产物放独立目录,由 default.conf 在 server{} 内 include,不能丢 conf.d/
//
// 路径形态**不在本文件决定**:context 直接用 normalize.normalizeApi 的输出
// (以 / 开头、无尾斜杠),与 dev 侧 matchesContext 的判定语义一致。
//   曾经这里渲染 `location ^~ ${context}/`(硬补尾斜杠),与 dev 的
//   `url === ctx || startsWith(ctx + '/')` 分叉 —— POST /api/v1/kv 在 dev
//   命中、在 prod 落到 try_files → index.html → 405。
//   nginx 前缀匹配天然覆盖 <context> 自身与 <context>/... 两种形态,
//   所以不补斜杠才是与 dev 一致的写法。
//
// 冲突检测:
//   dev 靠 registry 的启动期校验;这里再查一遍(生成端独立成立)。
//   nginx 没有"当前激活组件"概念,同名 location 无法共存 → 必 fail-fast。

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRegistry } from './registry';
import { normalizeApi } from './normalize';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface GenNginxOptions {
  /** 输出目录,默认 <repo-root>/nginx/api-locations/ */
  outDir?: string;
  /** 输出文件,默认 generated.conf */
  outFile?: string;
  /** 把每条 backend → target 打到 stdout */
  verbose?: boolean;
}

export function genNginxOut(opts: GenNginxOptions = {}): string {
  const registry = getRegistry();
  const blocks: string[] = [];
  const seenContext = new Set<string>();

  for (const [id, backend] of Object.entries(registry)) {
    const rule = normalizeApi(backend, /* isProd */ true, id);
    if (seenContext.has(rule.context)) {
      throw new Error(
        `[api/gen-nginx] duplicate location on "${rule.context}". ` +
          `nginx cannot disambiguate by backend (dev has no such notion either since ` +
          `each context maps to exactly one target). Give each backend a ` +
          `non-overlapping route.`,
      );
    }
    seenContext.add(rule.context);

    blocks.push(renderLocationBlock(id, rule.context, rule.target));
    if (opts.verbose) {
      console.log(`[gen-nginx] ${id}: ${rule.context} → ${rule.target}`);
    }
  }

  const outDir = opts.outDir ?? resolve(__dirname, '../../../../nginx/api-locations');
  const outFile = opts.outFile ?? resolve(outDir, 'generated.conf');

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, blocks.join('\n\n') + '\n', 'utf8');
  return outFile;
}

/**
 * 渲染单条 location 块。
 *
 * context 已由 normalize 保证「以 / 开头、无尾斜杠」;这里只做注入防御,
 * 不再做形态转换 —— 形态决策全在 normalize.ts。
 */
function renderLocationBlock(backendId: string, context: string, target: string): string {
  // 注入防御:空白与 {}; 能提前闭合 location 块,把任意指令注进生成的配置。
  // registry 虽是仓库内可信来源,但生成配置的代码不该假设输入可信。
  if (/[\s{};]/.test(context)) {
    throw new Error(
      `[api/gen-nginx] backend "${backendId}" context "${context}" contains whitespace ` +
        `or one of {}; — these would break out of the generated location block`,
    );
  }

  return [
    `# ${backendId} —— generated from apps/showcase/src/api/registry.ts`,
    // ^~ 而非普通前缀:nginx 优先级 = > ^~ > 正则 > 普通前缀。default.conf 的
    // `location ~* \.(js|css|png...)$` 是正则,会赢过普通前缀。
    // 不带尾斜杠:与 dev 侧 matchesContext 语义一致(见文件头注释)。
    `location ^~ ${context} {`,
    // proxy_pass 结尾不带斜杠:带 / 时 nginx 剥掉 location 前缀
    // (/api/v1/kv/shortcuts → /shortcuts,后端 404)。target 的尾斜杠已由
    // normalize.resolveTarget 剥除。
    `    proxy_pass ${target};`,
    `    proxy_set_header Host $proxy_host;`,
    `    proxy_set_header X-Real-IP $remote_addr;`,
    `    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`,
    `    proxy_set_header X-Forwarded-Proto $scheme;`,
    `}`,
  ].join('\n');
}

// ───── CLI 入口(tsx 直接跑) ────────────────────────────────
const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  try {
    const out = genNginxOut({ verbose: true });
    console.log(`[gen-nginx] wrote ${out}`);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}