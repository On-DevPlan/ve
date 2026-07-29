import type { JSX } from 'react';

export function IntroBox({ visible }: { visible: boolean }): JSX.Element {
  return (
    <div className={`sl-gsv-intro ${visible ? 'sl-gsv-intro--visible' : ''}`}>
      <div className="sl-gsv-intro__title">Muse Dash</div>
      <div className="sl-gsv-intro__desc">
        当战斗与演奏间的屏障被打破
        <br />
        你可否听到来自另一个世界的呼唤?
        <br />
        <br />
        Game Starts Now!!
      </div>
      <div className="sl-gsv-intro__tag">推荐</div>
    </div>
  );
}
