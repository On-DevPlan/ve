// src/engine/import-prompts.ts —— TOML 导入相关的提示词常量与生成函数。
//
// FORMAT_PROMPT:给 LLM 的 TOML 格式说明(复制后贴给任意 AI,让它产出合规 TOML)。
// buildGhReposPrompt(opts):按用户选项生成「gh CLI 仓库盘点」提示词,复制后发给
// 本地 agent,由它执行 gh 命令拉取仓库清单并输出合规 TOML,用户回贴到导入弹窗。
//
// 注意:项目风格约束禁止 emoji —— 这些提示词文本会作为 UI 一部分展示/复制,全部纯文字。

export interface GhPromptOptions {
  /** 时间窗(月) */
  months: 3 | 6 | 12 | 24 | 36;
  /** 仓库范围:仅个人 / 个人 + 所属组织 */
  scope: 'mine' | 'mine+orgs';
  /** fork:排除 / 包含 */
  fork: 'exclude' | 'include';
  /** 可见性:全部 / 仅公开 */
  visibility: 'all' | 'public';
}

/** TOML 格式说明 —— 喂给 LLM 用,让它直接产出符合本组件规范的 TOML。 */
export const FORMAT_PROMPT = `你是一个 GitHub 项目数据生成助手。根据用户需求,产出符合以下规范的 TOML,用于导入到 github-show 组件(一个 Notion/Feishu 式的 GitHub 项目展示数据库)。

# === 格式规范 ===
# - 每个 [[projects]] 表示一个项目(GitHub 仓库)
# - 必须写复数 projects,不要写 [[project]] 或 [[repos]] / [[rows]]
# - UTF-8 编码,中文说明无需转义
# - 文件大小不超过 1 MB

# === 字段表 ===
# [[projects]]   类型:表数组   必填:是  说明:一个项目一条
# repo_url       类型:字符串   必填:是  说明:GitHub 仓库链接,如 https://github.com/owner/repo
# name           类型:字符串   必填:否  说明:项目名;留空或省略时,导入时自动从 repo_url 解析为 owner/repo
# highlights     类型:字符串   必填:否  说明:技术亮点 / 成果(开发者自填;不确定时写空字符串 "")
# insights       类型:字符串   必填:否  说明:启发 / 可复用思路(开发者自填;不确定时写空字符串 "")
# output         类型:字符串   必填:否  说明:产出 / 线上地址 / 演示链接(可选,不确定时写 "")
# is_fork        类型:布尔     必填:否  说明:是否 fork 仓库;true / false。导入时仅作提示,不进入数据
# pushed_at      类型:字符串   必填:否  说明:最近推送时间 ISO 8601;导入时忽略,可省略
# <其它任意 key> 类型:字符串   必填:否  说明:自动作为自定义文本列导入,列名 = key。
#                例:visibility = "公开" 会建一个「visibility」列,值为「公开」/「私有」。

# === 字符串转义(TOML 双引号字符串规则) ===
# 在双引号内,这两个字符必须转义:
#   反斜杠 → 写两个反斜杠      引号 → 写 \\"
# 中文、全角标点、emoji 都不需要转义,直接写。

# === 不要这样写 ===
# - 不要写 [[project]](单数)或 [[repos]] / [[rows]] —— 只认 [[projects]]
# - 不要省略 repo_url —— 缺 repo_url 的项目会被整条跳过
# - 不要用单引号字符串 —— 本组件只处理双引号字符串
# - highlights / insights 不确定怎么写时,写空字符串 "",不要编造内容

# === 示例 1:基础(只有必填字段,其余导入时自动补空) ===
[[projects]]
repo_url = "https://github.com/vuejs/core"
name = "vuejs/core"

[[projects]]
repo_url = "https://github.com/vitejs/vite"
name = "vitejs/vite"

# === 示例 2:完整字段 + 自定义列(visibility 自动成为新列) ===
[[projects]]
repo_url = "https://github.com/anthropics/anthropic-sdk-python"
name = "anthropics/anthropic-sdk-python"
highlights = ""
insights = ""
output = ""
is_fork = false
pushed_at = "2026-03-15T10:00:00Z"
visibility = "公开"

[[projects]]
repo_url = "https://github.com/example/private-tool"
name = "example/private-tool"
highlights = ""
insights = ""
output = ""
is_fork = false
pushed_at = "2026-04-02T14:30:00Z"
visibility = "私有"

# === 输出要求 ===
# - 只输出 TOML 文本,不要包裹在 markdown 代码块里(用户复制时不需要三个反引号)
# - 不要写解释、不要写前言,直接第一行就是 [[projects]]`;

/**
 * 生成「gh CLI 仓库盘点」提示词。
 * 用户复制后发给本地 agent(Claude Code / Codex 等),agent 在用户本机执行
 * gh 命令,输出 github-show 可导入的 TOML。
 *
 * gh 命令要点(踩坑规避):
 * - gh repo list 不支持 @me 简写,必须先 gh api user 拿真实 login
 * - --arg 必须写在 --jq 之前(gh 的硬性参数顺序)
 * - date -d 是 GNU 扩展,macOS 的 BSD date 要用 -v
 */
export function buildGhReposPrompt(opts: GhPromptOptions): string {
  const lines: string[] = [];
  lines.push(`你是一个本地命令行助手。请把「最近 ${opts.months} 个月内有推送活动」的 GitHub 仓库整理成 TOML,用于 github-show 组件(Notion 式 GitHub 项目数据库)批量导入。`);
  lines.push('');
  lines.push('# 本次条件');
  lines.push(`- 仓库范围:${opts.scope === 'mine' ? '仅我个人的仓库' : '我的仓库 + 我所属组织的仓库'}`);
  lines.push(`- fork:${opts.fork === 'exclude' ? '排除 fork 仓库' : '包含 fork 仓库(用 is_fork 标注)'}`);
  lines.push(`- 可见性:${opts.visibility === 'all' ? '全部(公开 + 私有)' : '仅公开仓库'}`);
  lines.push('');
  lines.push('# 执行步骤');
  lines.push('1. 运行 `gh auth status` 确认已登录;未登录则提示用户执行 `gh auth login`,并停止任务。');
  lines.push('2. `OWNER=$(gh api user --jq .login)` 取当前用户名。注意 gh repo list 不支持 @me 简写,必须用真实 login。');
  lines.push('3. 计算 cutoff(仓库 pushedAt 是 RFC3339 字符串,可直接字符串比较):');
  lines.push(`   - Linux / Git Bash:  CUTOFF=$(date -u -d "${opts.months} months ago" +%Y-%m-%dT%H:%M:%SZ)`);
  lines.push(`   - macOS (BSD date):  CUTOFF=$(date -u -v${opts.months}m +%Y-%m-%dT%H:%M:%SZ)`);
  lines.push('4. 拉取仓库列表(--arg 必须写在 --jq 之前):');

  const visibilityFlag = opts.visibility === 'public' ? ' --visibility public' : '';
  const forkFilter = opts.fork === 'exclude' ? ' and .isFork == false' : '';
  const jqExpr = `.[] | select(.pushedAt != null and .pushedAt > $cutoff${forkFilter}) | {repo_url: .url, name: .nameWithOwner, is_fork: .isFork, pushed_at: .pushedAt, visibility: .visibility}`;
  const jsonFields = 'nameWithOwner,url,isFork,pushedAt,visibility';

  lines.push(`   gh repo list "$OWNER" --limit 200${visibilityFlag} \\`);
  lines.push(`     --json ${jsonFields} \\`);
  lines.push(`     --jq --arg cutoff "$CUTOFF" \\`);
  lines.push(`     '${jqExpr}'`);
  if (opts.scope === 'mine+orgs') {
    lines.push('   组织仓库逐个拉取后合并:');
    lines.push(`   for ORG in $(gh api user/orgs --jq '.[].login'); do`);
    lines.push(`     gh repo list "$ORG" --limit 200${visibilityFlag} \\`);
    lines.push(`       --json ${jsonFields} \\`);
    lines.push(`       --jq --arg cutoff "$CUTOFF" \\`);
    lines.push(`       '${jqExpr}'`);
    lines.push('   done');
  }
  lines.push('5. 把上一步的输出合并去重,转成下方 TOML:');
  lines.push('   - repo_url 用 .url;name 用 .nameWithOwner');
  lines.push('   - highlights / insights / output 一律写空字符串 ""(占位,用户稍后在表格里自填)');
  lines.push(`   - visibility 按 .visibility 输出「公开」(PUBLIC)或「私有」(PRIVATE / INTERNAL)`);
  if (opts.fork === 'include') {
    lines.push('   - is_fork 用 .isFork 的布尔值;排除 fork 时不写 is_fork 字段');
  }
  lines.push('');
  lines.push('# TOML 格式');
  lines.push('[[projects]]');
  lines.push('repo_url = "https://github.com/owner/repo"');
  lines.push('name = "owner/repo"');
  lines.push('highlights = ""');
  lines.push('insights = ""');
  lines.push('output = ""');
  lines.push('visibility = "公开"');
  if (opts.fork === 'include') {
    lines.push('is_fork = false');
  }
  lines.push('');
  lines.push('# 输出要求');
  lines.push('- 只输出 TOML 文本,不要 markdown 代码块包裹,不要解释、不要写前言');
  lines.push('- 第一行就是 [[projects]];每个仓库一条,按 pushedAt 从新到旧排序');
  return lines.join('\n');
}
