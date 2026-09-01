# chess-skin-admin

国际象棋皮肤管理组件。后端 `chess_skin:index` KV + `/files/<id>`，通过 tag 维度关联。

## 数据流

```
loadIndex()
  → GET /api/v1/kv/chess_skin:index?groupId=190
  → { value: JSON 数组, myRole: 'owner'|'admin'|'writer'|'reader' }

replacePiece(skinId, pieceKey, blob)
  → POST /api/v1/files  (multipart, tags=[chess-skin, chess-skin:<id>, chess-skin:<id>:<pieceKey>])
  → POST /api/v1/kv  (key=chess_skin:index, tags=[chess-skin])
  → DELETE /api/v1/files/<oldFileId>?groupId=190  (best-effort 旧文件清理,失败仅 warn)

applyBatchMeta(meta, files)
  → × 12 POST /api/v1/files  (并行后续优化)
  → POST /api/v1/kv  (合并 index)

deleteSkin(skinId)
  → 并发 N 个 DELETE /api/v1/files/<fileId>?groupId=190  (pieces + boardBackground)
  → 任一失败 → 抛错中止,KV index 不动
  → 全部成功 → POST /api/v1/kv  (key=chess_skin:index,从 index 移除该 skin)
  → 顺序:文件先,KV 后 —— 任一文件失败整体回滚(KV index 字字未动)

generateAiPrompt(args)
  → 返回 markdown 字符串（用户复制粘贴给 AI，只输出 meta JSON）
```

## 鉴权

- `KvItem.myRole` 决定 `canEdit = myRole === 'owner'`
- 后端按 `groupId=190` 兜底校验（PATCH /files、POST /kv）
- 前端只是"少画按钮"，不是安全边界

## 已知约束

- File 实际所在组 ≠ 190（add_skin.py 没显式指定 file groupId）
  详见 fr `chess-skin-pipeline` skill 的 architecture §5
- KV ↔ File 对应关系通过 KV meta JSON 里的 `pieces[pieceKey].fileId` 字段建立
  （不是通过 group/tag join；tag 是辅助维度）

## 开发

```bash
# dev server 自动发现（manifestPlugin watcher）
pnpm --filter @style-library/showcase dev

# 验证 ESLint
pnpm lint

# 验证 build 产物含独立 chunk
pnpm --filter @style-library/showcase build
ls apps/showcase/dist/assets/ | grep chess-skin-admin
```

## 目录

```
chess-skin-admin/
├── component.config.ts                  # 元数据（ESLint 强制校验）
├── index.vue                            # 顶层入口（glob 唯一扫描目标）
├── README.md
└── src/
    ├── composables/
    │   └── useChessSkinAdmin.ts         # 状态 + API 封装 + AI prompt 生成
    └── views/
        ├── PreviewTab.vue               # 只读 tab
        ├── ReplaceTab.vue               # 单棋子替换（owner）
        └── ImportTab.vue                # 批量导入 + AI 提示词（owner）
```
