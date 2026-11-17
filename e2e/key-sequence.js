// e2e: GAME_DESIGN.md 9장 R1 기준 1~4를 키 입력 시퀀스 재생으로 확인한다.
// 실행: node e2e/key-sequence.js   (외부 패키지 없음, Node 22.12 이상)
//
// 무엇을 하나
//   src/main.js 를 가짜 document/window/canvas/requestAnimationFrame/performance 위에서
//   실제로 import 하고, 캡처한 keydown 리스너에 합성 이벤트({ key, repeat })를 시간 순서대로 넣는다.
//   시계는 스크립트가 직접 돌린다. 벌의 위치는 main.js 가 canvas 에 그린 fillRect 호출에서 읽는다
//   (벌 스프라이트의 왼쪽 위 = 타일 좌표 * 32px). 그래서 main.js 의 키 매핑, e.repeat 가드,
//   handleKey 호출, 150ms 보간 렌더까지 한 경로로 지나간다.
//
// 무엇을 못 하나 (정직하게)
//   - 실제 키보드/OS 이벤트가 아니다. 브라우저가 만드는 keydown 이 아니라 스크립트가 만든 객체다.
//     실제 키 반복(e.repeat=true)이 어떤 간격으로 오는지는 브라우저와 OS 설정에 달려 있고, 여기서는 33ms 간격으로 흉내 낸다.
//   - 실제 canvas 픽셀을 보지 않는다. fillRect 호출 인자만 본다. 실제 렌더는 e2e/chrome-render.js 가 따로 본다.
//   - 프레임 간격은 스크립트가 정한 시각에서만 샘플링한다. 실제 rAF 지터나 GC 지연은 재현하지 않는다.
//   - 사람이 브라우저에서 보는 확인(9장)을 대체하지 않는다.

import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { PALETTE } = await import(pathToFileURL(path.join(root, "src/sprites.js")).href);
const { LEVEL_1 } = await import(pathToFileURL(path.join(root, "src/levels.js")).href);
const { createState, handleKey, MOVE_MS } = await import(pathToFileURL(path.join(root, "src/logic.js")).href);

const realPerformance = globalThis.performance;
const TILE = 32; // GAME_DESIGN.md 2장
const BEE_COLORS = new Set(PALETTE.slice(0, 4)); // 벌 스프라이트가 쓰는 팔레트 0~3
const results = [];
let boots = 0;

function check(criterion, name, ok, observed) {
  results.push({ criterion, name, result: ok ? "PASS" : "FAIL", observed });
}

// main.js 를 새 모듈 인스턴스로 띄운다 (시나리오마다 독립된 상태).
async function boot() {
  const rects = [];
  const listeners = [];
  let clock = 0;
  let raf = null;
  const ctx = {
    fillStyle: "",
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h, style: this.fillStyle });
    },
  };
  globalThis.document = { getElementById: () => ({ getContext: () => ctx }) };
  globalThis.window = { addEventListener: (type, fn) => listeners.push({ type, fn }) };
  globalThis.requestAnimationFrame = (cb) => {
    raf = cb;
  };
  Object.defineProperty(globalThis, "performance", {
    value: { now: () => clock },
    configurable: true,
    writable: true,
  });
  await import(`../src/main.js?scenario=${++boots}`);
  const keydown = listeners.find((l) => l.type === "keydown").fn;

  const tile = () => {
    const bee = rects.filter((r) => r.w === 4 && r.h === 4 && BEE_COLORS.has(r.style));
    if (bee.length === 0) throw new Error("bee was not drawn");
    return {
      x: Math.min(...bee.map((r) => r.x)) / TILE,
      y: Math.min(...bee.map((r) => r.y)) / TILE,
    };
  };
  return {
    press(key, at, repeat = false) {
      clock = at;
      keydown({ key, repeat, preventDefault() {} });
    },
    frame(at) {
      clock = at;
      rects.length = 0;
      raf(at);
      return tile();
    },
  };
}

const same = (a, b) => a.x === b.x && a.y === b.y;
const fmt = (p) => `(${p.x},${p.y})`;
const START = { x: 7, y: 4 }; // GAME_DESIGN.md 5장

// 기준 1: 방향키 한 번 = 정확히 한 칸, 150ms 안에 도착.
{
  const dirs = {
    ArrowUp: { x: 7, y: 3 },
    ArrowDown: { x: 7, y: 5 },
    ArrowLeft: { x: 6, y: 4 },
    ArrowRight: { x: 8, y: 4 },
  };
  for (const [key, want] of Object.entries(dirs)) {
    const g = await boot();
    const before = g.frame(0);
    g.press(key, 1000);
    const at150 = g.frame(1000 + MOVE_MS);
    check(1, `${key}: start ${fmt(START)} -> exactly one tile by 150ms`, same(before, START) && same(at150, want), `start ${fmt(before)}, at 150ms ${fmt(at150)}, want ${fmt(want)}`);
  }
  const g = await boot();
  g.frame(0);
  g.press("ArrowRight", 1000);
  const mid = g.frame(1075);
  const late = g.frame(1000 + MOVE_MS - 1);
  const done = g.frame(1000 + MOVE_MS);
  check(1, "ArrowRight: in motion at 75ms, not yet arrived at 149ms, arrived at 150ms", mid.x > 7 && mid.x < 8 && late.x < 8 && done.x === 8, `75ms x=${mid.x}, 149ms x=${late.x}, 150ms x=${done.x}`);
  const s = handleKey(createState(LEVEL_1), "right", 1000);
  check(1, "handleKey: move expires exactly MOVE_MS (150) after the press", s.moving.until - 1000 === 150 && MOVE_MS === 150, `until-now=${s.moving.until - 1000}, MOVE_MS=${MOVE_MS}`);
}

// 기준 2: 누르고 있어도 한 칸만 (keydown 반복 e.repeat=true 는 무시).
{
  const g = await boot();
  g.frame(0);
  g.press("ArrowRight", 2000, false);
  let repeats = 0;
  for (let t = 2500; t <= 4000; t += 33) {
    g.press("ArrowRight", t, true);
    repeats++;
  }
  const end = g.frame(4200);
  check(2, `hold ArrowRight: 1 initial press + ${repeats} repeat events over 2s -> one tile`, same(end, { x: 8, y: 4 }), `end ${fmt(end)}`);
}

// 기준 3: 맵 가장자리 바깥 방향 입력은 아무 일도 없다 (이동 잠금도 걸리지 않는다).
async function edge(name, key, back, steps, want, afterBack) {
  const g = await boot();
  g.frame(0);
  let t = 1000;
  for (let i = 0; i < steps; i++, t += 200) g.press(key, t);
  const atEdge = g.frame(t);
  g.press(key, t + 100); // 가장자리 바깥 입력
  const stay = g.frame(t + 250);
  g.press(back, t + 251); // 바로 다음 입력이 잠금 없이 먹어야 한다
  const moved = g.frame(t + 251 + MOVE_MS);
  check(3, `${name}: outward press at the edge changes nothing and starts no lock`, same(atEdge, want) && same(stay, want) && same(moved, afterBack), `edge ${fmt(atEdge)}, after outward ${fmt(stay)}, then ${back} -> ${fmt(moved)}`);
}
await edge("left edge", "ArrowLeft", "ArrowRight", 7, { x: 0, y: 4 }, { x: 1, y: 4 });
await edge("top edge", "ArrowUp", "ArrowDown", 4, { x: 7, y: 0 }, { x: 7, y: 1 });
await edge("right edge", "ArrowRight", "ArrowLeft", 7, { x: 14, y: 4 }, { x: 13, y: 4 });
await edge("bottom edge", "ArrowDown", "ArrowUp", 5, { x: 7, y: 9 }, { x: 7, y: 8 });

// 기준 4: 이동 중 입력은 버린다. 150ms 뒤 다시 누르면 한 칸 이동한다.
{
  const g = await boot();
  g.frame(0);
  g.press("ArrowRight", 1000);
  g.press("ArrowDown", 1100); // 이동 중 -> 버림
  const dropped = g.frame(1300);
  g.press("ArrowDown", 1400); // 다시 누름 -> 한 칸
  const again = g.frame(1400 + MOVE_MS);
  check(4, "press during a move is dropped; a later press moves one tile", same(dropped, { x: 8, y: 4 }) && same(again, { x: 8, y: 5 }), `after drop ${fmt(dropped)}, after re-press ${fmt(again)}`);

  const a = await boot();
  a.frame(0);
  a.press("ArrowRight", 1000);
  a.press("ArrowDown", 1149); // 149ms: 버림
  check(4, "press at 149ms after a move is dropped", same(a.frame(1500), { x: 8, y: 4 }), `end ${fmt(a.frame(1500))}`);

  const b = await boot();
  b.frame(0);
  b.press("ArrowRight", 1000);
  b.press("ArrowDown", 1150); // 150ms: 먹는다
  check(4, "press at 150ms after a move is accepted", same(b.frame(1300), { x: 8, y: 5 }), `end ${fmt(b.frame(1300))}`);

  const c = await boot();
  c.frame(0);
  c.press("a", 1000); // 방향키가 아닌 키
  check(4, "a non-arrow key does not move the bee", same(c.frame(1200), START), `end ${fmt(c.frame(1200))}`);
  for (const k of ["constructor", "toString", "__proto__"]) c.press(k, 1300);
  check(4, "Object.prototype key names do not move the bee", same(c.frame(1500), START), `end ${fmt(c.frame(1500))}`);
}

const failed = results.filter((r) => r.result !== "PASS");
for (const r of results) console.log(`${r.result}  [criterion ${r.criterion}] ${r.name}\n      ${r.observed}`);
console.log(`\nkey-sequence: ${results.length - failed.length}/${results.length} passed`);

const outDir = process.env.E2E_OUT || path.join(os.tmpdir(), "dotgame-e2e");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "key-sequence-report.json"),
  JSON.stringify(
    {
      kind: "key-sequence-replay",
      command: "node e2e/key-sequence.js",
      note: "Synthetic keydown objects replayed into src/main.js under a stubbed DOM; not real keyboard events, not real canvas pixels.",
      results,
    },
    null,
    2,
  ),
);
// 스크립트가 세운 가짜 전역을 정리한다 (이 파일을 다른 곳에서 import 해도 남지 않도록).
for (const k of ["document", "window", "requestAnimationFrame", "performance"]) {
  if (k === "performance") Object.defineProperty(globalThis, k, { value: realPerformance, configurable: true, writable: true });
  else delete globalThis[k];
}
process.exit(failed.length === 0 ? 0 : 1);
