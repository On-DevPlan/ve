import type { JSX } from 'react';

export function LoadingScreen({ visible }: { visible: boolean }): JSX.Element {
  return (
    <div className={`sl-gsv-loading ${!visible ? 'sl-gsv-loading--out' : ''}`}>
      <div className="sl-gsv-loading__title">S H A R P</div>
      <div className="sl-gsv-loading__spinner" />
    </div>
  );
}
