// gen-nginx.mjs —— 把各组件 component.config.ts 的 `api` 声明生成为 nginx
// location 片段。Docker stage 1(builder)在 `pnpm run build` 之后调用。
//
// 这是"dev / prod 共用同一张路由表"闭环的 prod 侧 CLI:
//   dev  → vite.config.ts 调 scanConfigs → mfeDynamicProxy(http-proxy 中间件)
//   prod → 本脚本调 scanConfigs → emitNginxLocations(nginx 配置片段)
// 两条路径扫的是同一批文件、走的是同一个 normalizeApi(),所以不会出现
// "本地能跑、上线 404"。
//
// 本文件刻意保持成薄壳:扫描 + 写盘。所有规则(冲突检测、尾斜杠语义、^~
// 优先级、环境隔离)都在 packages/manifest-generator/src/nginx-emit.ts 里,
// 那儿有单测覆盖(__tests__/nginx-emit.test.ts)。
//
// 用法:
//   node --experimental-strip-types scripts/gen-nginx.mjs [--env prod|dev] [--out <path>]
// 默认:--env prod --out nginx/api-locations/generated.conf
//
// 必须带 --experimental-strip-types:scanConfigs 会动态 import 各组件的
// component.config.ts,Node 需要开启类型剥离才能直接吃 .ts。
// 走相对路径 import 而非包名 `@style-library/manifest-generator`:根 package
// 没有 workspace 依赖链接(node_modules/@style-library 不存在),而相对路径
// 的嵌套依赖解析是相对被导入文件的,manifest-generator 自己的 node_modules
// 里有 component-contract / fast-glob,所以能正常解析。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanConfigs } from '../packages/manifest-generator/src/scanner.ts';
import { emitNginxLocations } from '../packages/manifest-generator/src/nginx-emit.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// 与 apps/showcase/vite.config.ts 的 COMPONENT_ROOTS 保持一致。
// 两处都硬编码同一组 glob 是已知的小重复;真要收敛应该提到 workspace 级
// 共享常量,但那是独立的重构,不该塞进这次改动。
const COMPONENT_ROOTS = [
  path.resolve(repoRoot, 'packages/vue-components/src/*/component.config.ts'),
  path.resolve(repoRoot, 'packages/react-components/src/*/component.config.ts'),
];

function parseArgs(argv) {
  const args = { env: 'prod', out: 'nginx/api-locations/generated.conf' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--env') args.env = argv[i + 1];
    if (argv[i] === '--out') args.out = argv[i + 1];
  }
  if (args.env !== 'prod' && args.env !== 'dev') {
    throw new Error(`--env must be "prod" or "dev", got "${args.env}"`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const scanned = await scanConfigs({ roots: COMPONENT_ROOTS });
  const configs = scanned.map((s) => s.config);

  // buildId 用 CI 提供的 git sha,便于从生成的 conf 反查是哪次构建的产物。
  // 本地手跑时没有这个环境变量,退化成 'local'。
  const buildId = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

  // 任何冲突 / 缺 prod target / 非法 context 都会在这里抛出 —— 构建期中断,
  // 而不是生成一份语法合法但路由错误的配置推到线上。
  const content = emitNginxLocations(configs, { env: args.env, buildId });

  const outPath = path.resolve(repoRoot, args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, 'utf-8');

  const count = (content.match(/^location /gm) ?? []).length;
  console.log(`[gen-nginx] scanned ${configs.length} components, emitted ${count} location block(s)`);
  console.log(`[gen-nginx] env=${args.env} buildId=${buildId} → ${path.relative(repoRoot, outPath)}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
