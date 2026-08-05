#!/usr/bin/env python3
"""
rewrite_commit_trees.py

重写当前分支每个 commit 的 tree：
  - 把每个 commit 里的"实际改动文件"全部删除
  - 替换成一条 `<short_sha>__<subject>.commit-msg.txt`
    （内容 = 原 commit 的 sha/author/date/subject/body/files 摘要）
  - commit 本身的 author / author-date / committer-date 全部保留原值
  - commit message 也保留原值
  - 不使用 rebase、不修改 commit 链结构（父子关系不变）

完成后让分支指向新链，run `git reflog expire --expire=now --all && git gc --prune=now`
即可释放原 blob，让 .git 变瘦。

不 push、不改 remote。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Iterable


SCRIPT_VERSION = "1.0.0"
NEVER_PUSH = True
MSG_FILENAME = ".commit-msg.txt"  # 仓库根目录下的固定名，便于 git ls-tree 索引


# --------------------------- plumbing 封装 ---------------------------

def git(*args: str, cwd: Path, env: dict | None = None) -> str:
    full_env = os.environ.copy()
    full_env["PYTHONIOENCODING"] = "utf-8"
    full_env["LC_ALL"] = "C.UTF-8"
    full_env["LANG"] = "C.UTF-8"
    if env:
        full_env.update(env)
    proc = subprocess.run(
        ["git", *args],
        cwd=cwd,
        env=full_env,
        text=True,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} 失败：{(proc.stderr or '').strip()}")
    return proc.stdout


def git_bytes(*args: str, cwd: Path, env: dict | None = None) -> bytes:
    full_env = os.environ.copy()
    if env:
        full_env.update(env)
    proc = subprocess.run(
        ["git", *args],
        cwd=cwd,
        env=full_env,
        capture_output=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} 失败：{proc.stderr.decode('utf-8', 'replace')}")
    return proc.stdout


# --------------------------- 工具 ---------------------------

def safe_filename(name: str) -> str:
    name = name.strip() or "empty"
    name = re.sub(r"[\\/:*?\"<>|\r\n\t]+", "_", name)
    return name[:80]


def list_commits(root: Path) -> list[dict]:
    """从 oldest 到 newest 列当前分支的所有 commit。"""
    fmt = "%H%x1f%h%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%cI%x1f%s%x1e"
    raw = git("log", "--reverse", f"--pretty=format:{fmt}", cwd=root)
    out: list[dict] = []
    for line in raw.split("\x1e"):
        line = line.strip()
        if not line:
            continue
        parts = line.split("\x1f", 7)
        if len(parts) != 8:
            continue
        sha, short, parents, author, email, a_date, c_date, subject = parts
        body = git("log", "-1", "--format=%B", sha, cwd=root).rstrip("\n")
        out.append({
            "sha": sha,
            "short": short,
            "parents": [p for p in parents.split(" ") if p],
            "author": author,
            "email": email,
            "author_date": a_date,
            "committer_date": c_date,
            "subject": subject,
            "body": body,
        })
    return out


def get_files_for_commit(root: Path, sha: str) -> list[str]:
    """列出 commit 修改的文件路径（best-effort，含 merge 友好）。"""
    out = git("show", "--name-only", "--pretty=", sha, cwd=root)
    return [f.strip() for f in out.splitlines() if f.strip()]


def write_blob(root: Path, content: bytes) -> str:
    """写入一个 blob 并返回 sha。"""
    proc = subprocess.run(
        ["git", "hash-object", "-w", "--stdin"],
        cwd=root,
        input=content,
        capture_output=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"hash-object 失败：{proc.stderr.decode('utf-8','replace')}")
    return proc.stdout.decode("ascii").strip()


def build_empty_tree(root: Path) -> str:
    """空 tree 的 sha。"""
    proc = subprocess.run(
        ["git", "mktree"],
        cwd=root,
        input=b"",
        capture_output=True,
    )
    if proc.returncode != 0:
        # mktree 读 EOF 时会成功输出空 tree
        raise RuntimeError(f"mktree 失败：{proc.stderr.decode('utf-8','replace')}")
    return proc.stdout.decode("ascii").strip()


def build_tree_with_txt(root: Path, blob_sha: str, filename: str) -> str:
    """构造一个只含一个文件 (filename, blob) 的 tree。"""
    line = f"100644 blob {blob_sha}\t{filename}\n".encode("utf-8")
    proc = subprocess.run(
        ["git", "mktree"],
        cwd=root,
        input=line,
        capture_output=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"mktree 失败：{proc.stderr.decode('utf-8','replace')}")
    return proc.stdout.decode("ascii").strip()


def make_commit(
    root: Path,
    tree_sha: str,
    parents: list[str],
    message: str,
    author: str,
    email: str,
    author_date: str,
    committer_date: str,
) -> str:
    """用原 author/date 创建新 commit 对象，返回 sha。"""
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
        ["git", *args],
        cwd=root,
        input=message,
        env={**os.environ, **env},
        capture_output=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.returncode != 0:
        raise RuntimeError(f"commit-tree 失败：{(proc.stderr or '').strip()}")
    return proc.stdout.strip()


# --------------------------- 主流程 ---------------------------

def rewrite(root: Path, dry_run: bool = False) -> dict:
    commits = list_commits(root)
    print(f"[init] 共 {len(commits)} 条 commit 待重写")

    # 第一个 commit 没有 parent，是初始点
    mapping: dict[str, str] = {}  # old_sha -> new_sha

    for i, c in enumerate(commits):
        original_files = get_files_for_commit(root, c["sha"])

        # 1) 写一个 blob，文件名 = sha__subject.txt（截断）
        fname = f"{c['short']}__{safe_filename(c['subject'])}.commit-msg.txt"
        body_text = c["body"] if c["body"] != c["subject"] else ""
        txt = (
            f"sha:        {c['sha']}\n"
            f"short:      {c['short']}\n"
            f"author:     {c['author']} <{c['email']}>\n"
            f"date:       {c['author_date']}\n"
            f"subject:    {c['subject']}\n"
            f"\n--- body ---\n{body_text}\n"
            f"\n--- files ({len(original_files)}) ---\n"
            + "\n".join(original_files)
        )

        if dry_run:
            new_sha = "(dry-run)"
        else:
            blob_sha = write_blob(root, txt.encode("utf-8"))
            tree_sha = build_tree_with_txt(root, blob_sha, fname)
            new_parents = [mapping[p] for p in c["parents"]] or [mapping[commits[i - 1]["sha"]]] if i > 0 else []
            new_sha = make_commit(
                root,
                tree_sha,
                new_parents if new_parents else [],  # 第一个 commit 也保留 root
                c["body"] or c["subject"],
                c["author"],
                c["email"],
                c["author_date"],
                c["committer_date"],
            )
        mapping[c["sha"]] = new_sha
        if (i + 1) % 20 == 0 or i == len(commits) - 1:
            print(f"  [{i+1}/{len(commits)}] {c['short']} -> {new_sha[:10]}  files={len(original_files)}")

    # 写 mapping 到磁盘，方便外部做 ref 移动
    map_path = root / ".commit-rewrite-map.json"
    if not dry_run:
        map_path.write_text(
            json.dumps(mapping, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    return {"mapping": mapping, "count": len(commits), "dry_run": dry_run}


def move_branch(root: Path, mapping: dict[str, str], branch: str) -> None:
    """把 branch 移到新链的 HEAD。"""
    head_old = git("rev-parse", branch, cwd=root).strip()
    head_new = mapping[head_old]
    git("update-ref", f"refs/heads/{branch}", head_new, cwd=root)
    print(f"[ref] {branch}: {head_old[:10]} -> {head_new[:10]}")


# --------------------------- CLI ---------------------------

def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="重写每个 commit 的 tree 为单条 commit-msg.txt，保留 author/date/message"
    )
    p.add_argument("--root", "-C", default=".")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--branch", default=None,
                   help="要移动的分支（默认：当前分支）")
    return p.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    root = Path(args.root).resolve()
    if not (root / ".git").exists():
        print("不是 git 仓库", file=sys.stderr)
        return 2

    branch = args.branch or git("rev-parse", "--abbrev-ref", "HEAD", cwd=root).strip()
    print(f"[init] repo={root} branch={branch} never_push={NEVER_PUSH}")

    result = rewrite(root, dry_run=args.dry_run)
    if args.dry_run:
        print("[dry-run] 未做任何修改。")
        return 0

    move_branch(root, result["mapping"], branch)
    print()
    print("=" * 60)
    print(f"完成。共重写 {result['count']} 条 commit。")
    print("下一步（请手动执行）：")
    print("  git reflog expire --expire=now --all")
    print("  git gc --prune=now --aggressive")
    print("严禁推送：脚本没有调用任何 push 命令。")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))