# Replay Append — 追加式快照

把当前分支每个原 commit **追加**成一条新 commit：

```
旧: A -> B -> C -> D (4 commits, 各自带自己的修改文件)
新: A -> B -> C -> D -> A' -> B' -> C' -> D' (8 commits)
                                  ↑
                          A' 的 tree 只含一条 0dcea55__first commit.commit-msg.txt
                          author/date/message 抄自 A
```

**适合**：保留所有原 ref、可以 `git log` 看到原 commit 链 + 追加的快照链。**代价**：仓库不会瘦下来（commit 数翻倍，pack 不一定 dedup）。

**不适合**：要真的给 .git 瘦身。走 [[rewrite-history]]。

## 关键代码路径

参考实现：`script/replay_commits_snapshot.py`（会话中产生的原型，含本会话的所有补丁）。

### 主体三段

```python
# 第 1 段：每条原 commit 一个新 commit，用原 author/date
for c in commits:
    fname = f"{c.short_sha}__{safe_filename(c.subject)}.commit-msg.txt"
    (msg_dir / fname).write_text(  # txt 内容含 sha/author/date/subject/body/files
        f"sha: {c.sha}\nshort: {c.short_sha}\n..."
    )
    run("add", str(fname), cwd=root)
    commit_with_original_time(  # 关键：GIT_AUTHOR_* / GIT_AUTHOR_DATE
        root, message,
        author_name=c.author, author_email=c.author_email,
        author_date=c.date,
    )

# 第 2 段：删除所有 txt（用当前时间）
for p in msg_dir.rglob("*.commit-msg.txt"):
    run("rm", "--cached", str(p), cwd=root)
    p.unlink()
commit(root, "replay: remove all commit-message txt files")

# 第 3 段：保存快照（用当前时间）
snapshot_path.write_text(f"# Snapshot\nbranch: {branch}\nhead: {head}\n...")
commit(root, "replay: save current snapshot")
```

### 关键函数

```python
def commit_with_original_time(root, message, *, author_name, author_email,
                               author_date, committer_date=None):
    """通过 GIT_AUTHOR_* / GIT_COMMITTER_* 环境变量注入原值。"""
    env = os.environ.copy()
    env["GIT_AUTHOR_NAME"] = author_name
    env["GIT_AUTHOR_EMAIL"] = author_email
    env["GIT_AUTHOR_DATE"] = author_date
    env["GIT_COMMITTER_NAME"] = author_name
    env["GIT_COMMITTER_EMAIL"] = author_email
    env["GIT_COMMITTER_DATE"] = committer_date or author_date
    subprocess.run(["git", "commit", "--allow-empty", "-F", "-"],
                   input=message, env=env, encoding="utf-8", errors="replace")
```

### 历史采集（Windows GBK-safe）

```python
def collect_history(root):
    fmt = "%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1e"
    raw = (run("log", "--reverse", f"--pretty=format:{fmt}", cwd=root).stdout or "").strip()
    if not raw:
        raise GitError("仓库没有任何 commit")
    commits = []
    for line in raw.split("\x1e"):  # %x1e = record separator
        parts = line.strip().split("\x1f", 5)
        if len(parts) != 6:
            continue
        sha, short_sha, author, email, date, subject = parts
        # 二次拉取 body
        full_msg = (run("log", "-1", "--format=%B", sha, cwd=root).stdout or "").rstrip("\n")
        ...
```

## 踩坑

| 现象 | 根因 | 解 |
| --- | --- | --- |
| `UnicodeDecodeError: 'gbk'` | Windows cmd 默认 GBK，git 输出 UTF-8 | 强制 `encoding="utf-8", errors="replace"` + `LC_ALL=C.UTF-8` |
| `git add ... failed: paths ignored` | `.gitignore` 包含 `.commit-msgs/` | 入口调 `ensure_gitignore_unignore` 清掉对应行 |
| 跑到一半 Python 被 kill | 留下 `.git/index.lock` | 下次启动前 `Remove-Item .git/index.lock` |
| `git commit` 后 `git status` 又显示工作区 dirty | 上一条 commit 的 modify 正好是下一步要 stage 的 | 在脚本启动时一次性 `assert_clean`，过程中不重复校验 |

## 不建议做的事

- **每个 commit 都附一份 `_history.json`**：会让 pack 不能 dedup，仓库膨胀
- **追加后不删除其它 ref 就想瘦下来**：不会瘦，那些旧 commit 仍可达

## 完成后

- 当前 HEAD = "replay: save current snapshot"
- 工作区可能仍有 `.commit-msgs/SNAPSHOT.txt`
- `git log --oneline` 能看到 2N+2 条 commit
- `.git` 体积视原 ref 数量而定，**不一定变小**

要真正瘦身 → [[rewrite-history]]。