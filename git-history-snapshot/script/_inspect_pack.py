#!/usr/bin/env python3
"""列出 pack 中最大的 N 个 blob，并把每个 blob 完整 sha + 路径定位出来。"""
import subprocess, sys, re, hashlib, struct
from pathlib import Path

def pack_objects(idx_path: Path):
    """解析 pack idx 文件，返回 [(sha40, type, size)] 列表。"""
    raw = idx_path.read_bytes()
    if raw[:4] != b"\xfftOc":
        raise SystemExit("idx 不是 v2 格式: " + idx_path.name)
    fanout = struct.unpack(">256I", raw[8:8 + 256 * 4])
    n = fanout[255]
    sha_off = 8 + 256 * 4
    crc_off = sha_off + n * 20
    off_off = crc_off + n * 4
    shas = [raw[sha_off + i * 20:sha_off + (i + 1) * 20].hex() for i in range(n)]
    offsets = struct.unpack(">{}I".format(n), raw[off_off:off_off + n * 4])
    return shas, offsets

def parse_pack(pack_path: Path, shas, offsets):
    """从 pack 文件读取每个对象 type 和 size（不解压）。"""
    data = pack_path.read_bytes()
    out = []
    for sha, off in zip(shas, offsets):
        pos = off
        b = data[pos]; pos += 1
        otype = (b & 0x70) >> 4
        sz = b & 0x0f
        shift = 4
        while b & 0x80:
            b = data[pos]; pos += 1
            sz |= (b & 0x7f) << shift
            shift += 7
        out.append((sha, otype, sz))
    return out

def find_blob_paths(sha):
    """用 rev-list --objects 找包含给定 blob 的所有 commit + 路径。"""
    proc = subprocess.run(
        ["git", "rev-list", "--all", "--objects"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    hits = []
    for line in proc.stdout.splitlines():
        parts = line.split(" ", 1)
        if parts[0] == sha:
            hits.append(line)
    return hits

idx_path = next(Path(".git/objects/pack").glob("*.idx"))
pack_path = idx_path.with_suffix(".pack")
shas, offsets = pack_objects(idx_path)
objs = parse_pack(pack_path, shas, offsets)

# type 3 = blob；按 size 排序
blobs = [(s, sz) for s, t, sz in objs if t == 3]
blobs.sort(key=lambda x: x[1], reverse=True)
top = blobs[:10]
print(f"pack 总对象 {len(objs)}, blob {len(blobs)}")
for sha, sz in top:
    print(f"\n=== blob {sha[:12]} size={sz:,} bytes ({sz/1024/1024:.1f} MB) ===")
    # 哪个 commit 引用 + 路径
    proc = subprocess.run(
        ["git", "rev-list", "--all", "--objects"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    matches = [l for l in proc.stdout.splitlines() if l.startswith(sha + " ") or l.startswith(sha + "\t")]
    for m in matches[:3]:
        print("  ", m)