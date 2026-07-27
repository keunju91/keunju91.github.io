// ============================================================================
// 마작 패 (Tile) 정의
// 만수 (m1~m9) · 통수 (p1~p9) · 삭수 (s1~s9) · 자패 (z1~z7) · 화패 (f1~f8)
// 사천마작은 만·통·삭 3종만 사용 (자패·화패 없음)
// 국표마작은 자패 · 화패 포함
// ============================================================================

export const SUIT = Object.freeze({
  MAN: 'm',    // 만수 萬
  PIN: 'p',    // 통수 筒
  SOU: 's',    // 삭수 索
  HONOR: 'z',  // 자패 (동남서북백발중)
  FLOWER: 'f', // 화패 (춘하추동매란국죽)
});

export const HONOR_NAME = ['', '東', '南', '西', '北', '白', '發', '中'];
export const FLOWER_NAME = ['', '春', '夏', '秋', '冬', '梅', '蘭', '菊', '竹'];

/**
 * Tile 하나를 { suit, num, id } 로 표현.
 *   suit: SUIT.MAN | PIN | SOU | HONOR | FLOWER
 *   num:  1~9 (수패) | 1~7 (자패) | 1~8 (화패)
 *   id:   'm3', 'p9', 's1', 'z5', 'f2' 형식
 */
export function tile(suit, num) {
  return Object.freeze({ suit, num, id: `${suit}${num}` });
}

export function fromId(id) {
  return tile(id[0], Number(id.slice(1)));
}

/**
 * 사천마작용 산 (108매): 만·통·삭 각 9종 x 4장 = 108
 */
export function buildSichuanWall() {
  const wall = [];
  for (const s of [SUIT.MAN, SUIT.PIN, SUIT.SOU]) {
    for (let n = 1; n <= 9; n++) {
      for (let i = 0; i < 4; i++) wall.push(tile(s, n));
    }
  }
  return wall;
}

/**
 * 국표마작용 산 (144매): 만·통·삭 108 + 자패 28 + 화패 8
 */
export function buildGuobiaoWall() {
  const wall = buildSichuanWall();
  for (let n = 1; n <= 7; n++) {
    for (let i = 0; i < 4; i++) wall.push(tile(SUIT.HONOR, n));
  }
  for (let n = 1; n <= 8; n++) {
    wall.push(tile(SUIT.FLOWER, n)); // 화패는 각 1장씩
  }
  return wall;
}

/**
 * 패 정렬 순서: 만 → 통 → 삭 → 자 → 화
 */
const SUIT_ORDER = { m: 0, p: 1, s: 2, z: 3, f: 4 };

export function sortTiles(tiles) {
  return [...tiles].sort((a, b) => {
    if (a.suit !== b.suit) return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    return a.num - b.num;
  });
}

/**
 * Fisher-Yates 셔플
 */
export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 디스플레이용 문자 (간단 텍스트 렌더)
 * m3 → '3萬', p9 → '9筒', s1 → '1索', z5 → '白', f1 → '春'
 */
export function displayName(t) {
  if (t.suit === SUIT.HONOR) return HONOR_NAME[t.num];
  if (t.suit === SUIT.FLOWER) return FLOWER_NAME[t.num];
  const suffix = { m: '萬', p: '筒', s: '索' }[t.suit];
  return `${t.num}${suffix}`;
}

/**
 * 유니코드 마작 심볼 (🀇~🀫)
 * 만수 U+1F007..1F00F, 통수 U+1F019..1F021, 삭수 U+1F010..1F018
 * 자패 U+1F000..1F006, 화패 U+1F022..1F029
 */
export function unicodeSymbol(t) {
  const code = ((suit, num) => {
    switch (suit) {
      case SUIT.MAN:    return 0x1F007 + num - 1;
      case SUIT.PIN:    return 0x1F019 + num - 1;
      case SUIT.SOU:    return 0x1F010 + num - 1;
      case SUIT.HONOR:  return 0x1F000 + num - 1;
      case SUIT.FLOWER: return 0x1F022 + num - 1;
      default: return null;
    }
  })(t.suit, t.num);
  return code ? String.fromCodePoint(code) : '?';
}
