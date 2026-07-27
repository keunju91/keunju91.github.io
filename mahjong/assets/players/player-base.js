// ============================================================================
// Player Interface (추상 계층)
//
// 핵심 설계 원칙:
// 게임 엔진은 "누가 결정하는지" 신경쓰지 않고 이 interface 로만 소통한다.
// 그래서 같은 자리에:
//   - AIPlayer   (Phase 1: A 모드 · 봇)
//   - LocalPlayer (Phase 3: B 모드 · 같은 화면 사람)
//   - RemotePlayer (Phase 4: C 모드 · 서버 통한 원격 사람)
// 어떤 걸 꽂아도 게임이 그대로 돌아간다.
// ============================================================================

export class Player {
  constructor(name, seat) {
    this.name = name;
    this.seat = seat;   // 0: 동 · 1: 남 · 2: 서 · 3: 북
    this.hand = [];     // 손패 (닫힌 패)
    this.melds = [];    // 열린 조합 (펑·치·강 등)
    this.discards = []; // 버린 패
  }

  // ─── 아래 4개 메서드가 Player interface 의 계약 ───

  /**
   * 자기 차례에 뽑고 나서 무엇을 버릴지 결정.
   * @returns {Promise<Tile>} 버릴 패
   */
  async decideDiscard(gameState) {
    throw new Error('Player.decideDiscard() must be implemented');
  }

  /**
   * 다른 사람이 버린 패에 대해 펑/치/강/후 하겠는지 결정.
   * @returns {Promise<{action: 'pon'|'chi'|'kan'|'hu'|'pass', tiles?: Tile[]}>}
   */
  async decideClaim(discardedTile, availableActions, gameState) {
    throw new Error('Player.decideClaim() must be implemented');
  }

  /**
   * 자기 차례에 뽑은 후 자모후(自摸) 가능한지 판단.
   * @returns {Promise<boolean>}
   */
  async decideSelfHu(drawnTile, gameState) {
    throw new Error('Player.decideSelfHu() must be implemented');
  }

  /**
   * 사천마작 시작 시: 어느 종을 缺 (빼고 갈 것) 할지 선택.
   * 국표에서는 호출 안 됨.
   * @returns {Promise<'m'|'p'|'s'>}
   */
  async decideMissingSuit(gameState) {
    throw new Error('Player.decideMissingSuit() must be implemented');
  }
}
