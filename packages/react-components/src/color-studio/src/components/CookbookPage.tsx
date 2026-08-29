// packages/react-components/src/color-studio/src/components/CookbookPage.tsx
//
// Color Studio 色彩原理文档页(全屏覆盖)。
// 三章:①色彩基础(HSB / 色轮) ②锚色与和声 ③滤镜参数。
// 内容与代码对齐:和声角度表、滤镜范围取自真实实现。

import { useState } from 'react';
import { Icon } from './ui/Icon';
import { Btn } from './ui/Btn';

interface Props {
  open: boolean;
  onClose: () => void;
}

type ChapterId = 'basics' | 'harmony' | 'filters';

interface Chapter {
  id: ChapterId;
  title: string;
  brief: string;
}

const CHAPTERS: Chapter[] = [
  { id: 'basics', title: '色彩基础', brief: 'HSB / 色轮 / 格式' },
  { id: 'harmony', title: '锚色与和声', brief: '5 种规则与场景' },
  { id: 'filters', title: '滤镜', brief: '7 种参数与场景' },
];

export function CookbookPage({ open, onClose }: Props) {
  const [chapter, setChapter] = useState<ChapterId>('basics');

  if (!open) return null;

  return (
    <div className="sl-cs-cookbook" role="dialog" aria-modal="true" aria-label="Color Studio Cookbook">
      <header className="sl-cs-cookbook__head">
        <h2>
          <Icon name="book" size={16} /> Color Studio Cookbook
        </h2>
        <Btn
          variant="ghost"
          size="sm"
          iconOnly
          icon="close"
          onClick={onClose}
          aria-label="关闭"
          className="sl-cs-cookbook__close"
        />
      </header>

      <div className="sl-cs-cookbook__body">
        <nav className="sl-cs-cookbook__nav" aria-label="章节">
          <ul>
            {CHAPTERS.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`sl-cs-cookbook__navbtn ${chapter === c.id ? 'is-active' : ''}`}
                  onClick={() => setChapter(c.id)}
                >
                  <span className="sl-cs-cookbook__navnum">{String(i + 1).padStart(2, '0')}</span>
                  <span className="sl-cs-cookbook__navtitle">{c.title}</span>
                  <span className="sl-cs-cookbook__navbrief">{c.brief}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <article className="sl-cs-cookbook__article">
          {chapter === 'basics' && <BasicsChapter />}
          {chapter === 'harmony' && <HarmonyChapter />}
          {chapter === 'filters' && <FiltersChapter />}
        </article>
      </div>
    </div>
  );
}

/* ── 第一章:色彩基础 ─────────────────────────────────────────── */

function BasicsChapter() {
  return (
    <Section title="色彩基础" subtitle="HSB、色轮与色彩格式">
      <Block title="色彩三要素(HSB)">
        <ul>
          <li><b>Hue 色相</b>:颜色种类,0° 红 → 120° 绿 → 240° 蓝 → 360° 回到红。</li>
          <li><b>Saturation 饱和度</b>:颜色纯度,0% 灰 → 100% 纯色。</li>
          <li><b>Brightness 明度</b>:明暗,0% 黑 → 100% 亮。</li>
        </ul>
      </Block>

      <Block title="色盘上的映射">
        <p>
          Color Studio 色盘用 <b>角度=色相</b>、<b>半径=饱和度</b>、<b>明度滑杆</b>控制明度。
          中心是灰白(s=0),边缘是全饱和纯色(s=1)。
        </p>
      </Block>

      <Block title="详情面板格式">
        <p>详情面板支持 6 种格式互转:HEX / RGB / HSL / LAB / LCH / OKLCH。复制按钮以你选的格式复制(所见即所复制)。</p>
        <ul>
          <li><b>HEX/RGB</b>:屏幕常用,直观。</li>
          <li><b>HSL</b>:色相/饱和度/明度,适合和声计算(本组件的 5 种和声规则都在 HSL 空间生成)。</li>
          <li><b>LAB / LCH</b>:感知均匀,做色彩对比与色差计算更准。</li>
          <li><b>OKLCH</b>:现代感知色彩空间,渐变与暗色模式更友好。</li>
        </ul>
      </Block>

      <Block title="WCAG 对比度">
        <p>
          详情面板底部显示当前色对黑/对白的 WCAG 等级(AAA/AA/AA Large/A)。
          一般 UI 正文建议 ≥ AA(对比度 ≥ 4.5);标题/大字 ≥ AA Large(3.0)。
        </p>
      </Block>
    </Section>
  );
}

/* ── 第二章:锚色与和声 ───────────────────────────────────────── */

function HarmonyChapter() {
  return (
    <Section title="锚色与和声" subtitle="5 种规则各自的生成机制与最佳场景">
      <Block title="什么是锚色(anchor)">
        <p>
          锚色是派生规则的基准色。色盘上的标记:
        </p>
        <ul>
          <li><b>实心白边点</b>:当前选中色卡(锚点)在色盘上的位置。</li>
          <li><b>空心小圆点</b>:派生色在色盘上的预测位置 —— 角度相对锚点色相偏移,深度=锚点饱和度。</li>
          <li><b>单色规则</b>不画点,改画 4 圈同心虚线圆(明度梯度示意)。</li>
        </ul>
        <p>
          锚色变化时,派生色跟着变(开 autoFill 时实时落色)。
        </p>
      </Block>

      <Block title="5 种和声规则">
        <table className="sl-cs-cookbook__table">
          <thead>
            <tr><th>规则</th><th>色相偏移</th><th>输出数</th><th>视觉特征</th></tr>
          </thead>
          <tbody>
            <tr><td>互补</td><td>+180°</td><td>2</td><td>最强对比、对立感</td></tr>
            <tr><td>三角</td><td>+120° / +240°</td><td>3</td><td>平衡又有活力</td></tr>
            <tr><td>分裂互补</td><td>+150° / +210°</td><td>3</td><td>互补的柔和版,有对比但不刺眼</td></tr>
            <tr><td>类似</td><td>−30° / +30°</td><td>3</td><td>和谐统一,缺乏对比</td></tr>
            <tr><td>单色</td><td>(仅明度)</td><td>5</td><td>最稳,靠明度层次</td></tr>
          </tbody>
        </table>
      </Block>

      <RuleScenarios />
    </Section>
  );
}

function RuleScenarios() {
  return (
    <>
      <Block title="互补 — 最强对比">
        <p><b>适合:</b>CTA 按钮、强调文字、单点焦点的品牌色、传单/海报主色。</p>
        <p><b>场景感:</b>咖啡店的&quot;特价标签&quot;、电商主按钮、科技品牌的强调色(蓝↔橙)。</p>
        <p><b>注意:</b>50/50 平分会很扎眼;建议主色 70%,补色 30%,或用其中一色做背景/边框。</p>
      </Block>

      <Block title="三角 — 平衡又活泼">
        <p><b>适合:</b>插画、卡通/儿童向、游戏 UI、品牌主辅色搭配(3 色主题)。</p>
        <p><b>场景感:</b>儿童 App 主题色、环保品牌(绿/黄/蓝)、节日运营活动。</p>
        <p><b>注意:</b>三色均匀也容易乱;通常选一色作主(60%),其他两色作辅(各 20%)。</p>
      </Block>

      <Block title="分裂互补 — 互补的柔和版">
        <p><b>适合:</b>UI 主题(背景+强调)、仪表盘、报告图表、整体品牌的进阶版。</p>
        <p><b>场景感:</b>软件品牌色(Slack 紫)、数据可视化&quot;主+辅1+辅2&quot;、广告 banner。</p>
        <p><b>推荐:</b>这是 <b>最常用</b> 的进阶选择 —— 有对比,但不刺眼;比互补稳、比三角有对比。</p>
      </Block>

      <Block title="类似 — 和谐统一">
        <p><b>适合:</b>背景、渐变、大面积氛围色、UI 中性区、轻盈插画。</p>
        <p><b>场景感:</b>登录页背景渐变、阅读类 App、冥想/健康类品牌。</p>
        <p><b>注意:</b>类似色对比度低,文字层需要靠 <b>明度差</b> 拉开(深底浅字)。</p>
      </Block>

      <Block title="单色 — 最稳的选择">
        <p><b>适合:</b>极简风、数据可视化(同系列多档)、状态色(深浅表示重要性)、表单 hover/disabled。</p>
        <p><b>场景感:</b>企业 SaaS 主色(蓝色 + 5 档明度)、Material/iOS 风格按钮、可访问性高的 UI。</p>
        <p><b>注意:</b>全靠明度,中间档容易糊在一起;建议跳档(用 1/3/5 档而非 2/3/4)。</p>
      </Block>

      <Block title="autoFill 开关">
        <p>
          开:锚色变化 → 派生色实时跟着变(保持几何关系)。适合 <b>探索阶段</b>,快速浏览变体。
        </p>
        <p>
          关:派生色固定不变。适合 <b>微调阶段</b>,你想锁定派生色手动调每一个。
        </p>
        <p><b>推荐流程:</b>先选锚色 → 选规则 → 开 autoFill 拖锚色浏览变体 → 满意后关 autoFill → 手动微调每个色卡。</p>
      </Block>
    </>
  );
}

/* ── 第三章:滤镜 ─────────────────────────────────────────────── */

function FiltersChapter() {
  return (
    <Section title="滤镜栈" subtitle="7 种参数、非破坏性、可烘焙">
      <Block title="什么是非破坏性滤镜">
        <p>
          滤镜栈只存<b>参数</b>,不改色卡 hex;预览时通过 CSS filter 实时派生。
          满意后可以 <b>烘焙(bake)</b>,把结果写回 hex,永久生效。
        </p>
        <p>
          滤镜栈<b>有序</b>:拖动顺序会改变结果。先 brightness(0) 再 invert =白;先 invert 再 brightness(0) =黑。
        </p>
      </Block>

      <Block title="7 种参数">
        <table className="sl-cs-cookbook__table">
          <thead>
            <tr><th>参数</th><th>范围</th><th>作用</th></tr>
          </thead>
          <tbody>
            <tr><td>brightness</td><td>0..300 (100 中性)</td><td>压暗/提亮</td></tr>
            <tr><td>contrast</td><td>0..300 (100 中性)</td><td>增强/减弱明暗差</td></tr>
            <tr><td>saturate</td><td>0..300 (100 中性)</td><td>饱和度(0=灰)</td></tr>
            <tr><td>hue-rotate</td><td>0..360 度</td><td>整批转色相</td></tr>
            <tr><td>grayscale</td><td>0..100 %</td><td>去色</td></tr>
            <tr><td>sepia</td><td>0..100 %</td><td>暖黄/复古</td></tr>
            <tr><td>invert</td><td>0..100 %</td><td>反色</td></tr>
          </tbody>
        </table>
      </Block>

      <FilterScenarios />

      <Block title="使用流程">
        <ul>
          <li><b>探索</b>:加参数、拖动顺序看效果,不破坏原 hex。</li>
          <li><b>预览</b>:满意后再开/关,实时看真实效果。</li>
          <li><b>烘焙</b>:定稿后用烘焙功能把结果写回 hex,导出时就是新色。</li>
        </ul>
      </Block>
    </Section>
  );
}

function FilterScenarios() {
  return (
    <>
      <Block title="brightness / contrast — 整体调子">
        <p><b>brightness</b>:&lt;100 压暗、&gt;100 提亮。给图片色板统一整体亮度后再分组。</p>
        <p><b>contrast</b>:&gt;100 增强明暗、&lt;100 拉平。CTA/标题调高对比提高可读;背景调低对比让前景更突出。</p>
      </Block>

      <Block title="saturate — 色彩统一">
        <p>统一多来源图片/截图的色彩感:多张图色调不统一时,用 saturate 把它们调到同一饱和度档。</p>
        <p>0 = 纯灰(看明度分布),&gt;100 让色彩更艳。</p>
      </Block>

      <Block title="hue-rotate — 快速换主题">
        <p>整批颜色转色相。适合快速尝试&quot;如果主色是红而非蓝会怎样&quot;。</p>
        <p><b>注意:</b>hue-rotate 与 HSL 色相偏移不是精确对应(一个是 HSL,一个是 YIQ 近似),转出的色相会偏移但不会精准命中。</p>
      </Block>

      <Block title="grayscale / sepia — 状态色/怀旧">
        <p><b>grayscale 100%</b>:做禁用态、单色模式、暗色 UI。</p>
        <p><b>sepia</b>:怀旧/暖调/做旧照片效果。</p>
      </Block>

      <Block title="invert — 反色预览">
        <p>反转全部通道(白变黑、红变青等)。</p>
        <p><b>场景:</b>暗色模式快速预览(测试设计在暗底下的可读性)、特殊艺术效果。</p>
      </Block>

      <Block title="组合 — 实用配方">
        <p><b>柔和暖色照片:</b> saturate 110 + sepia 20 + brightness 105 + contrast 105</p>
        <p><b>暗夜主题预览:</b> invert 100(整批反色后,再人为调单色)</p>
        <p><b>统一低饱和:</b> saturate 70(整体偏柔和)</p>
      </Block>
    </>
  );
}

/* ── 排版 helpers ─────────────────────────────────────────────── */

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <>
      <header className="sl-cs-cookbook__secthead">
        <h3>{title}</h3>
        <p className="sl-cs-cookbook__subtitle">{subtitle}</p>
      </header>
      {children}
    </>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sl-cs-cookbook__block">
      <h4>{title}</h4>
      {children}
    </section>
  );
}