// src/engine/diagnostics.ts —— 控制台诊断(v1.6.52)
//
// 背景:失败明细块(.sl-gh-gstat__note--fails)按用户要求移除后,「为什么这个
// 仓库没统计到」在界面上无处可查 —— 只剩标题里的「(已覆盖/总数 个仓库合并)」。
// 于是把诊断搬进浏览器控制台:一个前缀、一行一件事,能直接看出
//   · token 有没有生效(掩码显示,绝不打印明文)
//   · 每个仓库是「没拉 / 拉失败(什么原因)/ 拉成功」
//   · 没被拉的那些还差多久退避
//   · GitHub 侧的配额余量(响应头,GitHub 已通过 Expose-Headers 放行读取)
//
// 风格:普通信息走 console.log,失败走 console.warn(控制台里一眼能挑出来),
// 与仓库既有惯例一致(如 useGithubShow / renewal 的 console.warn)。

const PREFIX = '[github-show]';

/** token 掩码:只露头尾各 4 位,够认是不是同一枚,又不会泄密。 */
export function maskToken(token: string): string {
  const t = (token ?? '').trim();
  if (!t) return '(未配置)';
  if (t.length <= 12) return '(已配置)';
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

/** 诊断行(普通信息)。 */
export function diag(msg: string, detail?: unknown): void {
  if (detail === undefined) console.log(PREFIX, msg);
  else console.log(PREFIX, msg, detail);
}

/** 诊断行(失败/异常)。 */
export function diagWarn(msg: string, detail?: unknown): void {
  if (detail === undefined) console.warn(PREFIX, msg);
  else console.warn(PREFIX, msg, detail);
}

/** 把毫秒时长说成人话(「5h12m」「28m」「45s」)。 */
export function humanDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60}m`;
}
