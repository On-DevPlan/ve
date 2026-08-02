// nginx-emit.ts —— 从 ComponentConfig.api 生成 nginx location 片段。
//
// 这是"dev / prod 共用同一张路由表"的 prod 侧出口:
//   dev  → mfeDynamicProxy 读 api 字段 → http-proxy 中间件
//   prod → 本文件读**同一份** api 字段 → nginx location 片段
// 两侧共用 normalizeApi(),所以对 `api` 的解释不可能漂移。
//
// 为什么放在 manifest-generator 而不是 scripts/:
//   1) 这里能直接复用 normalizeApi / resolveTarget,不必跨包重实现
//   2) 本包的 vitest project include 是 __tests__/**/*.test.ts,纯函数好单测;
//      scripts/ 那个 project 只收 .js/.mjs
//   3) scripts/gen-nginx.mjs 保持成薄 CLI(扫描 → 调用本函数 → 写文件)
//
// 纯函数:不碰文件系统,输入 configs 输出字符串。副作用全留给 CLI。

import type { ComponentConfig } from '@style-library/component-contract';
import { normalizeApi, resolveTarget } from './mfe-dynamic-proxy.ts';

export interface EmitNginxOptions {
  /** 取哪个环境的 target。生成生产配置时传 'prod'。 */
  env: 'dev' | 'prod';
  /** 写进产物头部的溯源信息(通常是 git sha 或构建时间)。 */
  buildId?: string;
}

/** 一条已解析的 location,供冲突检测与渲染共用。 */
interface ResolvedLocation {
  context: string;
  target: string;
  changeOrigin: boolean;
  ws: boolean;
  /** 声明它的组件 id —— 冲突报错时要指名道姓 */
  componentId: string;
}

/**
 * nginx location 前缀的合法性校验。
 *
 * 必须以 / 开头:nginx 前缀匹配就是拿 URI 做字面前缀比较,不以 / 开头的
 * context(比如 'api')永远匹配不上任何请求路径,是静默失效 —— 构建期拦掉。
 *
 * 拒绝空白与 { } ; 换行:这些字符能提前闭合 location 块,把任意指令注入到
 * 生成的配置里。component.config.ts 虽是仓库内可信来源,但生成配置的代码
 * 不该假设输入可信 —— 一个手滑的 context 不该变成 nginx 配置注入。
 */
function assertValidContext(context: string, componentId: string): void {
  if (!context.startsWith('/')) {
    throw new Error(
      `[gen-nginx] component "${componentId}" declares context "${context}" which does not start with "/". ` +
        `nginx prefix locations must be absolute paths.`,
    );
  }
  if (/[\s{};]/.test(context)) {
    throw new Error(
      `[gen-nginx] component "${componentId}" declares context "${context}" containing whitespace or one of {};. ` +
        `These characters would break out of the generated location block.`,
    );
  }
}

/**
 * 归一 context 供 nginx 使用:去掉尾部斜杠。
 *
 * 作者可能写 '/api' 也可能写 '/api/'。dev 侧用 startsWith 两者都能工作,
 * 但渲染时我们统一补一个尾斜杠(见 renderLocation),不先剥掉的话 '/api/'
 * 会渲染成 'location ^~ /api//' —— 双斜杠永不匹配,又是一个静默失效。
 */
function nginxContext(context: string): string {
  return context.replace(/\/+$/, '');
}

/**
 * 把 configs 摊平成 location 列表,并做冲突检测。
 *
 * 冲突语义:同一个 context 被两个组件声明成**不同 target**。
 * dev 环境靠 activeId 消歧(同时只有一个组件活跃,见 mfe-dynamic-proxy 的设计
 * 注释:"天然支持多组件声明同一 path 不同 target")。nginx 没有"当前激活组件"
 * 这个概念,同名 location 无法共存 —— 所以这里必须构建期报错中断,而不是
 * 让后写的静默覆盖先写的、生成一份看起来正常实则错误的配置。
 *
 * 同 context 同 target 则是良性重复(两个组件共用一个后端),去重即可。
 */
function collectLocations(configs: ComponentConfig[], env: 'dev' | 'prod'): ResolvedLocation[] {
  const byContext = new Map<string, ResolvedLocation>();

  for (const config of configs) {
    for (const rule of normalizeApi(config.api)) {
      assertValidContext(rule.context, config.id);
      const target = resolveTarget(rule.target, env, `${config.id} → ${rule.context}`);
      const resolved: ResolvedLocation = {
        context: nginxContext(rule.context),
        // proxy_pass 尾斜杠会改变语义(剥掉 location 前缀),这里统一剥掉作者
        // 可能手写的尾斜杠,渲染时保证不带 —— 见 renderLocation 的注释。
        target: target.replace(/\/+$/, ''),
        changeOrigin: rule.changeOrigin ?? true,
        ws: rule.ws ?? false,
        componentId: config.id,
      };

      const existing = byContext.get(resolved.context);
      if (existing && existing.target !== resolved.target) {
        throw new Error(
          `[gen-nginx] location conflict on context "${resolved.context}":\n` +
            `  ${existing.componentId} → ${existing.target}\n` +
            `  ${resolved.componentId} → ${resolved.target}\n` +
            `nginx cannot disambiguate by component (dev uses activeId; prod has no such notion).\n` +
            `Give each backend a non-overlapping context, e.g. "/api/${resolved.componentId}".`,
        );
      }
      if (!existing) byContext.set(resolved.context, resolved);
    }
  }

  // 最长前缀优先:与 dev dispatcher 的排序规则一致(见 mfe-dynamic-proxy)。
  // nginx 自己会挑最长匹配的前缀 location,所以这里排序纯粹是为了产物可读 ——
  // 让更具体的规则排在前面,人读 diff 时顺序稳定。
  return [...byContext.values()].sort((a, b) => b.context.length - a.context.length);
}

/**
 * rewrite 规则在 nginx 侧不做自动翻译。
 *
 * ApiRule.rewrite 可以是函数(无法序列化成 nginx 指令),也可以是 JS 正则字面量
 * (语法与 PCRE 有差异,自动翻译容易出既不报错也不正确的配置)。与其冒险生成
 * 一份"看着对但行为不同"的 rewrite,不如构建期显式拒绝,逼作者手写。
 */
function assertNoRewrite(loc: ResolvedLocation, configs: ComponentConfig[]): void {
  const config = configs.find((c) => c.id === loc.componentId);
  // loc.context 已被 nginxContext() 归一化,原始声明可能带尾斜杠 —— 比较时
  // 两边都归一化,否则写 '/api/' 的组件会绕过这个检查。
  const rule =
    config && normalizeApi(config.api).find((r) => nginxContext(r.context) === loc.context);
  if (rule?.rewrite) {
    throw new Error(
      `[gen-nginx] component "${loc.componentId}" declares rewrite on context "${loc.context}". ` +
        `Rewrite rules are not auto-translated to nginx (JS regex semantics differ from PCRE, ` +
        `and function-form rewrites cannot be serialized). ` +
        `Either drop the rewrite and align the backend path, or hand-write this location in default.conf.`,
    );
  }
}

/** 渲染单条 location。 */
function renderLocation(loc: ResolvedLocation): string {
  const lines: string[] = [];
  lines.push(`# ${loc.componentId} —— declared in its component.config.ts`);
  // ^~ 而非普通前缀:nginx 优先级是 = > ^~ > 正则 > 普通前缀。default.conf 里
  // 的 `location ~* \.(js|css|png|...)$` 是正则,会**赢过**普通前缀 —— 那样
  // /api/foo.svg 之类的请求会被静默当成静态资源处理。^~ 一次性锁死这个隐患。
  lines.push(`location ^~ ${loc.context}/ {`);
  // proxy_pass 结尾**不能**有斜杠:带斜杠时 nginx 会剥掉 location 前缀
  // (/api/v1/user/login → /v1/user/login,后端 404);不带斜杠才透传原始 URI。
  lines.push(`    proxy_pass ${loc.target};`);
  if (loc.changeOrigin) {
    // 等价于 http-proxy 的 changeOrigin: true —— 让后端看到自己的 host
    lines.push(`    proxy_set_header Host $proxy_host;`);
  } else {
    lines.push(`    proxy_set_header Host $host;`);
  }
  lines.push(`    proxy_set_header X-Real-IP $remote_addr;`);
  lines.push(`    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`);
  lines.push(`    proxy_set_header X-Forwarded-Proto $scheme;`);
  if (loc.ws) {
    // WebSocket upgrade 需要 HTTP/1.1 + 显式转发 Upgrade/Connection 头
    lines.push(`    proxy_http_version 1.1;`);
    lines.push(`    proxy_set_header Upgrade $http_upgrade;`);
    lines.push(`    proxy_set_header Connection "upgrade";`);
  }
  lines.push(`}`);
  return lines.join('\n');
}

/**
 * 主入口:configs → nginx location 片段字符串。
 *
 * 产物由 default.conf 在 server{} 内部 include。注意**不能**直接放进
 * conf.d/ —— 那个目录是在 http{} 层被 include 的,裸 location 在那儿是语法
 * 错误,nginx 会起不来。
 *
 * 没有任何组件声明 api 时返回纯注释(而非空串),这样产物文件始终存在、
 * include 通配符始终有东西可读,也让"确实没有 api 声明"和"生成器没跑"
 * 在产物上可区分。
 */
export function emitNginxLocations(
  configs: ComponentConfig[],
  opts: EmitNginxOptions,
): string {
  const locations = collectLocations(configs, opts.env);
  for (const loc of locations) assertNoRewrite(loc, configs);

  const header = [
    `# GENERATED FILE —— DO NOT EDIT BY HAND.`,
    `# Source of truth: each component's component.config.ts \`api\` field.`,
    `# Generator: scripts/gen-nginx.mjs (packages/manifest-generator/src/nginx-emit.ts)`,
    `# env=${opts.env}${opts.buildId ? ` buildId=${opts.buildId}` : ''}`,
    `#`,
    `# Included from default.conf inside server{}. Do not drop this into conf.d/ ——`,
    `# that directory is included at http{} level where bare location blocks are a`,
    `# syntax error.`,
  ].join('\n');

  if (locations.length === 0) {
    return `${header}\n#\n# No component declares an \`api\` field. Nothing to proxy.\n`;
  }

  return `${header}\n\n${locations.map(renderLocation).join('\n\n')}\n`;
}
