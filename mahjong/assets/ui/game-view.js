// ============================================================================
// game-view.js · 모바일 우선 게임 화면
//
// 레이아웃:
//   상단     : 상대 3명 (가로 나란히, 뒷면 개수만)
//   중앙     : 최근 버려진 패
//   하단     : 내 손패 (가로 스크롤 or wrap)
//   sticky   : 액션 버튼 (缺 · 후 · 자모 등)
//   로그     : 접힘 가능
// ============================================================================

import { unicodeSymbol, displayName, SUIT } from '../core/tile.js';
import { SEAT_LABEL } from '../core/engine.js';

const SUIT_KO = { m: '만', p: '통', s: '삭' };

export class GameView {
  constructor(rootEl) {
    this.root = rootEl;
    this.state = null;
    this.mySeat = 0;
    this._askResolver = null;
    this._askType = null;
    this._myHand = [];
    this._buildShell();
  }

  setMySeat(seat) { this.mySeat = seat; }
  setMyHand(hand) { this._myHand = hand; }

  _buildShell() {
    this.root.innerHTML = `
      <div class="mj-topbar">
        <span class="mj-stat" id="mjRound">1국</span>
        <span class="mj-stat" id="mjTurn">차례: -</span>
        <span class="mj-stat" id="mjWall">산 108</span>
      </div>

      <div class="mj-table">
        <div class="mj-opponents" id="mjOpponents"></div>
        <div class="mj-center" id="mjCenter">
          <div class="mj-center-label">최근 버려진 패</div>
          <div class="mj-center-tiles" id="mjCenterTiles"></div>
        </div>
        <div class="mj-me" id="mjMe"></div>
      </div>

      <div class="mj-actions" id="mjActions"></div>

      <details class="mj-log-wrap">
        <summary>진행 로그</summary>
        <div class="mj-log" id="mjLog"></div>
      </details>
    `;
  }

  render(state) {
    this.state = state;
    document.getElementById('mjWall').textContent = `산 ${state.wallLeft}`;
    document.getElementById('mjTurn').textContent =
      `차례: ${SEAT_LABEL[state.turnSeat]}·${state.players[state.turnSeat].name}`;

    // 상대 3명 (내 자리 다음부터 시계 방향)
    const opps = [1, 2, 3].map(offset => state.players[(this.mySeat + offset) % 4]);
    const oppRoot = document.getElementById('mjOpponents');
    oppRoot.innerHTML = opps.map(p => this._renderOpponent(p, state.turnSeat === p.seat)).join('');

    // 중앙 · 최근 버려진 패
    const lastDiscards = state.discards.slice(-10).reverse();
    document.getElementById('mjCenterTiles').innerHTML = lastDiscards.map(d =>
      `<span class="mj-tile mj-tile-recent" title="${SEAT_LABEL[d.from]}에서 버림">${unicodeSymbol(d.tile)}</span>`
    ).join('');

    // 나 (내 손패 · 앞면)
    const me = state.players[this.mySeat];
    this._renderMe(me, state.turnSeat === me.seat);
  }

  _renderOpponent(p, isTurn) {
    // 모바일 폭 절약: 자리(東南西北) 는 크게, 이름은 작게
    return `
      <div class="mj-opp ${isTurn ? 'mj-opp-turn' : ''}" title="${SEAT_LABEL[p.seat]} · ${p.name}">
        <div class="mj-opp-head">
          <span class="mj-opp-seat">${SEAT_LABEL[p.seat]}</span>
          ${p.missingSuit ? `<span class="mj-missing">缺${SUIT_KO[p.missingSuit] || p.missingSuit}</span>` : ''}
        </div>
        <div class="mj-opp-count">🀫 ${p.handSize}</div>
        ${p.discards.length ? `
          <div class="mj-opp-discards">
            ${p.discards.slice(-6).map(t => `<span class="mj-tile-mini">${unicodeSymbol(t)}</span>`).join('')}
            ${p.discards.length > 6 ? `<span class="mj-more">+${p.discards.length - 6}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderMe(me, isTurn) {
    const el = document.getElementById('mjMe');
    const tiles = this._myHand.map(t =>
      `<button class="mj-tile-my" data-id="${t.id}" title="${displayName(t)}">${unicodeSymbol(t)}</button>`
    ).join('');

    el.innerHTML = `
      <div class="mj-me-head">
        <span class="mj-me-name">${SEAT_LABEL[me.seat]}·${me.name}</span>
        ${me.missingSuit ? `<span class="mj-missing">缺${SUIT_KO[me.missingSuit] || me.missingSuit}</span>` : ''}
        ${isTurn ? '<span class="mj-turn-badge">내 차례</span>' : ''}
      </div>
      <div class="mj-me-hand">${tiles}</div>
      ${me.discards.length ? `
        <div class="mj-me-discards">
          ${me.discards.slice(-10).map(t => `<span class="mj-tile-mini">${unicodeSymbol(t)}</span>`).join('')}
        </div>
      ` : ''}
    `;
    el.querySelectorAll('.mj-tile-my').forEach(btn => {
      btn.onclick = () => this._onTileClick(btn.dataset.id);
    });
  }

  log(msg) {
    const box = document.getElementById('mjLog');
    if (!box) return;
    const line = document.createElement('div');
    line.className = 'mj-log-line';
    line.innerHTML = msg;
    box.prepend(line);
    while (box.children.length > 20) box.removeChild(box.lastChild);
  }

  // ─── 사용자 입력 브리지 (Promise 기반) ───

  askMissingSuit() {
    this.log('👉 <b>缺 종을 선택하세요</b> · 손패에 없는 종을 고르는 게 유리합니다');
    return this._askWithButtons([
      { label: '缺 만수', value: 'm' },
      { label: '缺 통수', value: 'p' },
      { label: '缺 삭수', value: 's' },
    ]);
  }

  askDiscard() {
    this.log('👉 <b>버릴 패를 탭</b>하세요');
    return new Promise(resolve => {
      this._askType = 'discard';
      this._askResolver = resolve;
    });
  }

  askClaim(_state, tile, actions) {
    if (actions.includes('hu')) {
      this.log(`🀄 <b>후 가능!</b> ${displayName(tile)} 로 화형 완성`);
      return this._askWithButtons([
        { label: '후!', value: { action: 'hu' } },
        { label: '패스', value: { action: 'pass' } },
      ]);
    }
    return Promise.resolve({ action: 'pass' });
  }

  askSelfHu(_state, tile) {
    this.log(`🀄 <b>자모후 가능!</b> ${displayName(tile)} 뽑음`);
    return this._askWithButtons([
      { label: '자모후!', value: true },
      { label: '계속', value: false },
    ]);
  }

  _askWithButtons(buttons) {
    return new Promise(resolve => {
      const box = document.getElementById('mjActions');
      box.innerHTML = buttons.map((b, i) =>
        `<button class="mj-action-btn ${i === 0 ? 'primary' : ''}" data-i="${i}">${b.label}</button>`
      ).join('');
      box.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => {
          const idx = Number(btn.dataset.i);
          box.innerHTML = '';
          resolve(buttons[idx].value);
        };
      });
    });
  }

  _onTileClick(id) {
    if (this._askType === 'discard' && this._askResolver) {
      const tile = this._myHand.find(t => t.id === id);
      const resolver = this._askResolver;
      this._askResolver = null;
      this._askType = null;
      resolver(tile);
    }
  }
}
