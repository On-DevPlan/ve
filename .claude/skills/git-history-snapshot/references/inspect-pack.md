# Inspect Pack — pack / 巨型 blob 诊断

瘦身后想验证、或者"为什么我的 pack 这么大"时用。

## 找出 pack 中最大的 N 个 blob

`git verify-pack -v` 输出的 sha 是 **truncated short sha**（前 8 字节），不能直接用。要拿完整 sha 必须**自己解析 pack idx**。

参考实现：`script/_inspect_pack.py`。

### idx v2 格式

```
[8 字节]   magic: \377tOc
[256*4]    fan-out table: 第 i 个 int = sha 字典序 <= 第 i 个字节的对象数
[n*20]     40-char sha 列表（n = fanout[255]）
[n*4]      CRC32 列表
[n*4]      offset 列表（offset < 2^31 表示在 main pack；>= 表示 large offset）
[8*?]      large offset 表
```

### 解析示例

```python
import struct
from pathlib import Path

def pack_objects(idx_path):
    raw = idx_path.read_bytes()
    assert raw[:4] == b"\xfftOc", "idx 不是 v2 格式"
    fanout = struct.unpack(">256I", raw[8:8 + 256 * 4])
    n = fanout[255]
    sha_off = 8 + 256 * 4
    crc_off = sha_off + n * 20
    off_off = crc_off + n * 4
    shas = [raw[sha_off + i*20:sha_off + (i+1)*20].hex() for i in range(n)]
    offsets = struct.unpack(">{}I".format(n), raw[off_off:off_off + n*4])
    return shas, offsets
```

### 从 pack 读每个对象的 type + size

```python
def parse_pack(pack_path, shas, offsets):
    data = pack_path.read_bytes()
    out = []
    for sha, off in zip(shas, offsets):
        pos = off
        b = data[pos]; pos += 1
        otype = (b & 0x70) >> 4   # 1=commit 2=tree 3=blob 4=tag
        sz = b & 0x0f
        shift = 4
        while b & 0x80:
            b = data[pos]; pos += 1
            sz |= (b & 0x7f) << shift
            shift += 7
        out.append((sha, otype, sz))
    return out
```

### 找出最大 10 个 blob 并定位到文件路径

```python
blobs = sorted(
    [(s, sz) for s, t, sz in objs if t == 3],
    key=lambda x: x[1], reverse=True
)
for sha, sz in blobs[:10]:
    # rev-list --all --objects 包含 <sha> <path> 行
    proc = subprocess.run(
        ["git", "rev-list", "--all", "--objects"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    for line in proc.stdout.splitlines():
        if line.startswith(sha + " "):
            print(f"{sha[:12]} {sz/1024/1024:.1f} MB  {line.split(' ', 1)[1]}")
            break
```

## 快速 cli（不写代码）

```bash
# 看 pack 概况
git count-objects -v

# 找出最大的几个 blob（短 sha，需结合下面定位）
git verify-pack -v .git/objects/pack/*.idx | sort -k3 -n -r | head -20

# 定位具体是哪个文件（用短 sha 前缀）
git rev-list --all --objects | grep "^<短 sha> "
```

## 看到结果后怎么办

| 现象 | 含义 | 下一步 |
| --- | --- | --- |
| 巨型 blob 在 `apps/.../public/...` | 资源文件被误提交 | 加 `.gitignore` + `git rm --cached` + 改写历史（用 [[rewrite-history]] 的 filter 思路） |
| 巨型 blob 在 `node_modules/` | 依赖没被忽略 | 同上 |
| 巨型 blob 是 `.commit-msgs/*.txt` × 几百 | replay 脚本的副产物 | 走 [[rewrite-history]]，删除非 main ref 后 gc |
| prune-packable > 0 且 garbage > 0 | 已有 unreachable 对象 | `git gc --prune=now` 一次 |
| 全部 in-pack 且 garbage = 0 | 所有对象都可达 | 检查 `git for-each-ref` 找谁在引用 |

## 关联

- 想给 .git 瘦身 → [[rewrite-history]]
- 想保留原 commit 但加 txt → [[replay-append]]