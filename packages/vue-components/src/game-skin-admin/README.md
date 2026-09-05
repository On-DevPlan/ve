# game-skin-admin

游戏资产管理（单组件）：对局皮肤 · 游戏封面 · 表情包。

- `GAME_SKIN_REGISTRY`：`chess` / `gomoku` 对局皮肤 + `game-center`（封面，列表隐藏）
- `EMOJI_SCOPE_REGISTRY`：`common` + 各 gameId 表情作用域
- 主 tab：`游戏` | `游戏封面` | `表情包`
- 深链：`?game=gomoku` · `?tab=covers` · `?tab=emoji&scope=chess`

## 数据流

```
皮肤：loadIndex → GET /api/v1/kv/<game>_skin:index?groupId=190
表情：loadIndex → GET /api/v1/kv/emoji_<scope>:index?groupId=190
上传：POST /files（tags）→ POST /kv →（删旧 file best-effort）
```

## 目录

```
game-skin-admin/
├── component.config.ts
├── index.vue
└── src/
    ├── composables/
    │   ├── gameSkinRegistry.ts
    │   ├── useSkinAdmin.ts
    │   ├── emojiRegistry.ts
    │   └── useEmojiAdmin.ts
    └── views/
        ├── GameListView.vue
        ├── GameDetail.vue
        ├── CoversListView.vue
        ├── PreviewTab / ReplaceTab / ImportTab
        ├── EmojiListView.vue
        ├── EmojiPackListView.vue
        └── EmojiUploadModal.vue
```
