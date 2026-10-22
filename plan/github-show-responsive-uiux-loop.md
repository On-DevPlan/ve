# github-show 响应式 / UIUX 优化循环

- 目标:继续优化 `packages/react-components/src/github-show` 的响应式与 UI/UX
- 轮次:8 轮(仅轮次模式,无完成承诺词)
- 机制:用户要求 `nx-rp loop 8次`;本机 nx-rp 0.4.1(最新发布版)尚无 `loop` 子命令,
  退化为会话内联循环 —— 状态全部落在本文件,每轮「问题 → 改动 → 验证」追加记录
- 设计语言约束(墨线 v1.6.32+):零投影/零渐变;线分三级 rule .42 / line .24 / hair .10-.14;
  绿 #177F37 只留 4 处(主按钮/输入焦点/提交总数/热力图);类名 `sl-gh-` 前缀

## 基线(循环开始前已完成,不算轮次)

- v1.6.47:编辑态行高内容驱动(原 35px 定高钳成 2 行)+ ≤768px 两表卡片化 +
  顶栏搜索弹性 + 分页折行 + root/宿主 100dvh
- 验证基线:全量 vitest 909 通过 / 5 存量失败(renewal 网络探测 ×2、localstore schema
  断言过期 ×1、e2e-perf 读过期 dist ×2);tsc 10 个存量 github-show 类型错误
  (onMoveRowTo 不在 props 接口等,均在基线存在)
- 本会话已知问题:chrome-devtools MCP 的 take_screenshot 会挂起,验证一律用
  take_snapshot + evaluate_script 读几何/computed style

## 候选 backlog(每轮取一,做完挪到下方「已完成」)

1. 移动端触控目标:上移/下移 24×26、删除 26×26、抓手 13px、页码 28px —— 全部低于
   44px 触控推荐值;LinkCell 编辑按钮 hover 才显,触屏不可达
2. 移动端顶栏 152px(3 行)偏挤:搜索框与切换组同行,按钮组换行松散
3. 平板带 769–1100px:编辑表固定列宽 300/170/280/280(共 1030px+44)仍重横滚
4. 移动端分页折行后 56px:跳转段在窄屏价值低,可收起;条数下拉 72px 可紧凑
5. 弹窗移动端:backdrop padding 24px 贴边不足、modal max-height 80vh(应 dvh)、
   ImportModal 620px 宽版、列设置行在窄屏挤压
6. 图表 tab 移动端:统计卡数字 26px/两列尚可,图表高度 clamp(150px,24vh,220px)
   在矮屏过矮,ECharts legend/轴标签在 ~350px 容器内的可读性
7. 热力图移动端 53 列横滚无任何可视提示(渐隐遮罩/提示文案)
8. 空态/错误态移动端 padding 64px 偏大、三按钮组换行表现;focus-visible 统一

## 已完成

### 第 1 轮:移动端触控目标(v1.6.48)
- 问题:上移/下移 24×26、删除 26×26、抓手宽 13、页码钮 28×28,全部低于 44px
  触控推荐值;LinkCell 编辑钮 hover 显形,触屏不可达
- 改动:≤768px 内 `.sl-gh-move/.sl-gh-del` → 38×38,`.sl-gh-grip` 宽 22(URL 格
  padding-left 24→30),`.sl-gh-pager__btn` 34×34、`__nav` 32×34,
  `.sl-gh-linkcell__edit` 触屏常显
- 验证:evaluate_script 实测 38×38 / 34×34 / 22px / padding 30px;root 无横向溢出 ✔

### 第 2 轮:移动端顶栏三行重排(v1.6.48)
- 问题:顶栏四行 152px —— [标题] [切换+搜索] [状态+登录+导入+列设置] [添加项目]
- 改动:index.tsx 三个操作钮加 `data-topbtn="import|columns|add"`;CSS ≤768px 用
  `display: contents` 提升右侧容器 + order 重排成 [标题+切换] [搜索+添加项目]
  [状态+导入+列设置];按钮 padding 0 12→10、pill 收紧;foot padding 10→8
- 验证:390px 实测 topbarH 152→119,三行分布正确(搜索+添加 / 状态+导入+列设置);
  display 视图无搜索/操作钮自然塌两行;root 无横向溢出 ✔

### 第 3 轮:平板带 769–1100px 列宽自适应(v1.6.48)
- 问题:编辑表内建列固定 300/170/280/280,900px 视口横滚量 1171 vs 856(315px 隐藏)
- 改动:新增 `@media (769–1100px)` 用 clamp 定义 `--sl-gh-col-w-__builtin_*`
  (repoUrl 28vw / name 15vw / highlights·insights 22vw,上限即桌面值);
  无持久化列宽时内联 var() 落到样式表值,拖过的用户宽度 inline 优先不受影响
- 验证:900px 实测 252/135/198/198/80/44,横滚量 924 vs 856(315→68px);
  1100px 以上 clamp 全到上限与桌面零差异 ✔

### 第 4 轮:移动端分页单行紧凑(v1.6.48)
- 问题:移动端分页折成两行 62px;跳转段(跳转至[n]页)在触屏价值最低
- 改动:≤768px 隐藏 `__jump` 与空占位 `__side`(空 span 也生成一行),条数下拉
  72→64px;右段可折行兜底长页码列表
- 验证:390px 实测单行(grid rows 38px,总高 58 含 padding;38 = 第 1 轮放大的
  34px 页码钮 + 轨道 padding,触控与紧凑兼得);root 无溢出 ✔

### 第 5 轮:弹窗/浮层窄屏形态(v1.6.48)
- 问题:backdrop padding 24px 贴边不足;modal max-height 80vh(键盘弹起不适配);
  分享弹层 360px 绝对定位气泡锚在顶栏按钮上,窄屏必然越出视口
- 改动:≤768px backdrop padding 12px、modal 85dvh、分享弹层改 fixed 底部停靠
  (left/right/bottom 12px,宽自适应;ShadowRoot 内无 transform 祖先,
  containing block = 视口)
- 验证:探针元素实测 fixed 12px 四边、宽 366 视口内;modal maxH 717px = 85dvh ✔

### 第 6 轮:图表 tab 窄屏收紧(v1.6.48)
- 问题:统计卡数字 26px/间距 16px 在 362px 两列下顶边;柱状图 12 根轴标签
  在 ~350px 容器不可读
- 改动:CSS 统计卡数字 22px、dstats/dcharts 间距 16→10、卡片 padding 收紧;
  DisplayView 新增 useIsNarrowViewport(≤768px,matchMedia 双守卫 jsdom),
  柱状图窄视口只画 6 个项目(contentChartData(doc, 6))
- 验证:390px 实测统计两列 176px、数字 22px、图表 337×203;root 无溢出 ✔

### 第 7 轮:热力图滚动提示(v1.6.48)
- 问题:53 列热力图窄屏必横滚,容器 overflow-x:auto 无任何可视滚动提示
- 改动:≤768px `.sl-gh-gstat__heatcard::after` 一行小字「← 左右滑动查看全年」;
  它在滚动容器内,开始滑动后随内容移出视口自然让位
- 验证:游客态无统计数据时 CommitStats 整体不渲染(hasGstat=false),用探针元素
  实测规则生效(content/10px/tertiary 色);有数据渲染时即带提示 ✔

### 第 8 轮:空态收紧 + 键盘焦点统一 + 全视口回归(v1.6.48)
- 问题:空态 64px 大留白把手机首屏推得过低;页码/切换/操作钮只有 UA 默认焦点环,
  ShadowRoot 内表现参差
- 改动:≤768px 空态 padding 64→40;媒体查询之外给 9 类交互件统一
  `:focus-visible` 1px 主色描边(与输入框焦点同语汇,桌面键盘导航同受益)
- 验证(全视口回归扫描):
  - 390 展示:顶栏 80px 两行、卡片表无溢出、分页单行、root 恰满视口 ✔
  - 768:卡片模式仍生效(≤768 边界)✔
  - 769:表格模式 + 自绘横滚条正常出现 ✔
  - 900 编辑:横滚量 68px(第 3 轮)✔
  - 1280 桌面:grid 300/170/280/280/162/44 与基线逐像素一致、顶栏单行 55px、
    操作钮保持 24×26(触控放大只在移动端)、无溢出 ✔
  - eslint 改动文件 0 错误 0 警告;全量 vitest 909 通过 / 5 存量失败 = 基线,零新增 ✔

## 总结(8/8 完成)

8 轮全部完成,改动集中在一个媒体查询体系 + 两个小组件文件:
- CSS(index.css):触控目标放大、顶栏 display:contents 重排、平板列宽 clamp、
  分页单行化、弹窗/分享浮层窄屏形态、热力图滚动提示、空态收紧、focus-visible 统一
- TSX:index.tsx 加 data-topbtn(order 重排锚点);DisplayView 加 useIsNarrowViewport
  (窄视口柱状图 6 根)与 td data-label;GithubShowTable 的 data-label 与
  ResizeObserver(v1.6.47 基线轮)
- 回归:桌面(>1100px)与基线零差异;769/768 断点边界正确;测试与 lint 无新增失败

---

## 追加轮次(用户反馈:移动端编辑板块不好操作、太狭窄)

### 第 9 轮:移动端编辑输入件放大 + flex-shrink 轨道压缩修复(v1.6.49)

**问题 A:输入件太小(12px 字号 / ~17px 高 / 格距 3px)**
- 12px 正踩 iOS Safari 硬规则:font-size<16px 的输入框聚焦时强制整页缩放,排版打散
- 改动:输入件(含多选内联 input)16px + min-height 40px + height:auto;
  格 padding 7/10→10/12、字段间距 3→5(块排 margin-bottom 5px);
  顶栏搜索框 16px / 36px
- 结构调整:卡片格从纵向 flex 退化为块排(标签一行 + 控件一行)—— 实验发现
  Chrome 对「列向 flex + 定高 textarea」的轨道内在尺寸贡献算错(5 行内容
  轨道只给 129px),块排不经过 flex 尺寸链,textarea 定高直接撑格子

**问题 B(深挖出的根因):flex-shrink 压缩 grid 轨道**
- 现象:textarea inline 高 128px 实际渲染 93px;轨道总和恒等于容器高(597),
  内容实际需要 645,内滚 overflow-y:auto 从未接管
- 二分实验:overflow-y / align-content 均无关;`flex: none` 后轨道立刻回 645
- 结论:v1.6.47 行高内容化后,行多/行长必然使表格内容超过 flex 分配高度,
  flex-shrink 一压缩表格,Chrome 把 auto 轨道直接压进容器高度 → 行间叠压
- 修复:`.sl-gh-table` 与 `.sl-gh-dtable-wrap` 的 `flex: 1 1 auto → 1 0 auto`
  (可 grow 填满一屏、绝不 shrink;放不下时落回 root 整页滚动)。
  桌面同步受益 —— 压缩 bug 在桌面行多时同样潜伏(此前 1 行数据没暴露)

**验证**
- 390px:轨道 [76,76,164,142,78,59,52] 全部 = 内容尺寸;textarea 128px 完整渲染
  于 164px 格内(taInsideCell true);root 整页滚动 48px 承接超出
- 1280px 桌面:行高 103px、表格 714px 填满一屏、分页/foot 位置不变、无滚动
  —— 一屏设计在内容放得下时完整保留
- vitest github-show 三件套:21 通过 / 1 存量失败(localstore schemaVersion 断言)零新增







### 追加:删除底部 foot(v1.6.49)
- 用户指令:删除 `<footer class="sl-gh-foot">数据整体保存在一个云端 key…</footer>`
- 改动:index.tsx 移除 footer JSX(含 readOnly 分支的公开分享提示);index.css 删除
  `.sl-gh-foot` 基础规则与 ≤768px 内的 padding 覆盖(全部引用,无残留)
- 验证:grep 无 sl-gh-foot 引用(footrow 合计行无关);eslint 0/0;schema 测试 12/12

### 追加:移动端顶栏排布修正(v1.6.49)
- 用户反馈:顶栏排布奇怪(贴出登录态 DOM)
- 根因:顶栏基础规则 `justify-content: space-between` —— display:contents 后
  每个折行都被两端对齐摊开:第三行三个按钮 45/57/85 宽配 88px 大缝,
  标题行与切换组之间空心
- 修复:≤768px `justify-content: flex-start` 全行左聚拢;主按钮
  `.sl-gh-topbar__right > .sl-gh-btn--primary` margin-left:auto 推到行尾压轴;
  同时废弃 v1.6.48 的 order 重排(添加项目与操作按钮分离、分组散),
  改按 DOM 自然顺序折行:[标题+切换] [搜索+同步状态] [分享+导入+列设置+添加项目];
  data-topbtn 锚点随之移除(JSX 还原)
- 验证:390px 编辑态三行 [标题+切换@聚拢] [搜索(撑满)+pill] [导入@14+列设置@67+添加项目@行尾291];
  展示态塌两行 80px;root 无溢出;index.tsx 仅剩 foot 删除 diff,eslint 0/0

### 追加:移动端顶栏「搜索一行 + 工具栏一行」(v1.6.49)
- 用户指令:搜索放一行,工具栏放一行
- 改动:
  - 搜索 `flex: 1 1 150px → 1 1 100%` 独占整行(362px 满宽)
  - 视图切换 `margin-left: auto` 贴右缘(经典 app header 形态)
  - 状态/分享/导入/列设置/添加项目 聚成一条工具栏行;主按钮 margin-left:auto 行尾压轴
  - ShareButton「设为公开分享」/ SyncPill「游客模式 · 本机保存」加长短双标签
    (span 切换,≤768px 用短标签「分享」「游客」;完整语义留在 title / 弹层)
- 验证:
  - 390px 游客态三行:①标题@14+切换@264(贴右) ②搜索@14 w362 满宽独占
    ③工具栏 pill@14 + 导入@98 + 列设置@151 + 添加项目@291(行尾压轴,右缘 376)
  - 390px 登录态探针:多一个「分享」45px 后整行仍 ≤362,右缘 376 不溢出
  - 1280px 桌面:topbar 55px 单行、space-between、长文案显示、pill 163px 与改前一致 ✔
  - eslint 0/0;github-show 测试 18/18 通过
