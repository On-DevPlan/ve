# game-skin-admin

跨游戏皮肤管理（单组件 + 游戏切换器，不再为每游戏新建目录）。

- `GAME_SKIN_REGISTRY`：`chess`（12 枚）+ `gomoku`（黑/白/棋盘）两条目；单点派生 `kvIndexKey / tagPrefix / groupId / assetKeys / fileNames / gridColumns / aiPrompt`。
- `useSkinAdmin(config)` 工厂：chess 原 `useChessSkinAdmin` 的游戏无关版，KV key / tag / assetKeys 均由 registry 条目注入；`fileV1/kvV1` 导入保持不变。
- 游戏切换：`?game=gomoku` deep-link；header game switcher 可切换，tab 与 index 自动重载。
- 旧 `chess-skin-admin` 目录保留为**薄重定向**（见下方），manifest 扫描保留旧 id 以避免 dev watcher 抖动；新 id `game-skin-admin`。

## 数据流

```
loadIndex()  → GET /api/v1/kv/<game>_skin:index?groupId=190
replacePiece(skinId, assetKey, blob) → POST /files (tags=[<game>-skin, <game>-skin:<id>, <game>-skin:<id>:<key>]) → POST /kv → DELETE old file (best-effort)
deleteSkin   → 并发 DELETE /files → 全部成功才 POST /kv（移除条目）
```

## 目录

```
game-skin-admin/
├── component.config.ts
├── index.vue                 # 顶层 + game switcher + ?game deep-link
└── src/
    ├── composables/
    │   ├── gameSkinRegistry.ts
    │   └── useSkinAdmin.ts
    └── views/
        ├── PreviewTab.vue
        ├── ReplaceTab.vue
        └── ImportTab.vue
```
