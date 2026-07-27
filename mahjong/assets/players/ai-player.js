// ============================================================================
// AIPlayer · Phase 1a "룰 지키는 기본 봇"
//
// 전략:
//   · missingSuit: 손패에서 가장 적게 갖고 있는 종을 缺로 선택
//   · discard: 缺한 종이 있으면 그것부터 버림. 없으면 고립된 패 (좌우 이웃 없는) 우선 버림.
//   · hu: 화형 가능하면 무조건 후
//
// 나중 (Phase 2+): 몬테카를로 / 유용도 평가로 강화
// ============================================================================

import { Player } from './player-base.js';
import { SUIT } from '../core/tile.js';

export class AIPlayer extends Player {
  constructor(name, seat) {
    super(name, seat);
  }

  async decideMissingSuit() {
    const counts = { m: 0, p: 0, s: 0 };
    for (const t of this.hand) {
      if (counts[t.suit] !== undefined) counts[t.suit]++;
    }
    // 가장 적은 종을 缺로
    let minSuit = 'm';
    let minCount = Infinity;
    for (const s of ['m', 'p', 's']) {
      if (counts[s] < minCount) { minCount = counts[s]; minSuit = s; }
    }
    return minSuit;
  }

  async decideDiscard(gameState) {
    // 1. 缺한 종이 있으면 그것부터 버림
    if (this.missingSuit) {
      const found = this.hand.find(t => t.suit === this.missingSuit);
      if (found) return found;
    }
    // 2. 고립된 패 (근처 ±2 안에 이웃 없는 수패) 우선
    const isolated = this.findIsolated();
    if (isolated) return isolated;
    // 3. fallback: 가장 앞에 있는 패
    return this.hand[0];
  }

  async decideClaim(discardedTile, availableActions) {
    if (availableActions.includes('hu')) {
      return { action: 'hu' };
    }
    return { action: 'pass' };
  }

  async decideSelfHu() {
    return true; // 후 가능하면 무조건 후
  }

  // ─── 헬퍼 ───

  findIsolated() {
    for (const t of this.hand) {
      if (t.suit === SUIT.HONOR || t.suit === SUIT.FLOWER) continue;
      const nearby = this.hand.filter(x =>
        x.suit === t.suit && Math.abs(x.num - t.num) <= 2 && x.id !== t.id
      );
      if (nearby.length === 0) return t;
    }
    return null;
  }
}
