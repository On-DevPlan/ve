// component-contract —— 仓库内"组件协议"包的 TypeScript 类型契约。
// 对应 spec §4 ComponentConfig / §4.2 PreviewConfig / §4.3 RouteConfig /
//   §4.4 MountConfig / §4.5 IsolationConfig / §4.6 ThemeConfig / §5 Manifest。
//
// ⚠️ 字段名与 spec 严格对齐 —— 不要随意改名或加字段。
// 一旦类型变了,component-config.schema.json、manifest.schema.json、
//   packages/manifest-generator、packages/mount-adapters 都得跟着改。

// 组件所属的前端框架
export type Framework = 'vue' | 'react';

// 组件隔离模式
//   - shadow-dom:默认推荐,详情容器用 ShadowRoot 隔离
//   - css-module:组件内部用 CSS Modules,跨组件弱隔离
//   - global:逃生通道,只用于必须直接访问 document.body 的组件(如 Monaco)
export type IsolationMode = 'shadow-dom' | 'css-module' | 'global';

// 卡片预览配置(spec §4.2)
//   - 卡片只读这个结构,不读取 entry 对应实现
//   - 预览图必须是独立静态资源,不要靠"执行真实组件"生成
export interface PreviewConfig {
  image?: string; // 缩略图路径,相对于 component.config.ts
  width?: number; // 宽(像素)
  height?: number; // 高(像素)
  alt?: string; // 无障碍替代文本
  aspectRatio?: number; // 宽高比
  placeholder?: 'gradient' | 'skeleton' | 'icon'; // 占位策略
  lazy?: boolean; // 是否懒加载(默认 true)
}

// 路由 query 字段配置
export interface QueryFieldConfig {
  type: 'string' | 'number' | 'boolean'; // 字段类型
  default?: string | number | boolean; // 默认值
  required?: boolean; // 是否必填
}

// 路由配置(spec §4.3)
export interface RouteConfig {
  path: string; // 必须以 /components/ 开头
  title: string; // 详情页标题
  icon?: string; // 目录里的图标
  order?: number; // 排序权重(升序)
  hidden?: boolean; // 是否在默认目录隐藏(仍可被直接访问)
  keepAlive?: boolean; // 是否启用 keep-alive(默认 false,仅对评估过的组件开启)
  query?: Record<string, QueryFieldConfig>; // URL query 参数说明
}

// 挂载配置(spec §4.4)
export interface MountConfig {
  kind: Framework; // 框架
  exportName?: string; // 要挂载的具名导出,默认 'default'
  propsMode?: 'default' | 'interactive' | 'none'; // props 行为
  eventPrefix?: string; // 自定义事件前缀
  requiresReactRoot?: boolean; // React 是否需要 createRoot,默认 true
  unmountTimeoutMs?: number; // unmount 超时(毫秒)
}

// 隔离配置(spec §4.5)
export interface IsolationConfig {
  mode: IsolationMode; // 隔离模式
  open?: boolean; // ShadowRoot 是否 open,默认 true
  delegatesFocus?: boolean; // 是否委派 focus,默认 false
  adoptedStyleSheets?: boolean; // 是否用 Constructable Stylesheets,默认 true
  allowGlobalStyles?: boolean; // 是否允许写入全局样式,默认 false
  globalStyleReason?: string; // 开启 global 时必须填:为什么需要全局访问
}

// 主题配置(spec §4.6)
export interface ThemeConfig {
  mode: 'css-variables'; // 当前只支持 CSS Variables 主题
  namespace: string; // 主题 token 的命名空间,例如 'sl'
  requiredTokens?: string[]; // 必填 token,如 '--sl-color-primary'
  optionalTokens?: string[]; // 可选 token
  colorScheme?: 'light' | 'dark' | 'both'; // 支持的色彩方案
  styleEntry?: string; // 主题样式入口
}

// 主题运行时:Host 注入到 ShadowRoot 容器内
export interface ThemeRuntime {
  colorScheme: 'light' | 'dark'; // 当前激活的色板
  tokens: Record<string, string>; // token 名 → 值
  namespace: string; // 与 ThemeConfig.namespace 对应
}

// props 配置(spec §4.7)
export interface PropsConfig {
  defaults?: Record<string, unknown>; // 默认 props
  schema?: string; // props schema 文件路径(可选)
  editable?: boolean; // 详情页是否允许编辑 props
}

// 能力配置:声明组件支持哪些宿主交互(spec §4.7)
export interface CapabilityConfig {
  resizable?: boolean; // 容器可拖拽改变大小
  fullscreen?: boolean; // 支持全屏
  fullscreenMode?: 'container' | 'viewport'; // 全屏粒度
  hmr?: boolean; // 支持热更新
  emitsEvents?: boolean; // 组件会向 Host 抛事件
  supportsDarkMode?: boolean; // 内置暗色主题
}

// 依赖声明(spec §4.7)
export interface DependencyConfig {
  name: string; // 依赖名
  version: string; // SemVer 范围
  sharing: 'host' | 'component' | 'external'; // 是否与 Host 共享该依赖
}

// 文档链接(spec §4.7)
export interface DocsConfig {
  readme?: string; // README 路径
  story?: string; // Storybook 路径
  changelog?: string; // CHANGELOG 路径
}

// 目标运行平台:仅 PC,仅手机端,或双端
export type Platform = 'pc' | 'mobile' | 'both';

// 组件配置:作者维护的源数据(spec §4.1)
export interface ComponentConfig {
  id: string; // 全局唯一,kebab-case
  name: string; // 稳定技术名称
  title: string; // 卡片与详情页标题
  description: string; // 简介
  version: string; // SemVer,如 1.0.0
  framework: Framework; // 所属框架
  entry: string; // 相对 config 文件的实现入口
  group: string; // 一级分组
  category: string; // 二级分类
  tags: string[]; // 检索标签
  platform?: Platform; // 目标运行平台(默认 'both')
  status?: 'stable' | 'experimental' | 'deprecated'; // 状态
  preview?: PreviewConfig; // 卡片预览配置
  route?: RouteConfig; // 路由配置
  mount: MountConfig; // 挂载配置(必填)
  isolation?: IsolationConfig; // 隔离配置
  theme?: ThemeConfig; // 主题配置
  props?: PropsConfig; // props 配置
  dependencies?: DependencyConfig[]; // 依赖列表
  capabilities?: CapabilityConfig; // 能力声明
  docs?: DocsConfig; // 文档链接
  /**
   * 可选:远程组件加载 URL。
   *
   * 大多数组件不需要本字段:apps/showcase 的 loaders.ts 用 import.meta.glob
   * 自动扫描 packages/{vue,react}-components/src/<id>/index.{vue,tsx},生成
   * 静态 import() 映射(各组件打成独立 chunk)。
   *
   * 只有以下场景需要手工声明 loaderUrl:
   *   1. 远程 CDN 组件(Module Federation / 静态 CDN)
   *   2. 不在默认目录约定的组件(自定义 monorepo 结构)
   *   3. 来自外部 npm 包而非本仓库源码
   *
   * 提供后,loaders.ts 的 setLoaders(manifest) 会用 () => import(loaderUrl)
   * 覆盖 glob 自动发现的条目。
   */
  loaderUrl?: string;
}

// 元数据过滤:Registry / SearchIndex 查询参数(spec §7)
export interface MetadataFilter {
  group?: string; // 一级分组
  category?: string; // 二级分类
  status?: ComponentConfig['status']; // 状态
  query?: string; // 关键字
}

// 搜索结果项
export interface SearchResult {
  id: string; // 组件 id
  score: number; // 命中分数
  matchedFields: string[]; // 命中的字段名列表
}

// 搜索索引配置(spec §5)
export interface SearchManifest {
  fields: Array<'title' | 'description' | 'tags' | 'group' | 'category'>; // 可被搜索的字段
  normalized: boolean; // 是否做了标准化(大小写、空格)
  index?: string; // 可选索引文件名
}

// manifest 单条组件记录(spec §5)
// 卡片只读这个结构,绝对不触发 entry.loader()
export interface ManifestEntry {
  id: string;
  name: string;
  title: string;
  description: string;
  version: string;
  framework: Framework;
  group: string;
  category: string;
  tags: string[];
  status: ComponentConfig['status'];
  platform: Required<ComponentConfig>['platform'];
  preview?: PreviewConfig;
  route: RouteConfig;
  mount: MountConfig;
  isolation: IsolationConfig;
  theme?: ThemeConfig;
  capabilities?: CapabilityConfig;
  assets: {
    entryChunk: string; // 详情页异步加载的入口 chunk
    cssChunks?: string[]; // 伴随入口的 CSS 列表
    preview?: string; // 卡片缩略图(运行时 URL)
  };
  loaderKey: string; // 详情页查 loaders[id] 的 key
  /**
   * 可选:远程 loader URL(从 ComponentConfig.loaderUrl 透传)。
   * loaders.ts 的 setLoaders 见此字段则用 import(loaderUrl) 覆盖 glob 条目,
   * 否则走 import.meta.glob 自动发现的本地组件。
   */
  loaderUrl?: string;
}

// manifest 分组
export interface ManifestGroup {
  id: string;
  title: string;
  componentIds: string[]; // 该分组下的组件 id 列表
  categories: string[]; // 该分组下的二级分类
}

// 完整 manifest(spec §5)
export interface ComponentManifest {
  schemaVersion: '1.0'; // 当前固定为 '1.0'
  generatedAt: string; // ISO 时间戳
  buildId: string; // 构建 id,便于 dev/prod 比对
  components: ManifestEntry[]; // 全部组件条目
  groups: ManifestGroup[]; // 分组信息
  search: SearchManifest; // 搜索配置
}

// 挂载上下文:详情容器 → adapter 的输入(spec §4.4)
export interface MountContext {
  container: HTMLElement; // 详情页内的真实 DOM 容器
  shadowRoot: ShadowRoot; // 隔离用的 ShadowRoot
  props: Record<string, unknown>; // 组件 props
  theme: ThemeRuntime; // 主题运行时
  signal: AbortSignal; // 路由切换时的取消信号
}

// 已挂载组件句柄:adapter 返回给 Host(spec §4.4)
export interface MountedComponent {
  update?(props: Record<string, unknown>): void | Promise<void>; // 可选:更新 props
  unmount(): void | Promise<void>; // 必须:卸载,释放资源
}

// 统一挂载协议(spec §4.4)
export interface MountAdapter {
  canHandle(framework: Framework): boolean; // 判断能否处理该框架
  mount(
    module: unknown, // 来自 entry.loader() 的 ESM 模块
    context: MountContext,
  ): Promise<MountedComponent>;
}