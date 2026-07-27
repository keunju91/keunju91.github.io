// ============================================================================
// 게임 엔진 · 상태 관리 + 진행 흐름
//
// Phase 1a 범위:
//   · 산 셔플, 초기 배패 (각 13장)
//   · 缺 선택 페이즈 (각 플레이어에게 물어봄)
//   · 뽑기→화형체크→(자모후 or 버리기) 순환
//   · 다른 사람 버린 패로 후 판정 (点炮)
//   · 첫 후 시 게임 종료 (Phase 1a 는 血战 미구현)
// ============================================================================

import { buildSichuanWall, shuffle, sortTiles, SUIT } from './tile.js';
import { canWinSichuan, scoreHand, containsSuit } from './rules-sichuan.js';

export const SEAT_LABEL = ['東', '南', '西', '北'];

export class Game {
  /**
   * @param {Object} opts
   * @param {string} opts.rule - 'sichuan' | 'guobiao'
   * @param {Player[]} opts.players - 4명 (Player interface 구현체)
   * @param {number} [opts.seed] - 랜덤 시드 (재현용, 없으면 Math.random)
   * @param {(event) => void} [opts.onEvent] - 이벤트 콜백
   */
  constructor({ rule, players, seed, onEvent }) {
    if (players.length !== 4) throw new Error('players must be 4');
    this.rule = rule;
    this.players = players;
    this.onEvent = onEvent || (() => {});
    this.rng = seed !== undefined ? mulberry32(seed) : Math.random;

    this.wall = [];         // 남은 산
    this.discards = [];     // 방금 버려진 패 (모두 볼 수 있는 로그)
    this.turnSeat = 0;      // 현재 차례 (0~3)
    this.round = 0;         // 몇 국인지 (Phase 1a 는 1국만)
    this.winner = null;
    this.result = null;
    this.finished = false;
  }

  emit(type, data) {
    this.onEvent({ type, ...data });
  }

  /**
   * 게임 실행. 완전 비동기 진행.
   */
  async run() {
    this.emit('game-start', { rule: this.rule });

    // 1. 산 셔플
    this.wall = shuffle(buildSichuanWall(), this.rng);
    this.emit('wall-built', { size: this.wall.length });

    // 2. 초기 배패 각 13장
    for (const p of this.players) {
      p.hand = sortTiles(this.wall.splice(0, 13));
      p.melds = [];
      p.discards = [];
      p.missingSuit = null;
      this.emit('deal', { seat: p.seat, hand: p.hand });
    }

    // 3. 缺 선택 페이즈 (사천만)
    if (this.rule === 'sichuan') {
      for (const p of this.players) {
        p.missingSuit = await p.decideMissingSuit(this.snapshot());
        this.emit('missing-chosen', { seat: p.seat, suit: p.missingSuit });
      }
    }

    // 4. 메인 루프 · 東 부터 시작
    this.turnSeat = 0;
    while (!this.finished && this.wall.length > 0) {
      await this.playTurn();
    }

    // 5. 종료 처리
    if (!this.finished) {
      this.emit('draw-game', { reason: 'wall-empty' });
      this.result = { type: 'draw' };
    }
    this.emit('game-end', { result: this.result });
    return this.result;
  }

  async playTurn() {
    const player = this.players[this.turnSeat];

    // 뽑기
    const drawn = this.wall.shift();
    player.hand.push(drawn);
    player.hand = sortTiles(player.hand);
    this.emit('draw', { seat: player.seat, tile: drawn, wallLeft: this.wall.length });

    // 자모후 판정
    if (canWinSichuan(player.hand, player.missingSuit)) {
      const wantHu = await player.decideSelfHu(drawn, this.snapshot());
      if (wantHu) {
        return this.declareHu(player, drawn, 'zimo');
      }
    }

    // 버리기 결정
    const discard = await player.decideDiscard(this.snapshot());
    if (!discard || !player.hand.some(t => t.id === discard.id)) {
      // 잘못된 결정 방지: 첫 패로 fallback
      const fallback = player.hand[player.hand.length - 1];
      player.hand = removeOne(player.hand, fallback.id);
      player.discards.push(fallback);
      this.discards.push({ from: player.seat, tile: fallback });
      this.emit('discard', { seat: player.seat, tile: fallback });
    } else {
      player.hand = removeOne(player.hand, discard.id);
      player.discards.push(discard);
      this.discards.push({ from: player.seat, tile: discard });
      this.emit('discard', { seat: player.seat, tile: discard });
    }

    // 다른 3명 후 판정 (点炮)
    const discardedTile = player.discards[player.discards.length - 1];
    for (let offset = 1; offset < 4; offset++) {
      const seat = (this.turnSeat + offset) % 4;
      const p = this.players[seat];
      const testHand = sortTiles([...p.hand, discardedTile]);
      if (canWinSichuan(testHand, p.missingSuit)) {
        const wantHu = await p.decideClaim(
          discardedTile,
          ['hu', 'pass'],
          this.snapshot()
        );
        if (wantHu?.action === 'hu') {
          p.hand = testHand;
          return this.declareHu(p, discardedTile, 'dianpao', player);
        }
      }
    }

    // 다음 차례
    this.turnSeat = (this.turnSeat + 1) % 4;
  }

  declareHu(player, tile, mode, loser = null) {
    const { fan, tags } = scoreHand(player.hand, player.missingSuit);
    this.winner = player;
    this.finished = true;

    // Phase 1a 점수: fan * 2 · 자모는 3인 모두 지불, 点炮는 loser 만
    const basePoints = Math.max(1, fan) * 2;
    this.result = {
      type: mode,      // 'zimo' | 'dianpao'
      winnerSeat: player.seat,
      loserSeat: loser?.seat ?? null,
      winTile: tile,
      hand: player.hand,
      fan,
      tags,
      points: basePoints,
    };
    this.emit('hu', this.result);
  }

  /**
   * 현재 게임 상태 요약 (Player 에게 전달용).
   * 상대 손패는 length 만 노출 (마작 원칙).
   */
  snapshot() {
    return {
      rule: this.rule,
      turnSeat: this.turnSeat,
      wallLeft: this.wall.length,
      discards: this.discards.map(d => ({ ...d })),
      players: this.players.map(p => ({
        seat: p.seat,
        name: p.name,
        handSize: p.hand.length,
        melds: p.melds,
        discards: p.discards,
        missingSuit: p.missingSuit,
      })),
    };
  }
}

function removeOne(arr, id) {
  const idx = arr.findIndex(t => t.id === id);
  if (idx === -1) return arr;
  return [...arr.slice(0, idx), ...arr.slice(idx + 1)];
}

// 시드 있는 랜덤 (재현 가능)
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
