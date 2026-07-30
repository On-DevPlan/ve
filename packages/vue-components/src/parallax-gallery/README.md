# parallax-gallery

瀑布流(masonry)+ 滚动视差画廓。模仿 `ghost-huang-monorepo` 的 `ConcertItemSection` + `ParallaxCard`。

## 效果

- **瀑布流布局**:可见项 ≥ 5 → CSS `column-count`;< 5 → flex grid。页面内 `精选 / 全部` 按钮可切换,直观对比两种布局。
- **Safari 退回手动瀑布流**:Safari 上 `column-count` 渲染不稳,改用「找最短列」+ 绝对定位算法(`calculateMasonry`)。
- **视差滚动**:每张卡片背景层比卡片高 40%,随卡片在视口中的进度 `translateY`,前景不动 → 速度差。`IntersectionObserver` 控制仅视口内卡片挂 scroll 监听。
- **错落入场**:`.sl-pg-item` 进入视口时加 `.is-visible`,`transition-delay = min(index, 6) × 70ms`,等价原版 v-motion 的 `:delay="Math.min(index * 70, 420)"`。

## 文件

| 文件 | 职责 |
|------|------|
| `index.vue` | 数据 fetch、布局切换、Safari 手动瀑布、错落入场 |
| `ParallaxCard.vue` | 单卡视差(背景平移 + IntersectionObserver) |
| `component.config.ts` | 组件元数据 |

## 测试图片

图片由 `.tool/image-gen` 生成,产物在 `apps/showcase/public/gallery/`:

- `gallery-01.jpg` … `gallery-09.jpg`:不同宽高比的渐变图(2:3 / 9:16 / 1:1 / 4:3 / 3:2 …)
- `gallery.json`:数据清单,组件运行时 `fetch('/gallery/gallery.json')`

重新生成:

```bash
cd .tool/image-gen
uv run python3 scripts/gen_gallery.py
```

## 与原版的差异

- 无 `v-motion` 依赖 → 用原生 `IntersectionObserver` + CSS transition 实现错落入场。
- 背景高度用 `cardHeight × 1.4` 固定倍率,不依赖图片原始分辨率。
- 卡片高度按图片宽高比分档给定(竖图高、横图矮),稳定错落,无 `Math.random`。
