// GuestForm —— 被绘制进 canvas 的"表单卡片"(真实 DOM,可输入)。
//
// 它是 <canvas layoutsubtree> 的直接子节点。three-html-render 的 ThreeHTMLRenderer
// 会把这个 div 通过 matrix3d 定位到 3D 卡片 mesh 的屏幕投影位置,并把它的内容
// 上传为 WebGL 纹理。因此:
//   - 视觉上:你看到的是被射灯照亮的、贴在 3D 卡片上的表单(纹理)
//   - 交互上:这个 div 仍占据布局、可被命中,inputs 真实可输入 / 可聚焦 / 可选中文本
// 每次按键 → React 改 DOM → 下一帧 paint 重新上传纹理 → 卡片上的文字实时更新。

import type { CSSProperties, FormEvent, Ref } from 'react';
import { useState } from 'react';
import {
  COLOR_PRESETS,
  INITIAL_LIGHT,
  MOOD_OPTIONS,
  type LightingSettings,
} from './lightConfig';

type GuestFormProps = {
  lighting: LightingSettings;
  onLightingChange: (patch: Partial<LightingSettings>) => void;
  onReset: () => void;
  preview?: boolean;
  sourceRef?: Ref<HTMLDivElement>;
};

export function GuestForm({
  lighting,
  onLightingChange,
  onReset,
  preview = false,
  sourceRef,
}: GuestFormProps) {
  // 表单自身状态(纯客户端,无后端)。
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [mood, setMood] = useState<string>(MOOD_OPTIONS[0]);
  const [subscribe, setSubscribe] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const tabIndex = preview ? -1 : 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSubmitted(true);
  }

  function handleReset() {
    setName('');
    setEmail('');
    setMessage('');
    setMood(MOOD_OPTIONS[0]);
    setSubscribe(true);
    setSubmitted(false);
  }

  return (
    <div
      ref={sourceRef}
      className="sl-hl-source"
      style={{ '--lamp-color': lighting.color } as CSSProperties}
    >
      <header className="sl-hl-head">
        <div className="sl-hl-brand">
          <span className="sl-hl-logo" aria-hidden="true" />
          <span>HTML · CANVAS</span>
          <span className="sl-hl-brand-tag">LIVE DOM</span>
        </div>
        <div className="sl-hl-status">
          <span /> {preview ? 'PREVIEW' : 'POLYFILL ACTIVE'}
        </div>
      </header>

      <main className="sl-hl-body">
        <section className="sl-hl-copy" aria-labelledby="sl-hl-title">
          <p className="sl-hl-kicker">01 / RENDER HTML INTO WEBGL</p>
          <h1 id="sl-hl-title">
            Type into the <span>light.</span>
          </h1>
          <p className="sl-hl-sub">
            This card is real DOM living inside a <code>&lt;canvas layoutsubtree&gt;</code>.
            The browser paints it into a Three.js texture, lit by a physically-simulated
            hanging lamp. Click any field — the caret, selection and IME all work.
          </p>

          {submitted ? (
            <div className="sl-hl-thanks" role="status">
              <span className="sl-hl-thanks-mark" aria-hidden="true">✦</span>
              <div>
                <b>Signed under the light.</b>
                <p>
                  Thanks, {name.trim()}! Your “{mood}” note is etched into the canvas.
                </p>
                <button type="button" className="sl-hl-link" onClick={handleReset} tabIndex={tabIndex}>
                  Write another →
                </button>
              </div>
            </div>
          ) : (
            <form className="sl-hl-form" data-interactive onSubmit={handleSubmit}>
              <label className="sl-hl-field">
                <span className="sl-hl-label">Name</span>
                <input
                  type="text"
                  className="sl-hl-input"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                  tabIndex={tabIndex}
                />
              </label>

              <label className="sl-hl-field">
                <span className="sl-hl-label">Email</span>
                <input
                  type="email"
                  className="sl-hl-input"
                  placeholder="you@studio.dev"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  tabIndex={tabIndex}
                />
              </label>

              <label className="sl-hl-field">
                <span className="sl-hl-label">Note</span>
                <textarea
                  className="sl-hl-input sl-hl-textarea"
                  rows={3}
                  placeholder="Leave a mark on the canvas…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  tabIndex={tabIndex}
                />
              </label>

              <div className="sl-hl-form-row">
                <label className="sl-hl-field sl-hl-field--inline">
                  <span className="sl-hl-label">Mood</span>
                  <select
                    className="sl-hl-input sl-hl-select"
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    tabIndex={tabIndex}
                  >
                    {MOOD_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sl-hl-check">
                  <input
                    type="checkbox"
                    checked={subscribe}
                    onChange={(e) => setSubscribe(e.target.checked)}
                    tabIndex={tabIndex}
                  />
                  <span>Keep me posted</span>
                </label>
              </div>

              <button type="submit" className="sl-hl-submit" tabIndex={tabIndex}>
                Sign the card <span aria-hidden="true">→</span>
              </button>
            </form>
          )}
        </section>

        <aside className="sl-hl-controls" data-interactive aria-label="Spotlight controls">
          <div className="sl-hl-ctrl-head">
            <div>
              <p>LIGHT CONTROL</p>
              <span>PHYSICAL SPOT / 01</span>
            </div>
            <button
              type="button"
              className={`sl-hl-power${lighting.enabled ? ' is-on' : ''}`}
              onClick={() => onLightingChange({ enabled: !lighting.enabled })}
              aria-pressed={lighting.enabled}
              aria-label={lighting.enabled ? 'Turn spotlight off' : 'Turn spotlight on'}
              tabIndex={tabIndex}
            >
              <span />
              {lighting.enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <label className="sl-hl-ctrl-row">
            <span className="sl-hl-ctrl-label">
              <b>BEAM</b>
              <output>{lighting.angle}°</output>
            </span>
            <input
              type="range"
              min="16"
              max="58"
              step="1"
              value={lighting.angle}
              onChange={(e) => onLightingChange({ angle: Number(e.currentTarget.value) })}
              aria-label="Spotlight beam angle"
              tabIndex={tabIndex}
            />
          </label>

          <label className="sl-hl-ctrl-row">
            <span className="sl-hl-ctrl-label">
              <b>BRIGHTNESS</b>
              <output>{lighting.brightness} lm</output>
            </span>
            <input
              type="range"
              min="300"
              max="2600"
              step="50"
              value={lighting.brightness}
              onChange={(e) => onLightingChange({ brightness: Number(e.currentTarget.value) })}
              aria-label="Spotlight brightness"
              tabIndex={tabIndex}
            />
          </label>

          <div className="sl-hl-ctrl-row sl-hl-color-row">
            <span className="sl-hl-ctrl-label">
              <b>COLOR</b>
              <output>{lighting.color.toUpperCase()}</output>
            </span>
            <div className="sl-hl-swatches">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={lighting.color.toLowerCase() === color ? 'is-active' : ''}
                  style={{ '--swatch': color } as CSSProperties}
                  onClick={() => onLightingChange({ color })}
                  aria-label={`Set light color to ${color}`}
                  aria-pressed={lighting.color.toLowerCase() === color}
                  tabIndex={tabIndex}
                />
              ))}
              <label className="sl-hl-custom" aria-label="Choose a custom light color">
                <input
                  type="color"
                  value={lighting.color}
                  onChange={(e) => onLightingChange({ color: e.currentTarget.value })}
                  tabIndex={tabIndex}
                />
                <span aria-hidden="true">+</span>
              </label>
            </div>
          </div>

          <button type="button" className="sl-hl-reset" onClick={onReset} tabIndex={tabIndex}>
            RESET LIGHT <span aria-hidden="true">↗</span>
          </button>
        </aside>
      </main>

      <footer className="sl-hl-foot">
        <p>HTML · CANVAS · LIGHT · FORM</p>
        <div className="sl-hl-drag">
          <span className="sl-hl-orbit" aria-hidden="true">
            <i />
          </span>
          <div>
            <b>LMB MOVE · RMB LIGHT</b>
            <span>Drag the lamp · Right-drag beam · Right-click color · Double-click reset</span>
          </div>
        </div>
        <p>FOUNDATION FIRST — TYPE BELOW</p>
      </footer>
    </div>
  );
}

const ignoreLightingChange = () => {};
const ignoreReset = () => {};

/** 加载态用的静态预览(不可交互,tabIndex 全 -1)。 */
export function GuestFormPreview({ hidden = false }: { hidden?: boolean }) {
  return (
    <div className={`sl-hl-preview${hidden ? ' is-hidden' : ''}`} aria-hidden="true" inert>
      <GuestForm
        lighting={INITIAL_LIGHT}
        onLightingChange={ignoreLightingChange}
        onReset={ignoreReset}
        preview
      />
    </div>
  );
}
