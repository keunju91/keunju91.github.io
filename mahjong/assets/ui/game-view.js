// ============================================================================
// game-view.js · 게임 화면 렌더링 + 사용자 조작 브리지
//
// 구조:
//   상단      : 게임 상태 (남은 산, 현재 차례)
//   4 방향    : 상대 (뒷면 · 손패 개수만), 나 (앞면 · 클릭 가능)
//   중앙      : 최근 버려진 패 4방향
//   하단 알림 : 缺 선택 · 후 여부 · 결과
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
    this._buildShell();
  }

  setMySeat(seat) { this.mySeat = seat; }

  _buildShell() {
    this.root.innerHTML = `
      <div class="mj-topbar">
        <div class="mj-stat" id="mjRound">1국</div>
        <div class="mj-stat" id="mjTurn">차례: -</div>
        <div class="mj-stat" id="mjWall">산 108</div>
      </div>
      <div class="mj-table">
        <div class="mj-seat mj-seat-top"    id="seat-top"></div>
        <div class="mj-seat mj-seat-left"   id="seat-left"></div>
        <div class="mj-seat mj-seat-right"  id="seat-right"></div>
        <div class="mj-center" id="mjCenter"></div>
        <div class="mj-seat mj-seat-bottom" id="seat-bottom"></div>
      </div>
      <div class="mj-actions" id="mjActions"></div>
      <div class="mj-log" id="mjLog"></div>
    `;
  }

  render(state) {
    this.state = state;
    document.getElementById('mjWall').textContent = `산 ${state.wallLeft}`;
    document.getElementById('mjTurn').textContent =
      `차례: ${SEAT_LABEL[state.turnSeat]} · ${state.players[state.turnSeat].name}`;

    // 4방향 배치: 나=bottom · +1=right · +2=top · +3=left
    const orderMap = { 0: 'bottom', 1: 'right', 2: 'top', 3: 'left' };
    for (const p of state.players) {
      const offset = (p.seat - this.mySeat + 4) % 4;
      const pos = orderMap[offset];
      this._renderSeat(pos, p, offset === 0);
    }
    this._renderCenter(state);
  }

  _renderSeat(pos, p, isMe) {
    const el = document.getElementById(`seat-${pos}`);
    if (!el) return;

    const label = `<div class="mj-name">${SEAT_LABEL[p.seat]} · ${p.name}` +
      (p.missingSuit ? ` <span class="mj-missing">缺${SUIT_KO[p.missingSuit] || p.missingSuit}</span>` : '') +
      `</div>`;

    if (isMe && this._myHand) {
      const tiles = this._myHand.map(t =>
        `<button class="mj-tile mj-tile-my" data-id="${t.id}" title="${displayName(t)}">${unicodeSymbol(t)}</button>`
      ).join('');
      el.innerHTML = label + `<div class="mj-hand mj-hand-my">${tiles}</div>`;
      // 클릭 핸들러 - discard 요청 시에만
      el.querySelectorAll('.mj-tile-my').forEach(btn => {
        btn.onclick = () => this._onTileClick(btn.dataset.id);
      });
    } else {
      const backs = '<span class="mj-tile mj-tile-back">🀫</span>'.repeat(p.handSize);
      el.innerHTML = label + `<div class="mj-hand mj-hand-back">${backs}</div>`;
    }

    // 버린 패
    const discardsHtml = p.discards.map(t =>
      `<span class="mj-tile mj-tile-small">${unicodeSymbol(t)}</span>`
    ).join('');
    el.innerHTML += `<div class="mj-discards">${discardsHtml}</div>`;
  }

  _renderCenter(state) {
    const c = document.getElementById('mjCenter');
    const lastDiscards = state.discards.slice(-8).reverse();
    c.innerHTML = `
      <div class="mj-center-label">최근 버려진 패</div>
      <div class="mj-center-tiles">
        ${lastDiscards.map(d =>
          `<span class="mj-tile mj-tile-recent" title="${SEAT_LABEL[d.from]}에서 버림">${unicodeSymbol(d.tile)}</span>`
        ).join('')}
      </div>
    `;
  }

  setMyHand(hand) {
    this._myHand = hand;
  }

  log(msg) {
    const box = document.getElementById('mjLog');
    const line = document.createElement('div');
    line.className = 'mj-log-line';
    line.innerHTML = msg;
    box.prepend(line);
    // 최대 12줄 유지
    while (box.children.length > 12) box.removeChild(box.lastChild);
  }

  // ─── 사용자 입력 브리지 (Promise 기반) ───

  askMissingSuit() {
    this.log('👉 <b>缺 종을 선택하세요</b> · 손패에 없는 종을 고르는 게 유리합니다');
    return this._askWithButtons('missing', [
      { label: '缺 만수 (m)', value: 'm' },
      { label: '缺 통수 (p)', value: 'p' },
      { label: '缺 삭수 (s)', value: 's' },
    ]);
  }

  askDiscard() {
    this.log('👉 <b>버릴 패를 클릭하세요</b>');
    return new Promise(resolve => {
      this._askType = 'discard';
      this._askResolver = resolve;
    });
  }

  askClaim(_state, tile, actions) {
    if (actions.includes('hu')) {
      this.log(`🀄 <b>후 가능!</b> ${displayName(tile)} 로 화형 완성. 후 하시겠습니까?`);
      return this._askWithButtons('claim', [
        { label: '후! (hu)', value: { action: 'hu' } },
        { label: '패스', value: { action: 'pass' } },
      ]);
    }
    return Promise.resolve({ action: 'pass' });
  }

  askSelfHu(_state, tile) {
    this.log(`🀄 <b>자모후 가능!</b> ${displayName(tile)} 뽑아서 화형 완성. 자모후 하시겠습니까?`);
    return this._askWithButtons('selfhu', [
      { label: '자모후!', value: true },
      { label: '계속', value: false },
    ]);
  }

  _askWithButtons(type, buttons) {
    return new Promise(resolve => {
      const box = document.getElementById('mjActions');
      box.innerHTML = buttons.map((b, i) =>
        `<button class="mj-action-btn" data-i="${i}">${b.label}</button>`
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
