// e2e: GAME_DESIGN.md 9장 R1 기준 1~4와 R2 기준 5~11을 키 입력 시퀀스 재생으로 확인한다.
// 실행: node e2e/key-sequence.js   (외부 패키지 없음, Node 22.12 이상)
//
// 무엇을 하나
//   src/main.js 를 가짜 document/window/canvas/requestAnimationFrame/performance 위에서
//   실제로 import 하고, 캡처한 keydown 리스너에 합성 이벤트({ key, repeat })를 시간 순서대로 넣는다.
//   시계는 스크립트가 직접 돌린다. 벌의 위치는 main.js 가 canvas 에 그린 fillRect 호출에서 읽는다
//   (프레임의 마지막 50개 4x4 rect = 벌 스프라이트, 그 왼쪽 위 = 타일 좌표 * 32px; BEE_SPRITE와 좌표·색이 일치하는지 매번 검증한다).
//   꿀 칸은 2x4px #FFD23F rect 개수, 막대 바탕은 높이 6 #1A1A1A rect 폭, 결과 화면은 480x320 fillRect 색으로 읽는다. 그래서 main.js 의 키 매핑, e.repeat 가드,
//   handleKey 호출, 150ms 보간 렌더까지 한 경로로 지나간다.
//
// 무엇을 못 하나 (정직하게)
//   - 실제 키보드/OS 이벤트가 아니다. 브라우저가 만드는 keydown 이 아니라 스크립트가 만든 객체다.
//     실제 키 반복(e.repeat=true)이 어떤 간격으로 오는지는 브라우저와 OS 설정에 달려 있고, 여기서는 33ms 간격으로 흉내 낸다.
//   - 실제 canvas 픽셀을 보지 않는다. fillRect 호출 인자만 본다. 실제 렌더는 e2e/chrome-render.js 가 따로 본다.
//   - 프레임 간격은 스크립트가 정한 시각에서만 샘플링한다. 실제 rAF 지터나 GC 지연은 재현하지 않는다.
//   - 실제 시간 체감, 꽃 모양, 막대 가독성을 보지 못한다. 실제 rAF 타임스탬프와 performance.now 사이의 불일치도 재현하지 않는다(시계는 하나의 가짜 시계).
//   - 사람이 브라우저에서 보는 확인(9장)을 대체하지 않는다.

import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { PALETTE, BEE_SPRITE } = await import(pathToFileURL(path.join(root, "src/sprites.js")).href);
const { LEVEL_1, LEVEL_1_HONEY } = await import(pathToFileURL(path.join(root, "src/levels.js")).href);
const { createState, handleKey, MOVE_MS } = await import(pathToFileURL(path.join(root, "src/logic.js")).href);

const realPerformance = globalThis.performance;
const TILE = 32; // GAME_DESIGN.md 2장
const BAR_BASE = PALETTE[0]; // 꿀 칸 막대 바탕 (4장)
const HONEY = PALETTE[1]; // 꿀 칸 (4장)
const RESULT_SUCCESS = PALETTE[1]; // 3장 결과 화면 배경
const RESULT_FAIL = PALETTE[7];
// 벌 스프라이트의 비투명 픽셀 50개: 스프라이트 왼쪽 위 기준 상대 좌표와 색.
const BEE_PIXELS = BEE_SPRITE.flatMap((row, py) => row.flatMap((idx, px) => (idx === null ? [] : [`${px * 4},${py * 4},${PALETTE[idx]}`]))).sort();
// LEVEL_1 문자 격자에서 F(읽기 순서)와 W 칸을 읽는다.
const cells = (ch) => LEVEL_1.flatMap((row, y) => [...row].flatMap((c, x) => (c === ch ? [{ x, y }] : [])));
const FLOWERS = cells("F").map((c, i) => ({ ...c, amount: LEVEL_1_HONEY[i] }));
const WASP = cells("W")[0];
const results = [];
let boots = 0;

function check(criterion, name, ok, observed) {
  results.push({ criterion, name, result: ok ? "PASS" : "FAIL", observed });
}

// main.js 를 새 모듈 인스턴스로 띄운다 (시나리오마다 독립된 상태).
async function boot() {
  const rects = [];
  const prevented = [];
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

  // 벌 식별 계약 (4장 그리기 순서): 4x4 rect 중 마지막 50개가 벌이다. 4x4가 하나도 없으면 결과 화면이라 null.
  // 마지막 50개가 BEE_SPRITE와 정확히 같지 않으면 그리기 순서가 깨진 것이므로 throw 한다.
  const tile = () => {
    const small = rects.filter((r) => r.w === 4 && r.h === 4);
    if (small.length === 0) return null;
    const bee = small.slice(-BEE_PIXELS.length);
    const left = Math.min(...bee.map((r) => r.x));
    const top = Math.min(...bee.map((r) => r.y));
    const rel = (v) => Math.round(v * 1e6) / 1e6; // 이동 중 보간의 부동소수 오차를 없앤다
    const got = bee.map((r) => `${rel(r.x - left)},${rel(r.y - top)},${r.style}`).sort();
    if (got.length !== BEE_PIXELS.length || got.some((v, i) => v !== BEE_PIXELS[i])) throw new Error("last 50 4x4 rects are not the bee sprite (draw order broken)");
    return { x: left / TILE, y: top / TILE };
  };
  const inTile = (r, x, y) => r.x >= x * TILE && r.x < (x + 1) * TILE && r.y >= y * TILE && r.y < (y + 1) * TILE;
  return {
    prevented,
    press(key, at, repeat = false) {
      clock = at;
      keydown({ key, repeat, preventDefault() { prevented.push(key); } });
    },
    frame(at) {
      clock = at;
      rects.length = 0;
      raf(at);
      return tile();
    },
    tile,
    // 같은 프레임의 결과 화면 배경색 (480x320 fillRect), 없으면 null.
    result: () => rects.find((r) => r.w === 480 && r.h === 320)?.style ?? null,
    // 그 타일 안의 꿀 칸(2x4 #FFD23F) 수.
    honeyLeft: (x, y) => rects.filter((r) => r.w === 2 && r.h === 4 && r.style === HONEY && inTile(r, x, y)).length,
    // 그 타일의 막대 바탕(높이 6, #1A1A1A) 폭, 없으면 null.
    barWidth: (x, y) => rects.find((r) => r.h === 6 && r.style === BAR_BASE && inTile(r, x, y))?.w ?? null,
    // 그 타일 안의 모든 rect (모양 비교용).
    tileRects: (x, y) => JSON.stringify(rects.filter((r) => inTile(r, x, y))),
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
  const s = handleKey(createState(LEVEL_1, LEVEL_1_HONEY), "right", 1000);
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
  const stay = g.frame(t + 110);
  g.press(back, t + 120); // 바깥 입력이 150ms 잠금을 걸었다면 t+250까지 막히므로, 20ms 뒤 입력이 먹어야 잠금이 없었다는 증거다
  const moved = g.frame(t + 120 + MOVE_MS);
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
  check(4, "only arrow keys call preventDefault (page keys like 'a' and prototype names are left alone)", c.prevented.length === 0, `preventDefault called for: ${JSON.stringify(c.prevented)}`);
  check(4, "Object.prototype key names do not move the bee", same(c.frame(1500), START), `end ${fmt(c.frame(1500))}`);
  c.press("ArrowDown", 1600);
  check(4, "an arrow key does call preventDefault (page does not scroll)", c.prevented.join() === "ArrowDown", `preventDefault called for: ${JSON.stringify(c.prevented)}`);
}

check(11, "R1 criteria 1-4 ran 18 checks (6+1+4+7) with unchanged expectations on the R2 map", results.length === 18 && results.every((r) => r.criterion >= 1 && r.criterion <= 4 && r.result === "PASS"), `${results.length} R1 checks, ${results.filter((r) => r.result !== "PASS").length} failing`);

// ---- R2 기준 5~10 ----
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// 입력을 150ms 간격으로 넣고 마지막 이동의 도착 시각을 돌려준다.
const go = (g, keys, t) => {
  for (const k of keys) {
    g.press(k, t);
    t += MOVE_MS;
  }
  return t;
};
const times = (key, n) => Array(n).fill(key);
const toF0 = [...times("ArrowUp", 3), ...times("ArrowLeft", 5)]; // (7,4) -> (2,1)
const first = FLOWERS[0];
const honeyAll = (g) => FLOWERS.map((f) => g.honeyLeft(f.x, f.y));

// 기준 5: 꽃 5송이 칸 수 5·6·7·8·9 (읽기 순서), 막대 바탕 폭 3*양+1, 1분 뒤에도 말벌 타일 불변.
{
  const g = await boot();
  g.frame(0);
  const wasp0 = g.tileRects(WASP.x, WASP.y);
  const honey0 = honeyAll(g);
  const bars0 = FLOWERS.map((f) => g.barWidth(f.x, f.y));
  g.frame(60000);
  check(5, "t=0: 5 flowers show 5,6,7,8,9 honey cells in reading order", eq(honey0, [5, 6, 7, 8, 9]), `honey cells ${JSON.stringify(honey0)}`);
  check(5, "t=0: bar base widths are 3*amount+1 = 16,19,22,25,28", eq(bars0, [16, 19, 22, 25, 28]), `bar widths ${JSON.stringify(bars0)}`);
  check(5, "t=60000ms: flowers and bars unchanged, wasp tile identical (does not move)", eq(honeyAll(g), [5, 6, 7, 8, 9]) && eq(FLOWERS.map((f) => g.barWidth(f.x, f.y)), bars0) && g.tileRects(WASP.x, WASP.y) === wasp0 && wasp0 !== "[]", `honey ${JSON.stringify(honeyAll(g))}, wasp tile rects ${wasp0.length} chars`);
}

// 기준 6: 첫 꽃 도착 1초 뒤부터 1초에 칸 1개, 5초에 꽃·막대 사라짐, 이동 중 불변, 다른 꽃 불변.
{
  const g = await boot();
  g.frame(0);
  const arrive = go(g, toF0, 0);
  g.frame(arrive - 1);
  check(6, "just before arriving at the first flower (2,1): 5 honey cells", g.honeyLeft(first.x, first.y) === 5, `honey ${g.honeyLeft(first.x, first.y)}`);
  g.frame(arrive + 999);
  const at999 = g.honeyLeft(first.x, first.y);
  g.frame(arrive + 1000);
  const at1000 = g.honeyLeft(first.x, first.y);
  check(6, "1000ms after arrival 4 cells (999ms: still 5)", at999 === 5 && at1000 === 4, `999ms ${at999}, 1000ms ${at1000}`);
  g.frame(arrive + 4999);
  const at4999 = g.honeyLeft(first.x, first.y);
  g.frame(arrive + 5000);
  check(6, "5000ms after arrival flower and bar are gone (4999ms: 1 cell left)", at4999 === 1 && g.honeyLeft(first.x, first.y) === 0 && g.barWidth(first.x, first.y) === null, `4999ms ${at4999}, 5000ms cells ${g.honeyLeft(first.x, first.y)} bar ${g.barWidth(first.x, first.y)}`);
  check(6, "other flowers unchanged (6,7,8,9)", eq(honeyAll(g).slice(1), [6, 7, 8, 9]), `honey ${JSON.stringify(honeyAll(g))}`);
}

// 기준 7: 2초 서다 떠남(남은 3) -> 떠난 동안 유지 -> 복귀 3초에 사라짐.
{
  const g = await boot();
  g.frame(0);
  const arrive = go(g, toF0, 0);
  g.frame(arrive + 1000);
  g.press("ArrowDown", arrive + 2000); // 2초 서다 떠남
  const away = [];
  for (const dt of [2500, 6000, 9000]) {
    g.frame(arrive + dt);
    away.push(g.honeyLeft(first.x, first.y));
  }
  const back = arrive + 10000;
  g.press("ArrowUp", back); // 복귀
  const back0 = back + MOVE_MS;
  g.frame(back0 + 2999);
  const at2999 = g.honeyLeft(first.x, first.y);
  g.frame(back0 + 3000);
  check(7, "left after 2s: 3 cells stay 3 while away (no decay, no regrow)", eq(away, [3, 3, 3]), `while away ${JSON.stringify(away)}`);
  check(7, "after returning, the flower is gone 3000ms later (2999ms: 1 cell left)", at2999 === 1 && g.honeyLeft(first.x, first.y) === 0 && g.barWidth(first.x, first.y) === null, `2999ms ${at2999}, 3000ms ${g.honeyLeft(first.x, first.y)}`);
}

// 기준 8: 말벌 옆 칸 3초 안전, 말벌 칸 도착 순간 실패 화면(#D9482B), 입력 무반응.
{
  const g = await boot();
  g.frame(0);
  const arrive = go(g, ["ArrowUp", "ArrowLeft", "ArrowLeft"], 0); // (5,3), 말벌 바로 옆
  const side = g.frame(arrive + 3000);
  check(8, "standing next to the wasp (5,3) for 3s: nothing happens", eq(side, { x: WASP.x + 1, y: WASP.y }) && g.result() === null, `tile ${fmt(side)}, result ${g.result()}`);
  const t = arrive + 3000;
  g.press("ArrowLeft", t);
  g.frame(t + MOVE_MS - 1);
  const pre = g.result();
  const post = g.frame(t + MOVE_MS);
  check(8, "arriving on the wasp tile: 149ms no result, 150ms screen is #D9482B and no 4x4 sprite rects", pre === null && g.result() === RESULT_FAIL && post === null, `before ${pre}, after ${g.result()}, tile ${post}`);
  g.press("ArrowRight", t + 1000);
  g.frame(t + 1500);
  check(8, "after failing, arrow keys change nothing", g.result() === RESULT_FAIL && g.tile() === null, `result ${g.result()}`);
}

// 기준 9: 3-8 경로 전체 재생: 42199ms 아직, 42200ms 성공 화면(#FFD23F), 입력 무반응.
{
  const g = await boot();
  g.frame(0);
  const route = [
    [[...times("ArrowLeft", 5), ...times("ArrowUp", 3)], 5],
    [times("ArrowRight", 9), 6],
    [["ArrowRight", ...times("ArrowDown", 5)], 7],
    [[...times("ArrowDown", 2), ...times("ArrowLeft", 11)], 8],
    [times("ArrowRight", 12), 9],
  ];
  let t = 0;
  let moves = 0;
  let sawEarly = false;
  for (const [keys, honey] of route) {
    g.frame(t);
    t = go(g, keys, t);
    moves += keys.length;
    sawEarly = sawEarly || g.result() !== null;
    t += honey * 1000;
  }
  const last = t;
  g.frame(last - 1);
  const before = g.result();
  const beforeTile = g.tile();
  g.frame(last);
  check(9, "full route (48 moves, 35s of honey): no result at 42199ms, #FFD23F at 42200ms", moves === 48 && last === 42200 && !sawEarly && before === null && beforeTile !== null && g.result() === RESULT_SUCCESS && g.tile() === null, `moves ${moves}, last ${last}, 42199ms result ${before}, 42200ms result ${g.result()}`);
  g.press("ArrowLeft", last + 1000);
  g.frame(last + 1500);
  check(9, "after success, arrow keys change nothing", g.result() === RESULT_SUCCESS && g.tile() === null, `result ${g.result()}`);
}

// 기준 10: 새 모듈 인스턴스(= 모듈 범위 상태가 새로 만들어짐, 새로고침의 대용)는 처음 상태다.
{
  const dead = await boot();
  dead.frame(0);
  go(dead, ["ArrowUp", "ArrowLeft", "ArrowLeft", "ArrowLeft"], 0);
  dead.frame(600);
  const failedNow = dead.result();
  const g = await boot();
  const start = g.frame(0);
  const ok = failedNow === RESULT_FAIL && g.result() === null && eq(honeyAll(g), [5, 6, 7, 8, 9]) && eq(start, START);
  g.press("ArrowRight", 1000);
  const moved = g.frame(1000 + MOVE_MS);
  check(10, "a fresh module instance after a fail shows no result, honey 5,6,7,8,9, bee (7,4), and arrow keys move", ok && eq(moved, { x: 8, y: 4 }), `previous result ${failedNow}, fresh result ${g.result()}, honey ${JSON.stringify(honeyAll(g))}, start ${fmt(start)}, after right ${fmt(moved)} (module-scope state check; a real F5 is the human check 10)`);
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
