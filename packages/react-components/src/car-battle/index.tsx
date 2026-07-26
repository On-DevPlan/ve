import './index.css';
import { useRef, useEffect, useState, useCallback } from 'react';
import type { JSX } from 'react';
import { GameEngine } from './src/GameEngine';
import type { GameState, HitEvent } from './src/types';

export default function CarBattle(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [hitFlash, setHitFlash] = useState<{ from: 0 | 1; key: number } | null>(null);

  const handleState = useCallback((state: GameState) => {
    setGameState(state);
  }, []);

  const handleHit = useCallback((_event: HitEvent) => {
    const key = Date.now();
    setHitFlash({ from: _event.from, key });
    // 动画结束后清除
    setTimeout(() => setHitFlash(null), 800);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine();
    engineRef.current = engine;

    const unsubState = engine.onStateChange(handleState);
    const unsubHit = engine.onHit(handleHit);

    engine.start(canvas);

    return () => {
      unsubState();
      unsubHit();
      engine.stop();
    };
  }, [handleState, handleHit]);

  const handleRestart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const old = engineRef.current;
    old?.stop();

    const engine = new GameEngine();
    engineRef.current = engine;

    engine.onStateChange(handleState);
    engine.onHit(handleHit);

    engine.start(canvas);
  }, [handleState, handleHit]);

  const isFinished = gameState?.phase === 'finished';
  const isCountdown = gameState?.phase === 'countdown';
  const timerWarning = gameState && !isCountdown && gameState.timeRemaining <= 10;

  return (
    <div className="sl-cb-root">
      <canvas ref={canvasRef} className="sl-cb-canvas" />

      {/* HUD */}
      {gameState && !isFinished && (
        <div className="sl-cb-hud">
          {/* 蓝方分数 */}
          <div className="sl-cb-score sl-cb-score--blue">
            <div className="sl-cb-score__value">{gameState.cars[0].score}</div>
            <div className="sl-cb-score__label">玩家1 [W A S D]</div>
          </div>

          {/* 计时器 */}
          {!isCountdown && (
            <div className={`sl-cb-timer ${timerWarning ? 'sl-cb-timer--warning' : ''}`}>
              {Math.ceil(gameState.timeRemaining)}s
            </div>
          )}

          {/* 红方分数 */}
          <div className="sl-cb-score sl-cb-score--red">
            <div className="sl-cb-score__value">{gameState.cars[1].score}</div>
            <div className="sl-cb-score__label">玩家2 [↑ ↓ ← →]</div>
          </div>
        </div>
      )}

      {/* 撞击闪字 */}
      {hitFlash && (
        <div
          key={hitFlash.key}
          className={`sl-cb-hit ${hitFlash.from === 0 ? 'sl-cb-hit--blue' : 'sl-cb-hit--red'}`}
        >
          +1
        </div>
      )}

      {/* 结果面板 */}
      {isFinished && gameState && (
        <div className="sl-cb-result-overlay">
          <div className="sl-cb-result">
            {gameState.cars[0].score > gameState.cars[1].score ? (
              <div className="sl-cb-result__winner">🏆 玩家1 获胜！</div>
            ) : gameState.cars[1].score > gameState.cars[0].score ? (
              <div className="sl-cb-result__winner">🏆 玩家2 获胜！</div>
            ) : (
              <div className="sl-cb-result__draw">🤝 平局！</div>
            )}
            <div className="sl-cb-result__scores">
              <div className="sl-cb-result__player">
                <div className="sl-cb-result__player-name" style={{ color: '#4361ee' }}>玩家1</div>
                <div className="sl-cb-result__player-score" style={{ color: '#4361ee' }}>
                  {gameState.cars[0].score}
                </div>
              </div>
              <div className="sl-cb-result__player">
                <div className="sl-cb-result__player-name" style={{ color: '#e63946' }}>玩家2</div>
                <div className="sl-cb-result__player-score" style={{ color: '#e63946' }}>
                  {gameState.cars[1].score}
                </div>
              </div>
            </div>
            <button className="sl-cb-result__btn" onClick={handleRestart}>
              再来一局
            </button>
          </div>
        </div>
      )}

      {/* 底部按键提示 */}
      {!isFinished && (
        <div className="sl-cb-instructions">
          <span>
            <span className="sl-cb-key">W</span>
            <span className="sl-cb-key">A</span>
            <span className="sl-cb-key">S</span>
            <span className="sl-cb-key">D</span>
            &nbsp;玩家1
          </span>
          <span>
            <span className="sl-cb-key">↑</span>
            <span className="sl-cb-key">←</span>
            <span className="sl-cb-key">↓</span>
            <span className="sl-cb-key">→</span>
            &nbsp;玩家2
          </span>
        </div>
      )}
    </div>
  );
}
