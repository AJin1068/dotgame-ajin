// GAME_DESIGN.md 2장 이동·채집·말벌·성공/실패 규칙. canvas를 모르는 순수 함수만 둔다.
// 상태는 바뀌지 않고 새 상태를 돌려준다.

export const MOVE_MS = 150;
const HONEY_MS = 1000; // 2장 채집 계산: 꿀 1개 = 서 있는 시간 1000ms

const DELTAS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// 문자 격자에서 초기 상태를 만든다. honey는 꽃 F의 꿀 양을 읽기 순서(위→아래, 왼→오)로 적은 목록이다.
export function createState(rows, honey = []) {
  if (rows.some((row) => row.length !== rows[0].length)) {
    throw new Error("level rows must all have the same length");
  }
  let start = null;
  const flowerCells = [];
  const wasps = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "B") {
        if (start !== null) throw new Error("level has more than one bee start cell 'B'");
        start = { x, y };
      } else if (row[x] === "F") flowerCells.push({ x, y });
      else if (row[x] === "W") wasps.push({ x, y });
    }
  });
  if (start === null) throw new Error("level has no bee start cell 'B'");
  if (flowerCells.length !== honey.length) throw new Error("level flower count 'F' must equal the honey list length");
  return {
    cols: rows[0].length,
    rows: rows.length,
    x: start.x,
    y: start.y,
    moving: null, // { fromX, fromY, until }: last move's origin and expiry (ms); dropping input is checked against until
    flowers: flowerCells.map((c, i) => ({ ...c, amount: honey[i], collectedMs: 0 })),
    wasps,
    status: "playing", // "playing" | "success" | "fail"
    lastMs: null, // 마지막으로 tick이 정산한 시각 (ms)
  };
}

export function remainingHoney(flower) {
  return flower.amount - Math.floor(flower.collectedMs / HONEY_MS);
}

export function isDone(flower) {
  return flower.collectedMs >= flower.amount * HONEY_MS;
}

// 시각 nowMs까지 정산한다 (채집·말벌 접촉·성공). 이동 중(도착 전) 시간은 채집에 넣지 않는다.
export function tick(state, nowMs) {
  if (state.status !== "playing" || !Number.isFinite(nowMs)) return state;
  if (state.lastMs === null) return { ...state, lastMs: nowMs };
  if (nowMs <= state.lastMs) return state;
  const until = state.moving?.until ?? 0;
  if (nowMs < until) return { ...state, lastMs: nowMs };
  const from = Math.max(state.lastMs, until);
  if (state.wasps.some((w) => w.x === state.x && w.y === state.y)) {
    return { ...state, status: "fail", lastMs: nowMs };
  }
  const flowers = state.flowers.map((f) =>
    f.x === state.x && f.y === state.y && !isDone(f)
      ? { ...f, collectedMs: Math.min(f.amount * HONEY_MS, f.collectedMs + (nowMs - from)) }
      : f,
  );
  const status = flowers.length > 0 && flowers.every(isDone) ? "success" : "playing";
  return { ...state, flowers, status, lastMs: nowMs };
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
  if (state.status !== "playing") return state;
  if (!Number.isFinite(nowMs)) return state;
  if (state.moving !== null && nowMs < state.moving.until) return state;
  if (moveBee(state, dir) === state) return state;
  // 떠나기 전에 지금까지 서 있던 시간을 그 칸에 정산한다. 말벌 칸에 도착해 있었다면 여기서 실패가 확정된다.
  const settled = tick(state, nowMs);
  if (settled.status !== "playing") return settled;
  return {
    ...moveBee(settled, dir),
    moving: { fromX: settled.x, fromY: settled.y, until: nowMs + MOVE_MS },
  };
}
