// GAME_DESIGN.md 2장 이동 규칙. canvas를 모르는 순수 함수만 둔다.
// 상태는 바뀌지 않고 새 상태를 돌려준다.

export const MOVE_MS = 150;

const DELTAS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// 문자 격자에서 초기 상태를 만든다.
export function createState(rows) {
  if (rows.some((row) => row.length !== rows[0].length)) {
    throw new Error("level rows must all have the same length");
  }
  let start = null;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "B") {
        if (start !== null) throw new Error("level has more than one bee start cell 'B'");
        start = { x, y };
      }
    }
  });
  if (start === null) throw new Error("level has no bee start cell 'B'");
  return {
    cols: rows[0].length,
    rows: rows.length,
    x: start.x,
    y: start.y,
    moving: null, // { fromX, fromY, until }: last move's origin and expiry (ms); dropping input is checked against until
  };
}

// 한 칸 이동. 맵 밖이면 같은 상태를 돌려준다.
export function moveBee(state, dir) {
  if (!Object.hasOwn(DELTAS, dir)) return state;
  const delta = DELTAS[dir];
  const nx = state.x + delta.dx;
  const ny = state.y + delta.dy;
  if (nx < 0 || ny < 0 || nx >= state.cols || ny >= state.rows) return state;
  return { ...state, x: nx, y: ny };
}

// 키 입력 처리. 이동 중(MOVE_MS 안)에 들어온 입력은 버린다.
export function handleKey(state, dir, nowMs) {
  if (!Number.isFinite(nowMs)) return state;
  if (state.moving !== null && nowMs < state.moving.until) return state;
  const moved = moveBee(state, dir);
  if (moved === state) return state;
  return {
    ...moved,
    moving: { fromX: state.x, fromY: state.y, until: nowMs + MOVE_MS },
  };
}
