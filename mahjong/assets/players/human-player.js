// ============================================================================
// HumanPlayer · 사용자 인터페이스 (A 모드에서 여주인님 자리)
//
// 게임 엔진이 decideDiscard/decideClaim/decideSelfHu 를 await 하면 이 클래스는
// UI 콜백을 통해 "사용자가 클릭할 때까지 pending" 상태를 유지한다.
// ============================================================================

import { Player } from './player-base.js';
import { SUIT } from '../core/tile.js';

export class HumanPlayer extends Player {
  constructor(name, seat, uiBridge) {
    super(name, seat);
    // uiBridge: {
    //   askMissingSuit: (state) => Promise<'m'|'p'|'s'>,
    //   askDiscard: (state, hand) => Promise<Tile>,
    //   askClaim: (state, tile, actions) => Promise<{action, ...}>,
    //   askSelfHu: (state, tile) => Promise<boolean>,
    // }
    this.ui = uiBridge;
  }

  async decideMissingSuit(state) {
    return this.ui.askMissingSuit(state);
  }
  async decideDiscard(state) {
    return this.ui.askDiscard(state, this.hand);
  }
  async decideClaim(tile, actions, state) {
    return this.ui.askClaim(state, tile, actions);
  }
  async decideSelfHu(tile, state) {
    return this.ui.askSelfHu(state, tile);
  }
}
