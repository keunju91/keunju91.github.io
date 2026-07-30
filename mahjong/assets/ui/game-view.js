// ============================================================================
// game-view.js · 4방향 마작판 (top/left/right/bottom) + 컴퍼스 + 주사위
//
// 자리 배치 (내 시점, mySeat=0=東 기준):
//   상단 (top)    ─ offset 2 (마주보는 西)
//   왼쪽 (left)   ─ offset 3 (좌측 北)
//   오른쪽 (right)─ offset 1 (우측 南)
//   하단 (bottom) ─ 나 (東)
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
    this._countdownInterval = null;
    this._countdownActive = false;
    this._buildShell();
  }

  // 카운트다운 시작 (컴퍼스 안 숫자를 초로 갱신)
  _startCountdown(ms) {
    this._stopCountdown();
    this._countdownActive = true;
    const end = Date.now() + ms;
    const numEl = document.getElementById('mjCompassNum');
    const compassEl = document.getElementById('mjCompass');
    compassEl?.classList.add('countdown-active');
    const tick = () => {
      const remain = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      if (numEl) numEl.textContent = String(remain).padStart(2, '0');
      if (remain <= 3) compassEl?.classList.add('countdown-danger');
      else compassEl?.classList.remove('countdown-danger');
      if (remain <= 0) this._stopCountdown();
    };
    tick();
    this._countdownInterval = setInterval(tick, 200);
  }
  _stopCountdown() {
    if (this._countdownInterval) clearInterval(this._countdownInterval);
    this._countdownInterval = null;
    this._countdownActive = false;
    const compassEl = document.getElementById('mjCompass');
    compassEl?.classList.remove('countdown-active');
    compassEl?.classList.remove('countdown-danger');
    // 컴퍼스 안 숫자는 render 다음에 남은 산 수로 복구됨
  }
  // HumanPlayer 가 timeout 되었을 때 UI 상태 정리
  cancelAsk() {
    this._stopCountdown();
    this._askResolver = null;
    this._askType = null;
    const actions = document.getElementById('mjActions');
    if (actions) actions.innerHTML = '';
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
        <div class="mj-seat mj-seat-top"    id="seat-top"></div>
        <div class="mj-seat mj-seat-left"   id="seat-left"></div>
        <div class="mj-seat mj-seat-right"  id="seat-right"></div>
        <div class="mj-center" id="mjCenter">
          <div class="mj-title-cn">血战到底</div>
          <div class="mj-info-row">
            <div class="mj-info-chip">剩<span class="num" id="mjWallNum">108</span>张</div>
            <div class="mj-compass" id="mjCompass">
              <div class="mj-compass-inner">
                <div class="mj-compass-value" id="mjCompassNum">-</div>
                <div class="mj-compass-dir-label" id="mjCompassDir">東</div>
              </div>
            </div>
            <div class="mj-info-chip">第<span class="num" id="mjRoundNum">1</span>局</div>
          </div>
          <div class="mj-round-label">四川血战到底</div>
          <div class="mj-center-tiles" id="mjCenterTiles"></div>
        </div>
        <div class="mj-seat mj-seat-bottom" id="seat-bottom"></div>
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
    document.getElementById('mjWallNum').textContent = state.wallLeft;
    document.getElementById('mjTurn').textContent =
      `차례: ${SEAT_LABEL[state.turnSeat]}·${state.players[state.turnSeat].name}`;

    // 다이아몬드 컴퍼스: 현재 차례 방향 표시
    document.getElementById('mjCompassDir').textContent = SEAT_LABEL[state.turnSeat];
    // 카운트다운 중이 아니면 남은 산 수 표시
    if (!this._countdownActive) {
      document.getElementById('mjCompassNum').textContent = String(state.wallLeft).padStart(2, '0');
    }

    // 자리 매핑 (내 시점)
    for (const p of state.players) {
      const offset = (p.seat - this.mySeat + 4) % 4;
      const posMap = { 0: 'bottom', 1: 'right', 2: 'top', 3: 'left' };
      const pos = posMap[offset];
      const isTurn = state.turnSeat === p.seat;
      if (offset === 0) this._renderMe(p, isTurn);
      else this._renderOpponent(pos, p, isTurn);
    }

    // 중앙 · 최근 버려진 패 (전체 통합)
    const lastDiscards = state.discards.slice(-10).reverse();
    document.getElementById('mjCenterTiles').innerHTML = lastDiscards.map(d =>
      `<span class="mj-tile-recent" data-suit="${d.tile.suit}" data-num="${d.tile.num}" title="${SEAT_LABEL[d.from]}에서 버림">${unicodeSymbol(d.tile)}</span>`
    ).join('');
  }

  _renderOpponent(pos, p, isTurn) {
    const el = document.getElementById(`seat-${pos}`);
    if (!el) return;
    el.classList.toggle('turn-active', isTurn);

    // 뒷면 손패
    const backs = '<span class="mj-tile-back"></span>'.repeat(p.handSize);

    // 버림 (최근 6개)
    const discardsHtml = p.discards.slice(-6).map(t =>
      `<span class="mj-tile-mini" data-suit="${t.suit}" data-num="${t.num}">${unicodeSymbol(t)}</span>`
    ).join('');

    el.innerHTML = `
      <div class="mj-seat-name">
        <span class="dir">${SEAT_LABEL[p.seat]}</span>
        <span class="subname">${p.name}</span>
        <span class="count-badge">${p.handSize}</span>
        ${p.missingSuit ? `<span class="mj-missing">缺${SUIT_KO[p.missingSuit] || p.missingSuit}</span>` : ''}
      </div>
      <div class="mj-back-hand">${backs}</div>
      ${p.discards.length ? `<div class="mj-opp-discards">${discardsHtml}</div>` : ''}
    `;
  }

  _renderMe(me, isTurn) {
    const el = document.getElementById('seat-bottom');
    el.classList.toggle('turn-active', isTurn);

    const tiles = this._myHand.map(t =>
      `<button class="mj-tile-my" data-id="${t.id}" data-suit="${t.suit}" data-num="${t.num}" title="${displayName(t)}">${unicodeSymbol(t)}</button>`
    ).join('');

    el.innerHTML = `
      <div class="mj-me-head">
        <span class="mj-me-name">
          <span class="dir">${SEAT_LABEL[me.seat]}</span>${me.name}
        </span>
        <span>
          ${me.missingSuit ? `<span class="mj-missing">缺${SUIT_KO[me.missingSuit] || me.missingSuit}</span>` : ''}
          ${isTurn ? '<span class="mj-turn-badge">내 차례</span>' : ''}
        </span>
      </div>
      <div class="mj-me-hand">${tiles}</div>
      ${me.discards.length ? `
        <div class="mj-me-discards">
          ${me.discards.slice(-14).map(t => `<span class="mj-tile-mini" data-suit="${t.suit}" data-num="${t.num}">${unicodeSymbol(t)}</span>`).join('')}
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
    while (box.children.length > 25) box.removeChild(box.lastChild);
  }

  // ═══════════════ 주사위 오버레이 ═══════════════
  /**
   * 게임 시작 시 주사위 굴리기. 두 개의 눈을 반환.
   * @returns {Promise<{a: number, b: number, total: number, startSeat: number}>}
   */
  showDiceRoll() {
    return new Promise(resolve => {
      const a = 1 + Math.floor(Math.random() * 6);
      const b = 1 + Math.floor(Math.random() * 6);
      const total = a + b;
      // 주사위 총합으로 시작 자리 결정 (반시계 방향, mod 4)
      const startSeat = (total - 1) % 4;

      const overlay = document.createElement('div');
      overlay.className = 'mj-dice-overlay';
      overlay.innerHTML = `
        <div class="mj-dice-wrap">
          <div class="mj-die" id="dieA"></div>
          <div class="mj-die" id="dieB"></div>
        </div>
        <div class="mj-dice-caption">
          주사위 <span class="value" id="diceValA">?</span>+<span class="value" id="diceValB">?</span>
          = <span class="value" id="diceTotal">?</span>
        </div>
        <div class="mj-dice-caption" style="font-size:14px; margin-top:8px;" id="diceStart">
          시작 자리 계산 중...
        </div>
        <button class="mj-dice-start" id="diceOk" style="display:none">start · 시작</button>
      `;
      document.body.appendChild(overlay);

      // 굴리는 애니메이션 중에는 랜덤 눈 표시
      const dieA = overlay.querySelector('#dieA');
      const dieB = overlay.querySelector('#dieB');
      const spinInterval = setInterval(() => {
        this._renderDie(dieA, 1 + Math.floor(Math.random() * 6));
        this._renderDie(dieB, 1 + Math.floor(Math.random() * 6));
      }, 80);

      setTimeout(() => {
        clearInterval(spinInterval);
        this._renderDie(dieA, a);
        this._renderDie(dieB, b);
        overlay.querySelector('#diceValA').textContent = a;
        overlay.querySelector('#diceValB').textContent = b;
        overlay.querySelector('#diceTotal').textContent = total;
        overlay.querySelector('#diceStart').textContent =
          `→ ${SEAT_LABEL[startSeat]} 부터 시작`;
        const okBtn = overlay.querySelector('#diceOk');
        okBtn.style.display = 'inline-block';
        okBtn.onclick = () => {
          overlay.remove();
          resolve({ a, b, total, startSeat });
        };
        // 3초 후 자동 진행
        setTimeout(() => {
          if (document.body.contains(overlay)) {
            overlay.remove();
            resolve({ a, b, total, startSeat });
          }
        }, 3000);
      }, 1400);
    });
  }

  _renderDie(el, num) {
    // 3x3 그리드로 주사위 눈 배치
    const POS = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    const on = new Set(POS[num] || []);
    el.innerHTML = Array.from({ length: 9 }, (_, i) =>
      `<div class="mj-die-dot ${on.has(i) ? 'on' : ''}"></div>`
    ).join('');
  }

  // ═══════════════ 사용자 입력 브리지 ═══════════════

  askMissingSuit(_state, timeoutMs = 25000) {
    this.log('👉 <b>缺 종을 선택하세요</b> · 25초');
    this._startCountdown(timeoutMs);
    return this._askWithButtons([
      { label: '缺 만수', value: 'm' },
      { label: '缺 통수', value: 'p' },
      { label: '缺 삭수', value: 's' },
    ]).finally(() => this._stopCountdown());
  }

  askDiscard(_state, _hand, timeoutMs = 25000) {
    this.log('👉 <b>버릴 패를 탭</b>하세요 · 25초');
    this._startCountdown(timeoutMs);
    return new Promise(resolve => {
      this._askType = 'discard';
      this._askResolver = resolve;
    });
  }

  askClaim(_state, tile, actions, timeoutMs = 25000) {
    if (actions.includes('hu')) {
      this.log(`🀄 <b>후 가능!</b> ${displayName(tile)} 로 화형 완성`);
      this._startCountdown(timeoutMs);
      return this._askWithButtons([
        { label: '후!', value: { action: 'hu' } },
        { label: '패스', value: { action: 'pass' } },
      ]).finally(() => this._stopCountdown());
    }
    return Promise.resolve({ action: 'pass' });
  }

  askSelfHu(_state, tile, timeoutMs = 25000) {
    this.log(`🀄 <b>자모후 가능!</b> ${displayName(tile)} 뽑음`);
    this._startCountdown(timeoutMs);
    return this._askWithButtons([
      { label: '자모후!', value: true },
      { label: '계속', value: false },
    ]).finally(() => this._stopCountdown());
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
      this._stopCountdown();
      this._askResolver = null;
      this._askType = null;
      resolver(tile);
    }
  }
}
