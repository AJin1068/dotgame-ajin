// e2e: GAME_DESIGN.md 9장 R1 기준 1~4, R2 기준 5~11, R3 기준 12~19를 키 입력 시퀀스 재생으로 확인한다.
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
//   - 실제 소리를 듣지 않는다. 가짜 AudioContext가 받은 호출(type·frequency·start 오프셋)만 읽는다. 글자 모양도 보지 못하고 fillText 호출(문구·위치·색)만 읽는다.
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
async function boot(opts = {}) {
  const rects = [];
  const prevented = [];
  const listeners = [];
  let clock = 0;
  let raf = null;
  const texts = [];
  const notes = [];
  const gains = [];
  const ctx = {
    fillStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h, style: this.fillStyle });
    },
    fillText(text, x, y) {
      texts.push({ text, x, y, style: this.fillStyle, align: this.textAlign });
    },
  };
  // 가짜 AudioContext (opts.audio): 음 하나 = 오실레이터 1개 + 게인 1개, start(when)의 when을 현재 가짜 시각 기준 오프셋으로 기록한다.
  if (opts.audio) {
    globalThis.AudioContext = class {
      constructor() {
        this.destination = {};
      }
      get currentTime() {
        return clock / 1000;
      }
      resume() {}
      createOscillator() {
        const c = this;
        return {
          type: "",
          frequency: { value: 0 },
          connect() {},
          start(when) {
            notes.push({ type: this.type, freq: this.frequency.value, start: when - c.currentTime });
          },
          stop() {},
        };
      }
      createGain() {
        const g = { gain: { value: 0 }, connect() {} };
        gains.push(g);
        return g;
      }
    };
  } else {
    delete globalThis.AudioContext;
  }
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
    rects,
    texts,
    notes,
    gains,
    press(key, at, repeat = false) {
      clock = at;
      keydown({ key, repeat, preventDefault() { prevented.push(key); } });
    },
    frame(at) {
      clock = at;
      rects.length = 0;
      texts.length = 0;
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

// ---- R3 기준 12~19 ----
const r12Count = results.length; // R1 18 + 기준 11 + R2 기준 5~10
const RESULT_STORM = PALETTE[3]; // 6장: 소나기 실패 화면 배경
const TXT = {
  levelClear1: "레벨 1 클리어! 곧 다음 레벨",
  levelClear2: "레벨 2 클리어! 곧 다음 레벨",
  allClear: "모든 레벨 클리어! 다시 하려면 F5",
  failWasp: "말벌에 닿았어요. 다시 하려면 F5",
  failStorm: "소나기가 왔어요. 다시 하려면 F5",
};
const up = (n) => times("ArrowUp", n);
const down = (n) => times("ArrowDown", n);
const left = (n) => times("ArrowLeft", n);
const right = (n) => times("ArrowRight", n);
// 9장 클리어 경로 (키 배열, 꿀 양)
const ROUTE_L1 = [
  [[...left(5), ...up(3)], 5],
  [right(9), 6],
  [["ArrowRight", ...down(5)], 7],
  [[...down(2), ...left(11)], 8],
  [right(12), 9],
];
const ROUTE_L2 = [
  [["ArrowLeft", ...down(4)], 9],
  [[...left(2), ...up(2)], 8],
  [right(8), 8],
  [["ArrowRight", ...up(5)], 7],
  [left(12), 6],
];
const ROUTE_L3 = [
  [[...up(3), ...left(5)], 7],
  [right(10), 8],
  [["ArrowRight", ...down(5)], 9],
  [[...left(5), ...down(2)], 9],
  [[...left(7), ...up(2)], 8],
];
// 꽃마다 꿀이 다 사라질 때까지 서 있으며 경로를 재생하고, 성공이 나는 시각을 돌려준다.
const run = (g, route, t) => {
  for (const [keys, honey] of route) {
    t = go(g, keys, t);
    t += honey * 1000;
  }
  return t;
};
const hudText = (g) => g.texts.filter((x) => x.y === 336).map((x) => x.text).join(" | ");
const resultText = (g) => g.texts.find((x) => x.y === 232);
const waspTiles = (g) => [...new Set(g.rects.filter((r) => r.w === 4 && r.h === 4 && r.style === PALETTE[7]).map((r) => `${Math.floor(r.x / TILE)},${Math.floor(r.y / TILE)}`))].sort();
const honeyOf = (g, cells) => cells.map(([x, y]) => g.honeyLeft(x, y));
const L2_FLOWERS = [[1, 1], [13, 1], [4, 6], [12, 6], [6, 8]];
const L3_FLOWERS = [[2, 1], [12, 1], [1, 6], [13, 6], [8, 8]];
// 앞 레벨을 경로로 클리어해 n번째 레벨(2|3)이 막 시작된 상태와 그 시작 시각을 돌려준다 (점프 없음).
async function reach(n) {
  const g = await boot();
  g.frame(0);
  let t = run(g, ROUTE_L1, 0);
  g.frame(t);
  t += 3000;
  g.frame(t);
  if (n === 3) {
    t = run(g, ROUTE_L2, t);
    g.frame(t);
    t += 3000;
    g.frame(t);
  }
  return { g, t };
}

// 기준 12: HUD "레벨 1/3"·"소나기 90초", 1초에 1씩 줄고(올림), 꽃·꿀 칸·말벌은 HUD에 가려지지 않는다.
{
  const g = await boot();
  g.frame(0);
  const h0 = hudText(g);
  const hud = g.rects.find((r) => r.w === 480 && r.h === 32);
  g.frame(30000);
  const h30 = hudText(g);
  g.frame(61000);
  const h61 = hudText(g);
  check(12, "HUD at t=0 shows level 1/3 and storm 90, drawn as a 480x32 #1A1A1A strip at y=320 (below the 480x320 map area)", h0.includes("레벨 1/3") && h0.includes("소나기 90초") && hud?.y === 320 && hud?.style === PALETTE[0], `hud "${h0}", bar ${JSON.stringify(hud)}`);
  check(12, "HUD countdown: 30000ms -> 60, 61000ms -> 29 (rounded up)", h30.includes("소나기 60초") && h61.includes("소나기 29초"), `30s "${h30}", 61s "${h61}"`);
  check(12, "HUD text is yellow (#FFD23F) with left/right alignment; HUD does not cover flowers or honey cells (5,6,7,8,9 still counted)", g.texts.filter((x) => x.y === 336).length === 2 && g.texts.filter((x) => x.y === 336).every((x) => x.style === PALETTE[1]) && g.texts.find((x) => x.text.startsWith("레벨"))?.align === "left" && g.texts.find((x) => x.text.startsWith("소나기"))?.align === "right" && eq(honeyAll(g), [5, 6, 7, 8, 9]), `texts ${JSON.stringify(g.texts)}`);
}

// 기준 12 (HUD 띠): 벌이 9행(맨 아래 줄)까지 내려가도 HUD와 겹치지 않고, HUD rect·글자는 모두 y>=320.
{
  const g = await boot();
  g.frame(0);
  for (let i = 0; i < 5; i++) { g.press("ArrowDown", 1000 + i * 300); g.frame(1000 + i * 300 + MOVE_MS); }
  g.press("ArrowDown", 1000 + 5 * 300); // 맨 아래 줄에서 한 번 더 누르면 가장자리 무시
  const t = g.frame(1000 + 5 * 300 + MOVE_MS);
  const beeRects = g.rects.filter((r) => r.w === 4 && r.h === 4).slice(-50);
  const hudRects = g.rects.filter((r) => r.w === 480 && r.h === 32);
  const beeBottom = Math.max(...beeRects.map((r) => r.y + r.h));
  const hudTexts = g.texts.filter((x) => x.text.startsWith("레벨") || x.text.startsWith("소나기"));
  const fonts = hudTexts.map((x) => x.y);
  const nonHudBelow = g.rects.filter((r) => r.y + r.h > 320 && !(r.w === 480 && r.h === 32));
  check(12, "bee walked down to row 9 draws at y>=288 (last row visible) and ends above the HUD strip (y<=319), never overlapping it", t.x === 7 && t.y === 9 && Math.min(...beeRects.map((r) => r.y)) >= 288 && beeBottom <= 320, `bee tile ${fmt(t)}, bee y ${Math.min(...beeRects.map((r) => r.y))}..${beeBottom}`);
  check(12, "HUD rect(s) and both HUD texts lie entirely at y>=320, text centred in the strip (y=336), and no other rect crosses into y>=320", hudRects.length === 1 && hudRects[0].y >= 320 && hudRects[0].y + hudRects[0].h === 352 && hudTexts.length === 2 && fonts.every((y) => y === 336) && nonHudBelow.length === 0, `hud ${JSON.stringify(hudRects)}, text y ${JSON.stringify(fonts)}, others below 320: ${nonHudBelow.length}`);
}

// 기준 13: 키 없이 90초 -> #F4F8FF 소나기 화면 + 문구, 이후 입력 무반응. 말벌 실패 화면은 #D9482B + 말벌 문구.
{
  const g = await boot();
  g.frame(0);
  const pre = g.frame(89999);
  const preResult = g.result();
  g.frame(90000);
  const txt = resultText(g);
  check(13, "storm: 89999ms no result and the bee is drawn; 90000ms screen is #F4F8FF", preResult === null && pre !== null && g.result() === RESULT_STORM, `89999ms result ${preResult} tile ${fmt(pre)}, 90000ms result ${g.result()}`);
  check(13, "storm screen text is failStorm at (240,232), centered, #1A1A1A; no 4x4 sprite rects (the panel and big bee are 8px)", txt?.text === TXT.failStorm && txt.x === 240 && txt.align === "center" && txt.style === PALETTE[0] && g.tile() === null, `text ${JSON.stringify(txt)}`);
  g.press("ArrowRight", 91000);
  g.frame(91500);
  check(13, "after the storm, arrow keys change nothing", g.result() === RESULT_STORM && g.tile() === null && resultText(g)?.text === TXT.failStorm, `result ${g.result()}`);
  const w = await boot();
  w.frame(0);
  const arrive = go(w, ["ArrowUp", ...left(3)], 0);
  w.frame(arrive);
  const wt = resultText(w);
  check(13, "wasp fail screen is #D9482B with failWasp text in #F4F8FF (differs from the storm screen)", w.result() === RESULT_FAIL && w.result() !== RESULT_STORM && wt?.text === TXT.failWasp && wt.style === PALETTE[3], `result ${w.result()}, text ${JSON.stringify(wt)}`);
}

// 기준 14: 레벨 1 클리어 -> 노랑 + 문구 3초 -> 레벨 2.
let L2start;
{
  const g = await boot();
  g.frame(0);
  const last = run(g, ROUTE_L1, 0);
  g.frame(last - 1);
  const early = g.result();
  g.frame(last);
  const txt = resultText(g);
  check(14, "level 1 clear route: #FFD23F at 42200ms with levelClear(1) text", early === null && last === 42200 && g.result() === RESULT_SUCCESS && txt?.text === TXT.levelClear1 && txt.style === PALETTE[0], `early ${early}, result ${g.result()}, text ${JSON.stringify(txt)}`);
  g.press("ArrowLeft", last + 1000);
  g.frame(last + 2999);
  check(14, "success screen holds for 2999ms and ignores arrow keys", g.result() === RESULT_SUCCESS && resultText(g)?.text === TXT.levelClear1 && g.tile() === null, `result ${g.result()}`);
  const start = g.frame(last + 3000);
  L2start = last + 3000;
  const hud = hudText(g);
  check(14, "3000ms later level 2 starts: honey 6,7,8,8,9, wasps (2,3) (10,3), bee at (7,4), HUD 2/3 and 90", g.result() === null && eq(honeyOf(g, L2_FLOWERS), [6, 7, 8, 8, 9]) && eq(waspTiles(g), ["10,3", "2,3"]) && eq(start, START) && hud.includes("레벨 2/3") && hud.includes("소나기 90초"), `result ${g.result()}, honey ${JSON.stringify(honeyOf(g, L2_FLOWERS))}, wasps ${JSON.stringify(waspTiles(g))}, bee ${fmt(start)}, hud "${hud}"`);
  // 기준 15: 레벨 2 클리어 경로
  const t2 = run(g, ROUTE_L2, L2start);
  g.frame(t2 - 1);
  const early2 = g.result();
  g.frame(t2);
  const txt2 = resultText(g);
  check(15, "level 2 clear route (35 moves, 38s): playing at +43249ms, #FFD23F at +43250ms with levelClear(2) text", t2 - L2start === 43250 && early2 === null && g.result() === RESULT_SUCCESS && txt2?.text === TXT.levelClear2, `elapsed ${t2 - L2start}, early ${early2}, result ${g.result()}, text ${JSON.stringify(txt2)}`);
  g.frame(t2 + 3000);
  const hud3 = hudText(g);
  check(15, "3000ms after the level 2 success, level 3 starts: honey 7,8,8,9,9, wasps (3,3) (11,3) (5,6), HUD 3/3 and 90", g.result() === null && eq(honeyOf(g, L3_FLOWERS), [7, 8, 8, 9, 9]) && eq(waspTiles(g), ["11,3", "3,3", "5,6"]) && hud3.includes("레벨 3/3") && hud3.includes("소나기 90초"), `honey ${JSON.stringify(honeyOf(g, L3_FLOWERS))}, wasps ${JSON.stringify(waspTiles(g))}, hud "${hud3}"`);
  // 기준 16: 레벨 3 클리어 경로
  const T3 = t2 + 3000;
  const t3 = run(g, ROUTE_L3, T3);
  g.frame(t3 - 1);
  const early3 = g.result();
  g.frame(t3);
  const txt3 = resultText(g);
  check(16, "level 3 clear route (40 moves, 41s): playing at +46999ms, #FFD23F at +47000ms with allClear text", t3 - T3 === 47000 && early3 === null && g.result() === RESULT_SUCCESS && txt3?.text === TXT.allClear, `elapsed ${t3 - T3}, early ${early3}, result ${g.result()}, text ${JSON.stringify(txt3)}`);
  g.frame(t3 + 10000);
  g.press("ArrowLeft", t3 + 11000);
  g.frame(t3 + 11500);
  check(16, "the level 3 success screen stays 10s later and after an arrow key (no auto advance)", g.result() === RESULT_SUCCESS && resultText(g)?.text === TXT.allClear && g.tile() === null, `result ${g.result()}, text ${resultText(g)?.text}`);
}

// 기준 15 말벌: 레벨 2 (2,3)·(10,3), 기준 16 말벌: 레벨 3 (3,3)·(11,3)·(5,6) 중 대표 경로로 도착 순간 실패.
let failedL2;
{
  const { g, t } = await reach(2);
  const beside = go(g, ["ArrowUp", ...left(4)], t);
  g.frame(beside + 3000);
  const safe = g.result() === null;
  const at = beside + 3000;
  g.press("ArrowLeft", at);
  g.frame(at + MOVE_MS - 1);
  const pre = g.result();
  g.frame(at + MOVE_MS);
  check(15, "level 2: up 1, left 4 is safe for 3s; left 1 more onto the wasp (2,3) fails at arrival (#D9482B)", safe && pre === null && g.result() === RESULT_FAIL && resultText(g)?.text === TXT.failWasp, `safe ${safe}, pre ${pre}, result ${g.result()}`);
  failedL2 = g.result();
  const r = await reach(2);
  const arr = go(r.g, ["ArrowUp", ...right(3)], r.t);
  r.g.frame(arr);
  check(15, "level 2: up 1, right 3 reaches the wasp (10,3) and fails", r.g.result() === RESULT_FAIL, `result ${r.g.result()}`);
  const l3 = await reach(3);
  const a3 = go(l3.g, ["ArrowUp", ...left(4)], l3.t);
  l3.g.frame(a3);
  check(16, "level 3: up 1, left 4 reaches the wasp (3,3) and fails", l3.g.result() === RESULT_FAIL && resultText(l3.g)?.text === TXT.failWasp, `result ${l3.g.result()}`);
  const l3b = await reach(3);
  const a3b = go(l3b.g, [...down(2), ...left(2)], l3b.t);
  l3b.g.frame(a3b);
  check(16, "level 3: down 2, left 2 reaches the wasp (5,6) and fails", l3b.g.result() === RESULT_FAIL, `result ${l3b.g.result()}`);
}

// 기준 17: 레벨 2 실패 뒤 새 모듈 인스턴스(F5 대용)는 레벨 1부터.
{
  const g = await boot();
  const start = g.frame(0);
  const hud = hudText(g);
  check(17, "a fresh instance after a level 2 wasp fail starts at level 1: honey 5,6,7,8,9, wasp (4,3) only, HUD 1/3 and 90", failedL2 === RESULT_FAIL && g.result() === null && eq(honeyAll(g), [5, 6, 7, 8, 9]) && eq(waspTiles(g), ["4,3"]) && eq(start, START) && hud.includes("레벨 1/3") && hud.includes("소나기 90초"), `previous ${failedL2}, honey ${JSON.stringify(honeyAll(g))}, wasps ${JSON.stringify(waspTiles(g))}, hud "${hud}"`);
}

// 기준 18: 소리 (가짜 AudioContext).
{
  const s = await boot({ audio: true });
  s.frame(0);
  s.frame(90000);
  check(18, "no arrow key pressed and the storm arrives: no sound (no oscillator created)", s.result() === RESULT_STORM && s.notes.length === 0, `notes ${s.notes.length}`);

  const g = await boot({ audio: true });
  g.frame(0);
  const before = g.notes.length;
  const arrive = go(g, toF0, 0);
  const moveNotes = g.notes.length;
  const counts = [];
  for (let i = 1; i <= 5; i++) {
    g.frame(arrive + 1000 * i);
    counts.push(g.notes.filter((n) => n.freq === 880).length);
  }
  check(18, "before any arrow key: no sound; moving only: no sound", before === 0 && moveNotes === 0, `before ${before}, after moves ${moveNotes}`);
  check(18, "first flower (5 cells, not the last flower): 880Hz square gather note once per cell, 5 in total (the 5th frame is a gather, not a success)", eq(counts, [1, 2, 3, 4, 5]) && g.notes.every((n) => n.freq === 880 && n.type === "square"), `880Hz counts ${JSON.stringify(counts)}, notes ${JSON.stringify(g.notes)}`);
  g.frame(arrive + 6000);
  check(18, "standing on the finished flower: no further sound", g.notes.length === 5, `notes ${g.notes.length}`);
  const t = go(g, [...down(2), ...right(2)], arrive + 6000); // (2,1) -> wasp (4,3)
  g.frame(t);
  const fails = g.notes.filter((n) => n.freq === 196);
  g.frame(t + 500);
  g.frame(t + 5000);
  check(18, "wasp fail: one 196Hz triangle note, none while the result screen sits still", g.result() === RESULT_FAIL && fails.length === 1 && fails[0].type === "triangle" && g.notes.filter((n) => n.freq === 196).length === 1 && g.notes.length === 6, `fail notes ${JSON.stringify(fails)}, total ${g.notes.length}`);
  check(18, "every note has its own gain of 0.08 (one oscillator + one gain per note)", g.gains.length === g.notes.length && g.gains.every((x) => x.gain.value === 0.08), `gains ${g.gains.length}, notes ${g.notes.length}`);

  const w = await boot({ audio: true });
  w.frame(0);
  let tt = run(w, ROUTE_L1.slice(0, 4), 0);
  tt = go(w, ROUTE_L1[4][0], tt); // 마지막 꽃(9칸)에 도착
  const base = w.notes.filter((n) => n.freq === 880).length;
  for (let i = 1; i <= 8; i++) w.frame(tt + 1000 * i);
  const afterGathers = w.notes.length;
  const gathers = w.notes.filter((n) => n.freq === 880).length - base;
  w.frame(tt + 9000);
  const tail = w.notes.slice(afterGathers);
  check(18, "last flower (9 cells): 8 gather notes (N-1), then on the last cell only the 3 success notes 523/659/784Hz square at offsets 0, 0.12, 0.24s (no extra 880Hz)", w.result() === RESULT_SUCCESS && gathers === 8 && tail.length === 3 && eq(tail.map((n) => n.freq), [523, 659, 784]) && tail.every((n) => n.type === "square") && [0, 0.12, 0.24].every((o, i) => Math.abs(tail[i].start - o) < 1e-9), `gathers ${gathers}, tail ${JSON.stringify(tail)}`);
  w.frame(tt + 20000);
  check(18, "the level 1 success screen sits still: no more sound; no level-change sound after 3s", w.notes.length === afterGathers + 3, `notes ${w.notes.length}`);
  w.frame(tt + 9000 + 3000);
  check(18, "level change (success -> level 2) makes no sound", w.result() === null && w.notes.length === afterGathers + 3, `notes ${w.notes.length}`);

  // AudioContext가 없는 환경: 같은 조작이 예외 없이 지나간다.
  const n = await boot();
  n.frame(0);
  let threw = null;
  try {
    const a = go(n, toF0, 0);
    n.frame(a + 1000);
    const f = go(n, [...down(2), ...right(2)], a + 6000);
    n.frame(f);
  } catch (e) {
    threw = e;
  }
  check(18, "without an AudioContext: gather, fail and arrow keys run without any exception", threw === null && n.result() === RESULT_FAIL && n.notes.length === 0, `threw ${threw}, result ${n.result()}`);
}

// 기준 19: R1 18개 + 기준 11 + R2 기준 5~10 검사가 R3 코드에서 기대값 변경 없이 모두 PASS.
{
  const early = results.slice(0, r12Count);
  check(19, "R1 (18) + criterion 11 + R2 criteria 5-10 (15) = 34 checks all PASS with unchanged expectations", early.length === 34 && early.every((r) => r.criterion <= 11 && r.result === "PASS"), `${early.length} checks, ${early.filter((r) => r.result !== "PASS").length} failing`);
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
for (const k of ["document", "window", "requestAnimationFrame", "performance", "AudioContext"]) {
  if (k === "performance") Object.defineProperty(globalThis, k, { value: realPerformance, configurable: true, writable: true });
  else delete globalThis[k];
}
process.exit(failed.length === 0 ? 0 : 1);
