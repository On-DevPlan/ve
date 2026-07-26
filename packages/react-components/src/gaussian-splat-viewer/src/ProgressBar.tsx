import type { JSX } from 'react';

export function ProgressBar({ progress }: { progress: number }): JSX.Element {
  const percent = Math.round(progress * 100);
  return (
    <div className="sl-gsv-progress">
      <div className="sl-gsv-progress__track">
        <div className="sl-gsv-progress__fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="sl-gsv-progress__text">SCROLL TO EXPLORE · {percent}%</div>
    </div>
  );
}
