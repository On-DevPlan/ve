# ShortcutLibrary 导入格式

支持通过 **TOML 文件**或**粘贴 TOML 文本**批量导入快捷键分组。

## 文件格式

TOML (Tom's Obvious, Minimal Language), UTF-8 编码。

```toml
[[groups]]
name = "分组名称"

[[groups.shortcuts]]
combo = "Ctrl+R"     # 组合键,用 + 连接
desc  = "打开目录"    # 说明(可选)
condition = "可选的激活条件备注"  # 例如 "选中数字时" / "仅 macOS"
```

## 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `[[groups]]` | 表数组 | 是 | 每个分组一个 `[[groups]]` |
| `name` | 字符串 | 是 | 分组名称,如 "VSCode"、"Chrome" |
| `[[groups.shortcuts]]` | 嵌套表数组 | 否 | 分组下的快捷键条目 |
| `combo` | 字符串 | 是 | 组合键(见下方),如 "Ctrl+R" |
| `desc` | 字符串 | 否 | 快捷键功能说明 |
| `condition` | 字符串 | 否 | 激活条件备注,运行时不做检查 |

`condition` 字段供用户记录"这条快捷键只在什么条件下成立",例如:

```toml
[[groups.shortcuts]]
combo = "Ctrl+Shift+Digit1"
desc = "上标"
condition = "选中文本时"
```

## 组合键写法

- 用 `+` 连接修饰键和主键,如 `Ctrl+Shift+P`
- 同一修饰键不分左右(均映射为 Left 侧)

### 支持的修饰键

| 写法 | 说明 |
|---|---|
| `Ctrl` | Control 键 |
| `Shift` | Shift 键 |
| `Alt` | Alt 键 |
| `⌘` | Meta/Command 键 |

### 支持的主键

| 类型 | 示例 |
|---|---|
| 字母 | `A` `B` … `Z`(大小写不敏感) |
| 数字 | `0` `1` … `9` |
| 功能键 | `F1` … `F12` |
| 方向键 | `↑` `↓` `←` `→` |
| 符号 | `-` `=` `[` `]` `\` `;` `'` `,` `.` `/` `` ` `` |
| 特殊键 | `Enter` `Esc` `Tab` `Space` `Backspace` `Delete` |

## 完整示例

```toml
# 我的快捷键库
[[groups]]
name = "VSCode"

[[groups.shortcuts]]
combo = "Ctrl+R"
desc = "打开目录"

[[groups.shortcuts]]
combo = "Ctrl+Shift+P"
desc = "命令面板"

[[groups.shortcuts]]
combo = "Ctrl+P"
desc = "文件搜索"

[[groups]]
name = "Chrome"

[[groups.shortcuts]]
combo = "Ctrl+T"
desc = "新建标签页"

[[groups.shortcuts]]
combo = "Ctrl+Shift+T"
desc = "恢复关闭标签页"

[[groups.shortcuts]]
combo = "Ctrl+D"
desc = "收藏当前页"

# 带激活条件的快捷键
[[groups]]
name = "Word"

[[groups.shortcuts]]
combo = "Ctrl+Shift+Digit1"
desc = "上标"
condition = "选中文本时"
```

## 导入行为

- **增量合并**:同名分组会将快捷键追加到该分组下;不存在的分组自动新建
- 每条快捷键自动分配唯一 ID,不会覆盖已有数据
- 文件大小限制: 1 MB

## 常见错误

| 错误 | 原因 |
|---|---|
| "组合键缺少主键" | combo 只写了修饰键,如 `Ctrl+Shift` |
| "无法识别的按键" | combo 中包含不支持的按键名 |
| "分组缺少 name 字段" | `[group]` 块内缺少 `name = "..."` |
| "未知字段" | `[[groups.shortcuts]]` 出现了 combo/desc/condition 之外的字段 |