// index.tsx —— 中国地图涂色：入口（布局 + 状态）
import { useState } from 'react';
import './index.css';
import ChinaMap from './src/ChinaMap';
import ColorPicker from './src/ColorPicker';
import DebugPanel from './src/DebugPanel';
import { PALETTE } from './src/lib/constants';

export default function ChinaMapColoring() {
  const [colorByProvince, setColorByProvince] = useState<Record<string, string>>({});
  const [selectedColor, setSelectedColor] = useState<string>(PALETTE[0].value);
  const [debugMode, setDebugMode] = useState(false);

  const handleProvinceClick = (name: string) => {
    setColorByProvince((prev) => ({ ...prev, [name]: selectedColor }));
  };

  const handleReset = () => setColorByProvince({});

  return (
    <div className="sl-cmc-root">
      <header className="sl-cmc-header">
        <svg className="sl-cmc-header-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 6.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"
          />
        </svg>
        <div>
          <h1 className="sl-cmc-title">中国地图涂色</h1>
          <p className="sl-cmc-subtitle">选择颜色，点击省份为地图上色</p>
        </div>
      </header>
      <main className="sl-cmc-main">
        <section className="sl-cmc-map-card">
          <div className="sl-cmc-map-title">中国地图</div>
          <div className="sl-cmc-map-body">
            <ChinaMap
              colorByProvince={colorByProvince}
              debugMode={debugMode}
              onProvinceClick={handleProvinceClick}
            />
          </div>
        </section>
        <aside className="sl-cmc-side">
          <section className="sl-cmc-panel">
            <h2 className="sl-cmc-panel-title">选择颜色</h2>
            <ColorPicker selectedColor={selectedColor} onSelect={setSelectedColor} />
          </section>
          <section className="sl-cmc-panel">
            <h2 className="sl-cmc-panel-title">怎么玩</h2>
            <ol className="sl-cmc-steps">
              <li>选择一种颜色</li>
              <li>点击地图上的省份涂色</li>
              <li>重复操作，给整个地图上色</li>
            </ol>
          </section>
          <section className="sl-cmc-panel">
            <h2 className="sl-cmc-panel-title">高级</h2>
            <DebugPanel
              debugMode={debugMode}
              onToggleDebug={() => setDebugMode((v) => !v)}
              onReset={handleReset}
            />
          </section>
        </aside>
      </main>
      <footer className="sl-cmc-footer">Canvas + GeoJSON · china-map-coloring</footer>
    </div>
  );
}
