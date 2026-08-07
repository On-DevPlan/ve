# Rewrite History — 原地重写（瘦身）

把当前分支每个 commit 的 **tree 直接替换**为"只含 1 条 `.commit-msg.txt`"，author / author-date / committer-date / message 全部原样保留，父子关系不变。然后**删掉其它 ref**（本地其它分支、远程跟踪、stash、original/*）让 pack 中旧 blob 真正 unreachable，最后 `git gc --prune=now --aggressive` 释放空间。

**适合**：仓库里有巨型资源文件（image.ply、大 GIF、模型文件），想一次性瘦下来。  
**代价**：所有其它本地分支和远程跟踪会被删；远端需要 `git push --force-with-lease` 才能同步（脚本不自动 push）。

## 核心思想

每个 commit 的 tree 内容由 `commit.show --name-only` 决定。脚本对每条 commit：

1. 把这条 commit 的所有 files 列表（best-effort）写成一条 `<short_sha>__<subject>.commit-msg.txt`
2. 用 `git hash-object -w` 写 blob、`git mktree` 造单文件 tree、`git commit-tree` 用原 author/date 创建新 commit 对象
3. 把 `old_sha -> new_sha` 的映射存到 `.commit-rewrite-map.json`
4. 处理完所有 commit 后，用 `git update-ref refs/heads/<branch> <new_head>` 把分支指到新链

## 关键代码

参考实现：`script/rewrite_commit_trees.py`。

### 写 blob + 造 tree

```python
def write_blob(root, content: bytes) -> str:
    """git hash-object -w --stdin → 返回 sha"""
    proc = subprocess.run(
        ["git", "hash-object", "-w", "--stdin"],
        cwd=root, input=content, capture_output=True,
    )
    return proc.stdout.decode("ascii").strip()

def build_tree_with_txt(root, blob_sha, filename) -> str:
    """git mktree 接受 stdin: '100644 blob <sha>\t<filename>\n'"""
    line = f"100644 blob {blob_sha}\t{filename}\n".encode()
    proc = subprocess.run(["git", "mktree"], cwd=root, input=line, capture_output=True)
    return proc.stdout.decode("ascii").strip()
```

### 用原 author/date 创建 commit

```python
def make_commit(root, tree_sha, parents, message, author, email,
                author_date, committer_date):
    env = {
        "GIT_AUTHOR_NAME": author,
        "GIT_AUTHOR_EMAIL": email,
        "GIT_AUTHOR_DATE": author_date,
        "GIT_COMMITTER_NAME": author,
        "GIT_COMMITTER_EMAIL": email,
        "GIT_COMMITTER_DATE": committer_date,
    }
    args = ["commit-tree", tree_sha, "-F", "-"]
    for p in parents:
        args.extend(["-p", p])
    proc = subprocess.run(
        ["git", *args], cwd=root, input=message,
        env={**os.environ, **env},
        capture_output=True, encoding="utf-8", errors="replace",
    )
    return proc.stdout.strip()
```

### 重写循环

```python
commits = list_commits(root)  # 从 oldest 到 newest
mapping = {}

for i, c in enumerate(commits):
    original_files = get_files_for_commit(root, c["sha"])
    fname = f"{c['short']}__{safe_filename(c['subject'])}.commit-msg.txt"
    txt = (
        f"sha: {c['sha']}\nshort: {c['short']}\n"
        f"author: {c['author']} <{c['email']}>\n"
        f"date: {c['author_date']}\nsubject: {c['subject']}\n"
        f"\n--- body ---\n{c['body']}\n"
        f"\n--- files ({len(original_files)}) ---\n" + "\n".join(original_files)
    )
    blob_sha = write_blob(root, txt.encode("utf-8"))
    tree_sha = build_tree_with_txt(root, blob_sha, fname)
    new_parents = [mapping[p] for p in c["parents"]]
    new_sha = make_commit(root, tree_sha, new_parents,
                          c["body"] or c["subject"],
                          c["author"], c["email"],
                          c["author_date"], c["committer_date"])
    mapping[c["sha"]] = new_sha

# 把分支指向新链
head_old = git("rev-parse", branch, cwd=root).strip()
head_new = mapping[head_old]
git("update-ref", f"refs/heads/{branch}", head_new, cwd=root)
```

### 删除其它 ref（关键，否则 gc 释放不掉旧 blob）

```bash
git for-each-ref --format='%(refname)' \
  | grep -v '^refs/heads/main$' \
  | xargs -I {} git update-ref -d {}
```

## 删 ref 后的 gc

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

| 阶段 | .git 体积（典型项目） | 说明 |
| --- | --- | --- |
| 瘦身前 | 100~500 MB | 历史中有 image.ply、大 GIF 等 |
| 删除非 main ref + gc 后 | 1~10 MB | 仅 main 上 370 条 commit 的 txt |

## 踩坑

| 现象 | 根因 | 解 |
| --- | --- | --- |
| 瘦身后 .git 没小 | 其它 ref（分支、stash、original/*、远程跟踪）仍指向旧 commit | 删 ref 后再 gc |
| `index.lock` 卡住 | 上次脚本被打断 | `Remove-Item .git/index.lock` |
| `for sha, off in offsets:` TypeError | `offsets` 是 list of int，不是 list of pairs | `zip(shas, offsets)` |
| `git cat-file -p <8位短sha>` 报 Not a valid object | 那是 truncated sha | 从 pack idx 解析完整 sha |
| `--aggressive` 后 pack 没变小 | `--aggressive` 是 delta 重排，不删 unreachable | 必须先删 ref |

## 安全护栏

- 全程 NEVER_PUSH：脚本不调用 push
- 不 amend / 不 rebase / 不 reset --hard —— 只创建新 commit 对象
- 第一个 commit（无 parent）正常处理
- merge commit：保留所有 parent（`commit.parents` 列表）

## 完成后

- `git ls-tree -r HEAD` 只看到 1 个 `.commit-msg.txt`
- `git count-objects -v` 的 `garbage` ≈ 0
- 工作区不变（tree 不动 working tree）
- 其它 ref 已删
- 远端 main 不会自动同步（要 push 请用户自己 `git push --force-with-lease`）

需要诊断 pack 找巨型 blob → [[inspect-pack]]。