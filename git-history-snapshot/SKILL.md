---
name: git-history-snapshot
description: 当用户想把 git 历史的每个 commit 改写成"只含一条 commit-msg.txt"，用于归档、瘦身、或时间线保留时触发。触发场景："把每个 commit 改成提交说明 txt"、"重写历史给 git 瘦身"、"保留时间重写 commit"、"git 瘦身"、"commit 信息变成 txt"。也用于诊断 pack 中巨型 blob。执行模式：本地 dry-run/正式 run，不 push。
metadata:
  type: skill
  category: git
  parent: key_board_3
---

# Git History Snapshot

把 git 历史 commit 改写成"**每个 commit 的 tree 只含一条 `<short_sha>__<subject>.commit-msg.txt`**"，author / author-date / committer-date / message 全部原样保留。

这是 plumbing 级操作，不是 rebase、不是 amend、不是 filter-branch。改写后**配合 `git reflog expire --expire=now --all && git gc --prune=now --aggressive`**，可以让 `.git` 真正瘦下来。

## 两个核心场景（按需加载 ref）

| ref | 何时读取 | 路径 |
| --- | --- | --- |
| [[replay-append]] | 用户说"**追加**新 commit 让每个原 commit 后面跟一条 txt"。适合：保留所有原 ref、可观察、但会让 pack 增长 | references/replay-append.md |
| [[rewrite-history]] | 用户说"**重写**历史 commit 让 .git 瘦身" / "保留时间重写"。适合：愿意丢弃其它 ref、让仓库真正变小 | references/rewrite-history.md |
| [[inspect-pack]] | 瘦身后想验证 / 想知道 pack 中巨型 blob 是哪些文件 | references/inspect-pack.md |

## 公共前置（必读，无论哪个 ref）

### 1. 编码

Windows 默认 GBK，git 的 commit message 经常含 UTF-8 → 子进程必须强制 `encoding="utf-8"` + `errors="replace"`，并设置：

```python
env["PYTHONIOENCODING"] = "utf-8"
env["LC_ALL"] = "C.UTF-8"
env["LANG"] = "C.UTF-8"
```

否则 `UnicodeDecodeError` 会让脚本半路崩溃、留下 index.lock、留下半成品 commit。

### 2. .gitignore 不要 self-block

如果 `.gitignore` 已经包含 `.commit-msgs/` 或 `/.commit-msgs/`（不管是谁写的），`git add` 会拒绝。

**处理**：在脚本入口清理这一行（匹配 `^\s*(\/?\.commit-msgs\/?)\s*$`，包含 `!` 否定规则保留）。脚本内的 `ensure_gitignore_unignore(root, msg_dir)` 就是这个工具函数。

### 3. 中断恢复

Python 子进程被打断时可能留 `index.lock`。下次启动前：

```powershell
Remove-Item -Force .git/index.lock -ErrorAction SilentlyContinue
```

### 4. `assert_clean` 在多步骤脚本里是陷阱

**不要**在每一步 commit 后都 `git status --porcelain` 检查；如果上一条 commit 留下的"modified"恰好是你下一步要 stage 的文件，干净检查会卡死。改成在**脚本启动时**校验一次，过程中不重复校验。

### 5. NEVER_PUSH

脚本里必须有 `NEVER_PUSH = True` 常量 + message 里显式声明 `NEVER_PUSH:{NEVER_PUSH}`。**不调用任何 push 命令**。如果你要推，让用户自己 `git push`。

### 6. 工作区漂移

如果 `git status` 显示一大堆 `A`（实际工作区存在的文件但 HEAD tree 没有），说明 **HEAD 之前那一次 commit 的 tree 是 stale 的**。在这种情况下 `git commit -a` 会把所有这些文件塞进新 commit，可能让 .git 重新膨胀。

**先回答自己**：HEAD 的 tree 应该是什么？如果是"快照"，tree 应该只含 1 个 `.commit-msgs/SNAPSHOT.txt`；如果工作区有几万个 `A`，说明上次 commit 写错了 tree，需要先决定是"丢弃这些 A"还是"把它们当新 commit 内容"。

## 反模式（不这样做）

| 反模式 | 后果 |
| --- | --- |
| 每条 commit 都重写一份 `_history.json` | pack 不能 dedup，仓库反而变大 |
| commit message 用 `now()` 而不是原 commit 时间 | "保留时间"诉求失败 |
| `--amend` / `reset --hard` / `rebase` 改历史 | 与"不修改历史 commit"约束冲突 |
| 跑完立刻 `git push --force` | 不可逆，丢远端新内容 |
| 不删其它 ref 就 gc | 旧 blob 仍可达，gc 释放不掉 |

## 完成标志

- ✅ `git ls-tree -r HEAD` 只看到 1 个或 N 个 `.commit-msg.txt` 文件
- ✅ `git count-objects -v` 的 `garbage` 接近 0
- ✅ `.git` 体积对比瘦身前下降 ≥ 50%（取决于原 blob 是否仍被其它 ref 引用）
- ✅ 工作区 clean 或显式受控

## 引用索引

| ref | 何时读取 | 路径 |
| --- | --- | --- |
| [[replay-append]] | 追加式快照 | references/replay-append.md |
| [[rewrite-history]] | 原地重写（瘦身） | references/rewrite-history.md |
| [[inspect-pack]] | pack 诊断 | references/inspect-pack.md |