# 工作空间邀请邮箱可选(后端已支持) · 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** user-space 「邀请」 tab 让 admin 创建邀请时邮箱可选 —— 填了就投递邮件,不填就生成邀请码由 admin 自行分发。后端契约已支持(`api/group/v1/group.go:142` + `internal/service/group/group.go:395`),只需前端 UX 适配。

**Architecture:** UI 单点改造 —— `Invitations.tsx` 表单去掉邮箱必填 + 成功后展示邀请码 + 加「复制」按钮(没有邮件投递时 admin 必须能取码);store/service 类型不变(`inviteeEmail: string` 已可传空串,后端写 NULL)。

**Tech Stack:** 现有 React + clipboard API(`navigator.clipboard.writeText`,HTTPS/localhost 安全上下文)。无新依赖。

## Global Constraints

- **不动后端**(已支持,见 `api/group/v1/group.go:128,142` 的 description)
- 不改接受邀请流程(`AcceptInvitationArgs`)
- 不改角色选项 / maxUses / ttl 字段
- 复制码用 `navigator.clipboard.writeText`,无 clipboard API 时降级显示 prompt(虽然浏览器基本都有,但 dev 偶发 HTTP 下不可用)
- Conventional Commits;Co-Authored-By trailer
- 在 `fix/gis-runtime-bugs` 分支提交;**不** push 不开 PR
- lint clean;`pnpm exec vitest run` 全过(348 不变)

---

## Task 1: 邀请邮箱可选 + 复制邀请码

**Files:**
- Modify: `packages/react-components/src/user-space/src/pages/Invitations.tsx`(邮箱可选 + 创建成功展示码 + 复制按钮)
- Test: `apps/showcase/__tests__/user-space-store.test.ts`(store 层 `createInvitation` 传空 inviteeEmail 不报错 → 等价测试已存在,加一条空字符串用例即可)

### Step 1: 改 Invitations 表单

`packages/react-components/src/user-space/src/pages/Invitations.tsx`:

- `<input type="email" required>` → `<input type="email">`(去掉 required)
- placeholder 「收件人邮箱」 → 「收件人邮箱(可选,留空则手动分发)」
- submit 函数:删除 `if (!email.trim()) return`;`onCreate({ inviteeEmail: email.trim(), ... })`(`trim()` 后空串照样传,后端会写 NULL)
- 提交按钮 disabled 条件:`disabled={saving}`(去掉 `|| !email.trim()`)

### Step 2: 创建成功展示「待分发」码

`lastCreated` 已有 UI,但目前只显示提示。新增显示邀请码 + 「复制」按钮:

```tsx
{lastCreated && (
  <div className="sl-us-invite-result">
    <div className="sl-us-invite-result__row">
      <span className="sl-us-invite-result__label">邀请码</span>
      <code className="sl-us-invite-result__code">{lastCreated.code}</code>
      <button
        className="sl-us-btn sl-us-btn--sm"
        onClick={() => void copyCode(lastCreated.code)}
      >
        {copied ? '已复制' : '复制'}
      </button>
    </div>
    {!lastCreated.inviteeEmail && (
      <div className="sl-us-invite-result__hint">
        未指定收件人,请手动把邀请码发给对方
      </div>
    )}
  </div>
)}
```

加 state `const [copied, setCopied] = useState(false)` + `copyCode`:

```ts
async function copyCode(code: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  } catch {
    // 降级:老浏览器 / HTTP 下 clipboard API 不可用 → prompt 手动复制
    window.prompt('复制邀请码:', code);
  }
}
```

切组时(`group.id` effect)也要 `setCopied(false)`。

### Step 3: 邀请列表「收件人」列处理空值

`Invitations.tsx` 表格 `<td>{inv.inviteeEmail}</td>`:

```tsx
<td>
  {inv.inviteeEmail
    ? inv.inviteeEmail
    : <span className="sl-us-muted" title="待 admin 分发">—</span>}
</td>
```

### Step 4: CSS 微调

`packages/react-components/src/user-space/index.css` 加:

```css
.sl-us-invite-result {
  margin: 0 20px 16px;
  padding: 12px 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex; flex-direction: column; gap: 6px;
}
.sl-us-invite-result__row { display: flex; align-items: center; gap: 10px; }
.sl-us-invite-result__label { font-size: 11px; color: var(--fg-3); text-transform: uppercase; letter-spacing: 0.05em; }
.sl-us-invite-result__code {
  flex: 1; min-width: 0;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12.5px;
  background: var(--panel);
  padding: 4px 8px;
  border-radius: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sl-us-invite-result__hint { font-size: 11.5px; color: var(--fg-3); }
```

> mobile(≤640px) 媒体查询里把 `.sl-us-invite-result` 的 `margin: 0 12px 16px`(与现有 `.sl-us-table-wrap` 移动 padding 一致)。

### Step 5: store 层测试(可选)

`apps/showcase/__tests__/user-space-store.test.ts` 加(如果不存在):

```ts
it('createInvitation passes empty inviteeEmail without throwing', async () => {
  // stub groupV1Service.createInvitation → 断言调用 args.inviteeEmail === ''
});
```

Step 6: 验证 + commit

```bash
pnpm exec vitest run   # 348 + 0/1 全过
pnpm exec eslint --max-warnings=0 packages/react-components/src/user-space/ apps/showcase/src/api/components/user-space/   # 干净
git add -A
git commit -m "$(cat <<'EOF'
feat(user-space): inviteeEmail optional + copy-code after create

Backend already accepts empty inviteeEmail (writes NULL, skips mail
delivery). Front-end: drop input.required, drop submit gate; after
create show the code with a copy button (navigator.clipboard with
prompt fallback for non-secure contexts); invite list renders muted
"—" for unset recipient. Lets admins create + distribute codes
without picking an email.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

## 不做

- 不改后端(已支持)
- 不改 Roles 选项
- 不动 accept invite 流程
- 不加邀请历史归档 / 复用邀请码(本期不做)
- 不为复制按钮做 toast 通知(改按钮文案 `复制 → 已复制` 已足够反馈)
- 不持久化 copied 态
- 不重写 store 创建邀请的错误处理

## 风险

1. **clipboard API 不可用**(HTTP / 老浏览器) → 降级 `window.prompt` 手动复制。HTTPS / localhost 默认可用
2. **生成邀请但忘记分发** —— `sl-us-invite-result__hint` 提示「未指定收件人,请手动发给对方」
3. **邀请列表空收件人** —— 已 muted「—」+ tooltip 「待 admin 分发」,降低歧义

## 报告

写到 `D:\Users\joke\.claude\projects\D--DevProjects-my-github-ve\task-17-report.md`:
- 状态、改动摘要、commit hash、测试摘要、顾虑

## 返回

状态、commit hash、测试摘要、顾虑。完成后再 `kvcli todo done 17 --result "..."` 回填。