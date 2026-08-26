# Color Studio

设计 / 前端用的色彩管理工作台 MVP-B。

## 路线

`/components/color-studio`

## 功能

- **HSB 圆盘** — SVG 实现,点击/拖拽选色,明度滑杆独立
- **多格式详情** — HEX / RGB / HSL / LAB / LCH / OKLCH 六格式并列,可编辑实时联动,WCAG AAA/AA 等级
- **调色板** — 多板 CRUD,色卡上下移排序,锁定 / 删除 / 标记
- **和声规则** — 5 种规则(互补 / 三角 / 类似 / 分裂互补 / 单色),色盘上叠加几何标记
- **屏幕取色** — 浏览器原生 EyeDropper API,不支持时降级提示
- **图像取色** — 上传图片,canvas 悬停取色 + K-means 主色提取
- **快速粘贴** — 底部输入条,支持 `hex / rgb / hsl / 颜色英文名`,空格 / 逗号分隔批量
- **取色历史** — 最近 12 个,FIFO
- **快捷键** — P (取色) / A (加入) / C (复制) / X (清历史)

## 持久化

`/api/v1/kv`,key `color-studio`,tag `['color-studio']`,走 caller `default_group_id`。整体文档 JSON 读写,无 6 KV 多键冲突。

完整文档类型在 `apps/showcase/src/api/components/color-studio/types.ts`,Zod 校验在 `docSchema.ts`。

## 本地开发

```bash
pnpm install
pnpm --filter @style-library/showcase dev
# 打开 http://localhost:5173/components/color-studio
```

## 不在本 PR 范围

Konva 笔刷、滤镜栈、比例视图、全局 Token、Pantone、IndexedDB 离线、跨标签页乐观锁 —— 见 `docs/superpowers/specs/2026-08-26-color-studio-design.md` §10。
