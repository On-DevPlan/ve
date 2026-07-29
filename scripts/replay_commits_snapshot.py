#!/usr/bin/env python3
"""
回放式快照脚本：

对当前 git 仓库做一次"快照 + 还原"操作。
不要推送。脚本只做本地提交。

执行流程（自上而下）：
  1. 校验前置条件：必须在 git 仓库内、工作区干净、有 origin remote（仅校验，不推送）。
  2. 在父级目录创建 `<repo_name>_backup_<timestamp>/` 镜像（仅文件级 cp，不复制 .git），
     并把当前 HEAD 的 commit 信息备份成 JSON，方便后续比对。
  3. 读取 `git log --reverse` 得到历史 commit 列表（oldest -> newest），
     倒序回放：为每一条历史 commit 创建一个新的 commit，
     提交说明 = 该历史 commit 的完整 message + diff 摘要。
  4. 紧接着创建一个"删除所有提交说明 txt"的 commit。
  5. 最后再创建一个"保存当前快照"的 commit（提交说明为快照信息）。
  6. 不 push、不切分支、不改 remote。

约束：
  - 严禁任何形式的 push。
  - 不修改历史 commit，不使用 --amend / reset / rebase。
  - 每次提交前自动 stage，message 包含原始 sha 以便追溯。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path


# --------------------------- 常量 ---------------------------

SCRIPT_VERSION = "1.0.0"

# 触发"删除所有 .txt 提交说明"时使用的提交说明标记
TXT_FILE_GLOB = "*.commit-msg.txt"
TXT_DIR_NAME = ".commit-msgs"  # 把 txt 集中放这里，便于一次性删干净

# 严禁推送：脚本中所有 push 关键字都会被这个常量引用，审计时一目了然
NEVER_PUSH = True


# --------------------------- 数据类 ---------------------------

@dataclass
class CommitInfo:
    sha: str           # 完整 40 位 sha
    short_sha: str     # 短 sha（>= 7 位）
    author: str
    author_email: str
    date: str          # ISO 8601
    subject: str       # 第一行
    body: str          # 剩余部分（不含第一行），可能为空
    files: list[str]   # 本次提交改动的文件列表（best-effort）


# --------------------------- 子进程封装 ---------------------------

class GitError(RuntimeError):
    pass


def run(
    *args: str,
    cwd: Path,
    check: bool = True,
    capture: bool = True,
    env: dict | None = None,
) -> subprocess.CompletedProcess:
    """执行 git 子命令，统一抛错。

    Windows 上 cmd/PowerShell 默认 GBK，git 输出里若含 UTF-8（如中文 commit
    message、文件名、emoji）会触发 UnicodeDecodeError。这里强制用 UTF-8 解码，
    并对个别不可解码字节做 replace，避免脚本崩溃。
    """
    full_env = os.environ.copy()
    full_env["PYTHONIOENCODING"] = "utf-8"
    full_env["LC_ALL"] = "C.UTF-8"
    full_env["LANG"] = "C.UTF-8"
    if env:
        full_env.update(env)

    # 防止 GIT_PUSH_OPTIONS、alias 之类干扰
    full_env.pop("GIT_PUSH_OPTIONS", None)

    proc = subprocess.run(
        ["git", *args],
        cwd=cwd,
        env=full_env,
        text=True,
        capture_output=capture,
        check=False,
        encoding="utf-8",
        errors="replace",
    )
    if check and proc.returncode != 0:
        msg = (proc.stderr or "").strip() or (proc.stdout or "").strip()
        raise GitError(f"git {' '.join(args)} failed: {msg}")
    return proc


# --------------------------- 校验 ---------------------------

def assert_repo(root: Path) -> None:
    if not (root / ".git").exists():
        raise GitError(f"{root} 不是 git 仓库")


def assert_clean(root: Path) -> None:
    proc = run("status", "--porcelain", cwd=root)
    if proc.stdout.strip():
        raise GitError(
            "工作区不干净，请先 commit / stash 当前改动：\n" + proc.stdout
        )


def assert_remote_present(root: Path) -> None:
    """仅校验 origin 是否存在，绝不推送。"""
    proc = run("remote", "get-url", "origin", cwd=root, check=False)
    if proc.returncode != 0:
        raise GitError(
            "没有发现 origin remote。本脚本是本地快照脚本，"
            "不要求有 remote，但保留这个校验以便后续手动 push。"
        )


# --------------------------- 备份 ---------------------------

def create_backup(root: Path) -> Path:
    """在父级目录创建一份文件级镜像（不含 .git）。"""
    parent = root.parent
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = parent / f"{root.name}_backup_{stamp}"

    # 使用 rsync 不可用时退化到 shutil.copytree + ignore
    ignore = shutil.ignore_patterns(
        ".git", "node_modules", "dist", "build", ".next", ".cache", ".turbo"
    )

    print(f"[backup] 正在创建文件镜像到：{backup_dir}")
    shutil.copytree(root, backup_dir, ignore=ignore, dirs_exist_ok=False)

    # 再额外备份一份 HEAD 元信息
    head_sha = run("rev-parse", "HEAD", cwd=root).stdout.strip()
    head_log = run("log", "--reverse", "--pretty=format:%H%x09%an%x09%ae%x09%aI%x09%s",
                   cwd=root).stdout
    meta = {
        "script_version": SCRIPT_VERSION,
        "backup_at": datetime.now().isoformat(timespec="seconds"),
        "original_head": head_sha,
        "log": head_log,
    }
    (backup_dir / "BACKUP_META.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"[backup] 完成。HEAD={head_sha[:12]}  commits={len(head_log.splitlines())}")
    return backup_dir


# --------------------------- 历史采集 ---------------------------

def collect_history(root: Path) -> list[CommitInfo]:
    """
    读取完整提交历史，从最早到最新（oldest -> newest）。
    使用 %x1f 作为字段分隔符、%x1e 作为记录分隔符，避免 subject/body 中的空格混淆。
    """
    fmt = "%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1e"
    proc = run("log", "--reverse", f"--pretty=format:{fmt}", cwd=root)
    raw = (proc.stdout or "").strip()
    if not raw:
        raise GitError("仓库没有任何 commit，无法回放")

    commits: list[CommitInfo] = []
    # %x1e = record separator，把历史切成多条
    for line in raw.split("\x1e"):
        line = line.strip()
        if not line:
            continue
        parts = line.split("\x1f", 5)
        if len(parts) != 6:
            print(f"[warn] 跳过解析失败的 commit 行: {line[:80]!r}", file=sys.stderr)
            continue
        sha, short_sha, author, email, date, subject = parts

        # 二次拉取完整 message（避免 subject 和 body 合并解析出错）
        msg_proc = run("log", "-1", "--format=%B", sha, cwd=root)
        full_msg = (msg_proc.stdout or "").rstrip("\n")
        if "\n" in full_msg:
            subject_actual, body = full_msg.split("\n", 1)
            body = body.strip()
        else:
            subject_actual, body = full_msg, ""

        # 文件列表（best-effort；merge commit 也安全）
        files_proc = run("show", "--name-only", "--pretty=", sha, cwd=root)
        files = [
            f.strip() for f in (files_proc.stdout or "").splitlines() if f.strip()
        ]
        commits.append(
            CommitInfo(
                sha=sha,
                short_sha=short_sha,
                author=author,
                author_email=email,
                date=date,
                subject=subject_actual,
                body=body,
                files=files,
            )
        )

    if not commits:
        raise GitError("解析后没有得到任何 commit，请检查 git log 输出格式")
    return commits


# --------------------------- 提交辅助 ---------------------------

def safe_filename(name: str) -> str:
    """把任意字符串变成安全的文件名（保留中文、英文，去掉非法字符）。"""
    name = name.strip() or "empty"
    name = re.sub(r"[\\/:*?\"<>|\r\n\t]+", "_", name)
    return name[:80]  # 文件名不要太长


def commit_with_original_time(
    root: Path,
    message: str,
    *,
    author_name: str,
    author_email: str,
    author_date: str,
    committer_name: str | None = None,
    committer_date: str | None = None,
) -> str:
    """用原 commit 的作者/时间提交。

    author_date / committer_date 必须是 git 能解析的格式（ISO 8601）。
    通过环境变量 GIT_AUTHOR_* / GIT_COMMITTER_* 注入，避免 shell 转义。
    """
    env = os.environ.copy()
    env["GIT_AUTHOR_NAME"] = author_name
    env["GIT_AUTHOR_EMAIL"] = author_email
    env["GIT_AUTHOR_DATE"] = author_date
    env["GIT_COMMITTER_NAME"] = committer_name or author_name
    env["GIT_COMMITTER_EMAIL"] = author_email
    env["GIT_COMMITTER_DATE"] = committer_date or author_date

    proc = subprocess.run(
        ["git", "commit", "--allow-empty", "-F", "-"],
        cwd=root,
        input=message,
        text=True,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )
    if proc.returncode != 0:
        raise GitError(f"commit 失败：{(proc.stderr or '').strip()}")
    sha = run("rev-parse", "--short", "HEAD", cwd=root).stdout.strip()
    first = (message.splitlines() or [""])[0]
    print(f"  -> 新提交 {sha} @ {author_date}: {first[:50]}")
    return sha


def commit(root: Path, message: str, *, allow_empty: bool = True) -> str:
    """用当前时间提交（用于"删除 txt"和"快照"这两个语义上属于现在的 commit）。"""
    if not allow_empty:
        proc = run("status", "--porcelain", cwd=root)
        if not (proc.stdout or "").strip():
            print("  (无改动，跳过本次提交)")
            return ""
    proc = subprocess.run(
        ["git", "commit", "--allow-empty", "-F", "-"],
        cwd=root,
        input=message,
        text=True,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.returncode != 0:
        raise GitError(f"commit 失败：{(proc.stderr or '').strip()}")
    sha = run("rev-parse", "--short", "HEAD", cwd=root).stdout.strip()
    first = (message.splitlines() or [""])[0]
    print(f"  -> 新提交 {sha}: {first[:60]}")
    return sha


# --------------------------- 主流程 ---------------------------

def replay(root: Path, commits: list[CommitInfo], backup_dir: Path) -> None:
    """
    倒序回放：
      1) 为每条历史 commit 写一份 txt，并新建一个 commit，message 含原始 sha + 摘要
      2) 再提交一次"删除所有 txt"
      3) 最后再提交一次"保存当前快照"
    """
    msg_dir = root / TXT_DIR_NAME
    msg_dir.mkdir(exist_ok=True)
    # 把 .gitignore 中已有的 .commit-msgs 屏蔽规则清掉
    ensure_gitignore_unignore(root, msg_dir)
    # 清掉上一次跑残留的 txt
    for stale in msg_dir.glob("*.commit-msg.txt"):
        stale.unlink(missing_ok=True)
    if (msg_dir / "_history.json").exists():
        (msg_dir / "_history.json").unlink()
    if (msg_dir / "SNAPSHOT.txt").exists():
        (msg_dir / "SNAPSHOT.txt").unlink()

    # ---- 第 1 段：每条历史 commit 一个新提交（保留原时间）----
    for c in commits:
        # 写一条 txt，文件名 = sha + 主题（安全化）
        fname = f"{c.short_sha}__{safe_filename(c.subject)}.commit-msg.txt"
        fpath = msg_dir / fname
        fpath.write_text(
            f"sha:        {c.sha}\n"
            f"short:      {c.short_sha}\n"
            f"author:     {c.author} <{c.author_email}>\n"
            f"date:       {c.date}\n"
            f"subject:    {c.subject}\n"
            f"\n--- body ---\n{c.body}\n"
            f"\n--- files ({len(c.files)}) ---\n"
            + "\n".join(c.files),
            encoding="utf-8",
        )
        run("add", str(fpath.relative_to(root)), cwd=root)

        first_line = c.subject.strip() or "(no subject)"
        message = (
            f"replay: snapshot of commit {c.short_sha}\n"
            f"\n"
            f"original-subject: {first_line}\n"
            f"original-author:  {c.author} <{c.author_email}>\n"
            f"original-date:    {c.date}\n"
            f"files:            {len(c.files)}\n"
        )
        # 关键：用原 commit 的作者 + 时间提交（不是当前时间）
        commit_with_original_time(
            root,
            message,
            author_name=c.author,
            author_email=c.author_email,
            author_date=c.date,
        )

    # ---- 第 2 段：删除所有 txt（用当前时间提交）----
    deleted = 0
    for p in msg_dir.rglob(TXT_FILE_GLOB):
        rel = p.relative_to(root)
        run("rm", "--cached", str(rel), cwd=root, check=False)
        try:
            p.unlink()
            deleted += 1
        except FileNotFoundError:
            pass

    run("add", "-A", cwd=root)
    del_message = (
        f"replay: remove all commit-message txt files\n"
        f"\n"
        f"Deleted {deleted} message file(s) under {TXT_DIR_NAME}/.\n"
    )
    commit(root, del_message, allow_empty=True)

    # ---- 第 3 段：保存当前快照 ----
    snapshot_path = root / TXT_DIR_NAME / "SNAPSHOT.txt"
    snapshot_path.parent.mkdir(exist_ok=True)
    head = run("rev-parse", "HEAD", cwd=root).stdout.strip()
    short = run("rev-parse", "--short", "HEAD", cwd=root).stdout.strip()
    branch = run("rev-parse", "--abbrev-ref", "HEAD", cwd=root).stdout.strip()
    status = run("status", "--porcelain", cwd=root).stdout.strip()
    created_at = datetime.now().isoformat(timespec="seconds")
    snapshot_text = (
        f"# Snapshot\n"
        f"branch:     {branch}\n"
        f"head:       {head}\n"
        f"created_at: {created_at}\n"
        f"backup_dir: {backup_dir}\n"
        f"status:     {'clean' if not status else 'dirty'}\n"
    )
    snapshot_path.write_text(snapshot_text, encoding="utf-8")
    run("add", str(snapshot_path.relative_to(root)), cwd=root)

    snap_message = (
        f"replay: save current snapshot\n"
        f"\n"
        f"branch:    {branch}\n"
        f"head:      {short}\n"
        f"snapshot:  {TXT_DIR_NAME}/SNAPSHOT.txt\n"
        f"NEVER_PUSH:{NEVER_PUSH}\n"
    )
    final_sha = commit(root, snap_message, allow_empty=True)

    print()
    print("=" * 60)
    print(f"完成。新 HEAD = {final_sha}")
    print("严禁推送：脚本没有调用任何 push 命令。")
    print(f"备份目录：{backup_dir}")
    print("如需对比新旧提交：")
    print(f"  git log --oneline -n 5")
    print("=" * 60)


def ensure_gitignore_unignore(root: Path, msg_dir: Path) -> None:
    """从 .gitignore 中删除任何屏蔽 .commit-msgs 的条目。

    不管这行是项目原本就有的、还是脚本上次写的 —— 脚本必须在
    .commit-msgs/ 下写文件并提交，所以这里强制不允许它被 ignore。
    """
    gitignore = root / ".gitignore"
    if not gitignore.exists():
        return
    try:
        content = gitignore.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return

    target = msg_dir.name  # ".commit-msgs"
    target_patterns = {target, f"/{target}", f"{target}/", f"/{target}/"}

    cleaned: list[str] = []
    changed = False
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            cleaned.append(raw_line)
            continue
        rule = line.split("#", 1)[0].strip()
        if rule.startswith("!"):
            cleaned.append(raw_line)
            continue
        if rule in target_patterns:
            changed = True
            continue
        cleaned.append(raw_line)

    if changed:
        new_content = "\n".join(cleaned)
        if content.endswith("\n"):
            new_content += "\n"
        elif new_content:
            new_content += "\n"
        gitignore.write_text(new_content, encoding="utf-8")
        run("add", ".gitignore", cwd=root, check=False)
        print(f"[gitignore] 已移除对 {target}/ 的忽略规则")


# --------------------------- CLI ---------------------------

def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="把当前仓库的每个 commit 复制成新提交（严禁推送）。"
    )
    p.add_argument(
        "--root", "-C",
        default=".",
        help="git 仓库根目录（默认：当前目录）",
    )
    p.add_argument(
        "--no-backup", action="store_true",
        help="跳过父级目录的备份步骤（不推荐）",
    )
    p.add_argument(
        "--dry-run", action="store_true",
        help="只打印将要执行的动作，不真的写入任何东西",
    )
    p.add_argument(
        "--limit", type=int, default=0,
        help="只回放最近 N 条 commit（0 = 全部）",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    root = Path(args.root).resolve()

    assert_repo(root)
    if not args.dry_run:
        assert_clean(root)
        assert_remote_present(root)

    print(f"[init] 仓库根：{root}")
    print(f"[init] never_push={NEVER_PUSH}  version={SCRIPT_VERSION}")

    if args.dry_run:
        print("[dry-run] 不会创建备份、不会做任何提交。")
        commits = collect_history(root)
        print(f"[dry-run] 将回放 {len(commits)} 条 commit。")
        for c in commits[:5]:
            print(f"  - {c.short_sha}  {c.subject[:60]}")
        if len(commits) > 5:
            print(f"  ... +{len(commits) - 5} more")
        return 0

    backup_dir: Path | None = None
    if not args.no_backup:
        backup_dir = create_backup(root)

    commits = collect_history(root)
    if args.limit and args.limit > 0:
        commits = commits[-args.limit:]
        print(f"[init] 已限制为最近 {args.limit} 条")

    replay(root, commits, backup_dir or Path("(no backup)"))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except GitError as e:
        print(f"[error] {e}", file=sys.stderr)
        raise SystemExit(2)