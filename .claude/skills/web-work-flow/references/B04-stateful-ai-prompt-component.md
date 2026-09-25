---
ref: stateful-ai-prompt-component
parent: web-work-flow
updated: 2026-09-26
---

# 有状态 + AI 提示词输入组件范式

> 提炼自 **github-show / color-studio / shortcut-library** 三个组件的稳定共性。
> 当要新增一个「数据可编辑 + 跨会话/跨设备持久化 + 支持把外部混乱输入(截图/乱代码/文字描述/仓库数据)转成结构化数据」的组件时,按本范式搭骨架,不要从零发明。

## 范式总览(四层)

```
组件侧 (packages/react-components/src/<id>/)
  ├─ hooks/use<Xxx>.ts          ← 状态编排 + 存储通道选择(层1)
  ├─ storage/LocalStore.ts      ← 层1 本地降级通道(localStorage)
  │    (shortcut-library 放 engine/store.ts,同理)
  ├─ engine/import-parser.ts    ← 层2 TOML 子集解析(零依赖)
  ├─ engine/import-prompts.ts   ← 层3 FORMAT_PROMPT + 层4 buildXxxPrompt
  │    (color-studio 放 src/prompts/colorImportPrompt.ts)
  └─ pages|components/ImportModal.tsx  ← 导入框 UI(粘贴/文件 tab + 复制提示词 + 开关)

宿主业务封装 (apps/showcase/src/api/components/<id>/)
  ├─ create<Xxx>Store.ts        ← 层1 云端 KV 通道(单 key blob)
  ├─ types.ts                   ← 文档类型 + emptyDoc()
  └─ docSchema.ts               ← Zod schema(load 时校验兜底)
```

## 层1:状态持久化 —— 单 key JSON blob

整份文档作为**一个 JSON 字符串**读写 KV("single-blob" 模型),不做增量字段。

**云端通道**(`api/components/<id>/create<Xxx>Store.ts`):

- 单 key(`<component-id>`)+ 单 tag(`[component-id]`)+ 不传 groupId(走 caller 的 default_group_id)
- `load()`:`kvV1Service.get({ key })` → `JSON.parse` → `docSchema.parse`(Zod 校验)→ **任何失败兜底 emptyDoc,不崩**(ApiError code 50/404、脏 JSON、网络错误一律容错)
- `save()`:`kvV1Service.set({ key, value: JSON.stringify(doc), tags, ttl: 0 })`
- 工厂返回**独立闭包**不依赖 `this` —— 调用方常解构:`const { load, save } = createXxxStore()`
- 目录内部 import 走相对路径,**不用 `@api`**(self-cycle:`index.ts → components → createXxxStore → index`,见 B03)
- 范例:`createGithubShowStore.ts` / `createColorStudioStore.ts`

> **历史例外**:shortcut-library 的云端走 user-space 委托(`createUserSpaceStore().getShortcuts/setShortcuts`),是更早的设计;github-show / color-studio 直连 `kvV1Service` 是当前标准。新组件按后者。

**独立偏好另开 key**:用户偏好类状态(如 color-studio 的快捷键/复制格式偏好)不塞主文档 blob,单独 `create<Xxx>PrefsStore.ts` + 独立 KV key(如 `'ve-color-key'`)——偏好跨文档生效,主文档是数据。

**本地降级通道**(组件侧 `storage/LocalStore.ts`):

- localStorage 单 key,命名 `sl-<component-id>:v1`(带 schema 版本号,升级可迁移)
- 脏数据 / quota / private mode → 兜底空文档或静默忽略,**不崩**
- save 侧可加 debounce(shortcut-library 200ms)

**通道选择**(在 hook 里,不在 store 里):

```ts
// token 存在且 jwtAuthState === 'logged-in' → cloud store;否则 → 本地
const store = auth.token && auth.jwtAuthState === 'logged-in' ? cloudStore : lsStore;
```

游客数据落本地,登录后无缝迁回云端。UI 登录态条读 `store.authState`(本地 store 恒 `'logged-out'`)。

## 层2:TOML 导入 —— 组件自定义子集 + 零依赖解析器

- 每个组件定义**自己的 TOML 子集**:根表数组即实体(`[[projects]]` / `[[groups]]`+`[[groups.shortcuts]]` / `[[palettes]]`+`[[palettes.colors]]`),单行 `key = "value"`(双引号字符串 / 布尔 / 数字 / 字符串数组)
- 解析器放 `src/engine/import-parser.ts`,**零依赖**(行扫描 + 正则,~200 行);不要引入完整 TOML 库
- 容错语义:缺字段 → 默认值或跳过记 warning;未知 key → 自动建自定义列(github-show)或忽略;**收集 errors/warnings 返回,不抛异常**
- 同源不同义:**三个组件的 parser 结构同构但语义独立,禁止跨组件复用**——字段映射、容错策略各自演化
- 规范文档(如 shortcut-library 的 `IMPORT_FORMAT.md`)与 FORMAT_PROMPT 里的字段表**保持同步**,改格式两处一起改

## 层3:FORMAT_PROMPT —— 四段式固定结构

喂给任意 LLM 的格式说明常量,让 AI 产出本组件可导入的合规 TOML。用户流程:复制 → 贴给 AI(附混沌输入)→ AI 产 TOML → 粘回导入框。

**四段式结构(顺序固定)**:

1. **角色 + 任务**:「你是一个 XX 数据生成助手,产出符合以下规范的 TOML,用于导入到 XX 组件(一句话定位)」
2. **格式规范 + 字段表**:`# === 格式规范 ===`(根表名、编码、大小上限)+ `# === 字段表 ===`(每行:字段 / 类型 / 必填 / 说明,机器可直查)
3. **多场景示例**:2-3 个,从最小必填到完整字段 + 自定义扩展,覆盖典型用法
4. **反例 + 易错点放末尾**:`# === 不要这样写 ===` —— 放末尾降低 LLM「自由发挥」概率

**硬性约束**:

- 纯文本、**无 emoji**(提示词会作为 UI 的一部分展示/复制,项目风格约束)
- 输出要求必须写明:**只输出 TOML 文本、不要 markdown 代码块包裹、不要前言/解释**(用户复制时不需要三个反引号)
- 字符串转义规则写清楚(反斜杠/引号要转义,中文/全角/emoji 不用)
- 常量放 `engine/import-prompts.ts` 或 `prompts/colorImportPrompt.ts`,**不要内联在组件 JSX 里**(shortcut-library 历史原因内联在 ImportModal,新组件别学)

**导入框 UI**(ImportModal):

- 粘贴 / 文件两个 tab;文件拖拽用共享 FileDropZone(见 skill `shared-component-system`)
- 「复制格式提示词」按钮:`navigator.clipboard.writeText(FORMAT_PROMPT)`,独立 copied state 显示「已复制」反馈;clipboard 不可用时 fallback 隐藏 textarea + alert 让用户手动复制
- 解析预览区:导入前展示条数 / 警告(如「N 个 fork 仓库」)

## 层4:提示词开关 —— 选项驱动的 prompt builder

`buildXxxPrompt(opts): string`,**纯函数**(选项 in → 提示词文本 out),让用户用 UI 开关改写提示词内容。两种形态:

**形态 A:选项开关**(github-show 的 gh 仓库盘点):

```ts
interface GhPromptOptions {
  months: 3 | 6 | 12 | 24 | 36;      // 时间窗
  scope: 'mine' | 'mine+orgs';       // 仓库范围
  fork: 'exclude' | 'include';       // fork 处理
  visibility: 'all' | 'public';      // 可见性
}
```

UI select/radio ↔ 提示词行一一映射;选项变化点按钮即重新生成。适合「控制 AI 拉取什么数据」的场景。

**形态 B:增量提示词**(shortcut-library / color-studio 的「AI 增量提示词」):

把组件**当前已有数据**编进提示词,让 AI 产出与现状不冲突的增量:

1. 开头:角色 + 任务(「基于「组名/调色板名」的语义扩展」)
2. `# === 已有数据(严格避开) ===`:逐条列出已有条目(shortcut 列 combo 清单;palette 列 hex+weight+note+tags)
3. `# === 输出要求 ===`:避冲突指令 + name 必须为指定值 + 只输出 TOML
4. `# === TOML 格式规范 ===`:**FORMAT_PROMPT 完整原文附后**(复用层3,不重写)

适合「往已有数据里追加」的场景。按钮 disabled 条件 = 未选中目标组/调色板。

**通用细节**:

- 每个复制按钮**独立 copied state**(shortcut-library 专门注释过:避免和格式提示词按钮的反馈冲突)
- 提示词正文可以沉淀踩坑经验(github-show 在 buildGhReposPrompt 注释里记录 gh CLI 三个坑:`@me` 不可用须先 `gh api user`、`--arg` 必须在 `--jq` 前、macOS BSD date 用 `-v`)——提示词本身就是防坑知识的载体

## 新增此类组件 checklist

1. `apps/showcase/src/api/components/<id>/`:`types.ts`(文档类型 + `emptyDoc()`)→ `docSchema.ts`(Zod)→ `create<Xxx>Store.ts`(单 key blob 闭包工厂)
2. 组件侧 `storage/LocalStore.ts`(localStorage `sl-<id>:v1`,容错空文档)
3. `hooks/use<Xxx>.ts`:登录态 → cloud/local 通道选择;save 防抖看需求
4. `engine/import-parser.ts`:零依赖 TOML 子集解析,errors/warnings 不抛
5. `engine/import-prompts.ts`:四段式 FORMAT_PROMPT + `buildXxxPrompt`
6. `ImportModal`:粘贴/文件 tab + FileDropZone + 解析预览 + 复制提示词按钮(独立 copied state)
7. KV 复用现有 `kvV1` service,**不动 `registry.ts`**(除非有新后端路由)
8. 测试:store 的 load 兜底与 save 往返(`apps/showcase/__tests__/shortcut-library-store.test.ts` 是现成样板)

## 反例与易错

| 反例 | 后果 | 正确做法 |
| --- | --- | --- |
| 组件直接 `import { kvV1Service }` | 绕过业务封装,组件感知 KV 协议,无法本地/云端切换 | 组件只依赖 `load/save` 极简契约,KV 细节关在 `api/components/<id>/` |
| load/save 写成类方法且依赖 `this` | 调用方解构后 `this` 为 undefined,运行时崩 | 工厂内独立闭包 |
| 解析/加载失败抛异常 | 白屏 / 崩溃 | 兜底 emptyDoc + errors 列表 |
| 用户偏好塞主文档 blob | 文档被偏好污染,跨文档偏好无法共享 | 独立 KV key + PrefsStore |
| parser 跨组件抽公共库 | 字段语义漂移,一处改动崩三处 | 同构不同义,各写各的 |
| FORMAT_PROMPT 内联在 JSX | 组件文件膨胀,提示词无法被增量 builder 复用 | 独立常量文件,builder 拼接原文 |
| 两个复制按钮共用 copied state | 一个「已复制」另一个也亮 | 每按钮独立 state |
