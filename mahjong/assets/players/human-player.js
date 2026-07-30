// ============================================================================
// HumanPlayer · 사용자 인터페이스 + timeout 시 AI 자동 fallback
//
// 15초 (조정 가능) 안에 결정 안 하면 내부 AIPlayer 로직으로 자동 선택.
// ============================================================================

import { Player } from './player-base.js';
import { AIPlayer } from './ai-player.js';
import { displayName } from '../core/tile.js';

export class HumanPlayer extends Player {
  constructor(name, seat, uiBridge, options = {}) {
    super(name, seat);
    this.ui = uiBridge;
    this.timeoutMs = options.timeoutMs ?? 25000;
    // 내부 AI 는 hand 를 공유해서 fallback 결정에 사용
    this._ai = new AIPlayer(name, seat);
  }

  _syncAi() {
    this._ai.hand = this.hand;
    this._ai.melds = this.melds;
    this._ai.discards = this.discards;
    this._ai.missingSuit = this.missingSuit;
  }

  async _raceWithTimeout(userPromise, autoPromise, timeoutLabel) {
    if (!this.timeoutMs || this.timeoutMs <= 0) return userPromise;
    return await Promise.race([
      userPromise,
      new Promise(resolve => {
        setTimeout(async () => {
          this.ui.cancelAsk?.();
          const auto = await autoPromise();
          this.ui.log?.(`⏱️ 시간 초과 · ${timeoutLabel}`);
          resolve(auto);
        }, this.timeoutMs);
      }),
    ]);
  }

  async decideMissingSuit(state) {
    this._syncAi();
    return this._raceWithTimeout(
      this.ui.askMissingSuit(state, this.timeoutMs),
      async () => {
        const s = await this._ai.decideMissingSuit(state);
        return s;
      },
      `자동으로 缺 ${'?'} 선택`,
    );
  }

  async decideDiscard(state) {
    this._syncAi();
    return this._raceWithTimeout(
      this.ui.askDiscard(state, this.hand, this.timeoutMs),
      async () => {
        const t = await this._ai.decideDiscard(state);
        return t;
      },
      `자동 버림`,
    ).then(t => {
      this.ui.log?.(`${this.name} 버림: ${displayName(t)}`);
      return t;
    });
  }

  async decideClaim(tile, actions, state) {
    // 후 판정만 여주인님께 물어봄. timeout 지나면 자동 pass.
    if (!actions.includes('hu')) return { action: 'pass' };
    return this._raceWithTimeout(
      this.ui.askClaim(state, tile, actions, this.timeoutMs),
      async () => ({ action: 'pass' }),
      `자동 패스`,
    );
  }

  async decideSelfHu(tile, state) {
    return this._raceWithTimeout(
      this.ui.askSelfHu(state, tile, this.timeoutMs),
      async () => true, // 후 가능하면 자동으로 후
      `자동 자모후`,
    );
  }
}
