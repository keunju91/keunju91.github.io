// ============================================================================
// 사천마작 규칙 엔진 (四川血战到底)
//
// Phase 1a 범위:
//   · 화형 판정: 표준 4 melds + 1 pair · 七對子
//   · 缺一门 강제 (缺한 종은 손에 있으면 후 불가)
//   · fan 계산: 平胡 / 對對胡 / 清一色 / 七對子 / 缺一门
//
// 나중에 붙일 것 (Phase 1b+):
//   · 龍七對子 / 淸七對子 등 특수 화형
//   · 강 (杠) 관련 fan
//   · 天胡 / 地胡 / 海底 등
//   · 血战到底 전체 진행 (지금은 첫 후 시 종료)
// ============================================================================

import { SUIT, sortTiles } from './tile.js';

/**
 * 손패 (14장) 가 화형인지 판정.
 * @param {Tile[]} tiles 14장 (13장 + 1장) 정렬된 상태
 * @returns {boolean}
 */
export function isWinningHand(tiles) {
  if (tiles.length !== 14) return false;
  if (isSevenPairs(tiles)) return true;
  return isStandardHand(tiles);
}

/**
 * 표준 화형: 4개 meld (순자 or 각자) + 1개 pair
 */
function isStandardHand(tiles) {
  const counts = toCountMap(tiles);
  // 모든 pair 후보에 대해 시도
  for (const key of Object.keys(counts)) {
    if (counts[key] >= 2) {
      counts[key] -= 2;
      if (canFormMelds(counts, 4)) {
        counts[key] += 2;
        return true;
      }
      counts[key] += 2;
    }
  }
  return false;
}

/**
 * countMap 으로부터 정확히 n 개 meld (순자 or 각자) 뽑을 수 있는지.
 * 재귀 탐색.
 */
function canFormMelds(counts, n) {
  if (n === 0) return Object.values(counts).every(v => v === 0);
  // 가장 앞에 있는 (남은 개수 > 0) 패 찾기
  const keys = Object.keys(counts).filter(k => counts[k] > 0).sort();
  if (keys.length === 0) return false;
  const first = keys[0];

  // 시도 1: 각자 (같은 패 3장)
  if (counts[first] >= 3) {
    counts[first] -= 3;
    if (canFormMelds(counts, n - 1)) { counts[first] += 3; return true; }
    counts[first] += 3;
  }

  // 시도 2: 순자 (같은 종 연속 3장) — 자패는 순자 불가
  const suit = first[0];
  const num = Number(first.slice(1));
  if (suit !== SUIT.HONOR && suit !== SUIT.FLOWER && num <= 7) {
    const k1 = `${suit}${num + 1}`;
    const k2 = `${suit}${num + 2}`;
    if ((counts[k1] || 0) >= 1 && (counts[k2] || 0) >= 1) {
      counts[first] -= 1; counts[k1] -= 1; counts[k2] -= 1;
      if (canFormMelds(counts, n - 1)) {
        counts[first] += 1; counts[k1] += 1; counts[k2] += 1;
        return true;
      }
      counts[first] += 1; counts[k1] += 1; counts[k2] += 1;
    }
  }

  return false;
}

/**
 * 七對子 (7 pairs) 판정. 14장이 모두 정확히 2장씩 7종.
 */
export function isSevenPairs(tiles) {
  if (tiles.length !== 14) return false;
  const counts = toCountMap(tiles);
  const vals = Object.values(counts);
  return vals.length === 7 && vals.every(v => v === 2);
}

/**
 * countMap 만들기: { 'm3': 2, 'p9': 1, ... }
 */
export function toCountMap(tiles) {
  const c = {};
  for (const t of tiles) c[t.id] = (c[t.id] || 0) + 1;
  return c;
}

/**
 * 손패에 특정 종이 있는지 (缺 위반 확인용)
 */
export function containsSuit(tiles, suit) {
  return tiles.some(t => t.suit === suit);
}

/**
 * 사천마작 화형 성립 여부 (缺 룰 포함).
 * 缺한 종의 패가 손에 남아있으면 후 불가.
 */
export function canWinSichuan(tiles14, missingSuit) {
  if (missingSuit && containsSuit(tiles14, missingSuit)) return false;
  return isWinningHand(tiles14);
}

/**
 * fan (番) 계산 — Phase 1a 간소화 버전.
 * @returns { fan, tags }  tags: ['平胡', '對對胡', ...]
 */
export function scoreHand(tiles14, missingSuit) {
  const tags = [];
  let fan = 1; // 平胡 기본

  // 缺一门: 자기 缺한 종이 손에 없으면 (당연히 있어선 안 되지만) 그 자체가 조건
  // 실제 사천마작 缺一门 fan 은 손패가 2종만으로 이뤄진 경우 (缺한 종 사용 X)
  const suits = new Set(tiles14.map(t => t.suit));
  if (suits.size <= 2) {
    tags.push('缺一门');
    fan += 1;
  }

  // 七對子
  if (isSevenPairs(tiles14)) {
    tags.push('七對子');
    fan += 2;
    // 清七對子
    if (suits.size === 1) { tags.push('清七對子'); fan += 2; }
  } else {
    // 對對胡: 모두 각자 (순자 없음). Phase 1a 는 표준 화형만 검사.
    if (isAllTriplets(tiles14)) {
      tags.push('對對胡');
      fan += 2;
    }
  }

  // 清一色: 한 종만
  if (suits.size === 1 && !tags.includes('清七對子')) {
    tags.push('清一色');
    fan += 3;
  }

  if (tags.length === 0 || (tags.length === 1 && tags[0] === '平胡')) {
    if (!tags.includes('平胡')) tags.unshift('平胡');
  } else if (!tags.includes('平胡') && !tags.includes('七對子') && !tags.includes('對對胡')) {
    tags.unshift('平胡');
  }

  return { fan, tags };
}

/**
 * 對對胡 판정: 표준 화형 중 모든 meld 가 각자 (順子 없음)
 */
function isAllTriplets(tiles14) {
  const counts = toCountMap(tiles14);
  for (const key of Object.keys(counts)) {
    if (counts[key] >= 2) {
      counts[key] -= 2;
      if (canFormAllTriplets(counts, 4)) {
        counts[key] += 2;
        return true;
      }
      counts[key] += 2;
    }
  }
  return false;
}

function canFormAllTriplets(counts, n) {
  if (n === 0) return Object.values(counts).every(v => v === 0);
  const keys = Object.keys(counts).filter(k => counts[k] > 0);
  if (keys.length === 0) return false;
  const first = keys[0];
  if (counts[first] < 3) return false;
  counts[first] -= 3;
  const ok = canFormAllTriplets(counts, n - 1);
  counts[first] += 3;
  return ok;
}
