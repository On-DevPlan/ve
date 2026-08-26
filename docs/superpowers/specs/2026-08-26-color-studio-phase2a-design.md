# Color Studio Phase 2a Design(打磨 + 分组 + 快捷键存储 + autoFill + 导出)

> 续 `2026-08-26-color-studio-design.md`(MVP-B)。用户 2026-08-26 批准 Phase 2a 四节设计。
> Phase 2b(比例视图 + 全局 Token)、Phase 2c(滤镜 + 笔刷)后续 PR。

---

## 1. Schema v1.1.0(向后兼容)

```ts
interface ColorEntry {
  ...v1.0.0 fields
  group?: string;               // '品牌色'/'辅助色'/undefined=未分组
}

interface ColorStudioViewState {
  ...v1.0.0 fields
  groupBy: 'none' | 'group';    // 平铺 / 按组折叠
}
// meta.schemaVersion: '1.0.0' | '1.1.0'
```

**迁移**:`load()` 读到 1.0.0 文档 → 补 `group?: undefined`、`groupBy: 'none'`、schemaVersion 升 `'1.1.0'` → 正常返回(不强制立即写回,下次 save 自然持久化 1.1.0)。Zod schema 用 discriminated union 或 superRefine 兼容两版。

## 2. 快捷键自定义 —— 独立 KV key `ve-color-key`

```ts
// apps/showcase/src/api/components/color-studio/createShortcutPrefsStore.ts
export interface ShortcutPrefs {
  schemaVersion: '1.0.0';
  shortcuts: {
    eyedropper: string;    // 默认 'p'
    addColor: string;      // 默认 'a'
    copy: string;          // 默认 'c'
    clearHistory: string;  // 默认 'x'
  };
  updatedAt: number;
}
// createShortcutPrefsStore(): { load(): Promise<ShortcutPrefs>, save(p): Promise<void> }
// key='ve-color-key', tags=['color-studio'], code 50/404 → DEFAULT_SHORTCUTS
```

**为什么独立 key**:快捷键是用户偏好,跨文档生效;登录后 kvV1 按用户隔离天然同步。

**组件侧**:`useShortcutPrefs()` hook(mount load / 600ms debounce save);`useKeyboardShortcuts` 消费映射;`ShortcutEditor` UI(每动作一行,点键位框按新键,冲突检测)。

## 3. UI 系统

### Icon.tsx(零依赖 inline SVG)

18 个 icon:`eyedropper lock lockOpen trash plus copy download upload undo redo brush filter group palette chevronUp chevronDown close keyboard sync`。统一 `stroke="currentColor" strokeWidth={1.8} fill="none"` viewBox="0 0 24 24"。

### Btn.tsx

```tsx
<Btn variant="primary|secondary|ghost|danger" size="sm|md" icon="copy" disabled>复制</Btn>
```

全状态 CSS(hover/active/disabled/focus-visible)。所有裸 `<button>` 换 `<Btn>` 或补 `.sl-cs-btn` 类;`<input>` 统一 `.sl-cs-input`。

### 替换清单

- ColorChip:`🔒🔓` → `<Icon name="lock|lockOpen" size={12}/>`;`×` → `<Icon name="close"/>`
- PickerPanel:`🎯` → `<Icon name="eyedropper"/>`
- 其余文字按钮补 icon(复制/添加/导出等)

## 4. 和声 autoFill

`PaletteHarmony.autoFill: true` → anchor hex 变化时,派生色条目自动更新(保留 `derivedFrom` 标记,chip 上角标点显示派生关系)。实现:`useHarmony` 检测 anchor 变化,autoFill 开启则把新派生 hex 写回对应 colorEntries。UI:和声规则区加开关。

## 5. 导出 ExportModal

| 格式 | 输出 |
|---|---|
| CSS Variables | `--color-<palette>-<i>: #HEX;` |
| Tailwind | `theme.extend.colors.<palette>.<i>` 嵌套对象(JS 模块) |
| W3C Design Tokens | `{$value:{color:{...}}}` 结构 |
| JSON | 完整 ColorStudioDocument |

引擎层 `src/engine/exporters.ts` 纯函数(vitest 全覆盖);UI 层 ExportModal(格式 tabs + 预览 + 复制/下载)。入口:顶栏导出按钮。

## 6. 文件清单

```
新增:
  packages/react-components/src/color-studio/src/components/ui/Icon.tsx
  packages/react-components/src/color-studio/src/components/ui/Btn.tsx
  packages/react-components/src/color-studio/src/components/ExportModal.tsx
  packages/react-components/src/color-studio/src/components/ShortcutEditor.tsx
  packages/react-components/src/color-studio/src/engine/exporters.ts
  packages/react-components/src/color-studio/src/hooks/useShortcutPrefs.ts
  apps/showcase/src/api/components/color-studio/createShortcutPrefsStore.ts
  apps/showcase/__tests__/color-studio-shortcut-prefs.test.ts
  packages/react-components/__tests__/color-studio-exporters.test.ts
  packages/react-components/__tests__/color-studio-groups.test.ts

修改:
  types.ts / docSchema.ts                  → schema 1.1.0 + union 兼容
  ColorChip/PaletteSidebar/PickerPanel/KeyboardHints/QuickAddBar/ColorDetailPanel
                                           → Icon + Btn 替换;Sidebar 分组渲染
  useKeyboardShortcuts.ts                  → 消费 ShortcutPrefs
  useHarmony.ts                            → autoFill
  index.tsx / index.css                    → 顶栏导出 + 新组件 + ui css
```

## 7. 验证

1. lint 0 err;新增 ~20 vitest 用例
2. **KV 迁移回归**:1.0.0 旧文档 load → 字段补齐 → schemaVersion 1.1.0
3. 快捷键:改键 → 刷新保留;未登录改键不崩
4. 导出:四格式快照断言;下载文件内容正确
5. 浏览器:零 emoji、按钮全状态、分组折叠、autoFill 跟随

## 8. 不做(Phase 2b/2c)

比例视图、全局 Token 层、滤镜栈、Konva 笔刷、Pantone、IndexedDB、跨标签乐观锁。
