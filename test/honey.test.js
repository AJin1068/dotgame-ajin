import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVEL_1, LEVEL_1_HONEY } from "../src/levels.js";
import { createState, handleKey, tick, remainingHoney, isDone } from "../src/logic.js";

// 기대값은 GAME_DESIGN.md 2장(채집·말벌·결과)과 5장(맵) 숫자에서 가져온다. 시계는 가짜(ms 정수).
// 레벨 1: 벌 (7,4), 꽃 (2,1)=5 (11,1)=6 (12,6)=7 (1,8)=8 (13,8)=9, 말벌 (4,3). 이동 150ms, 꿀 1000ms당 1.

// 입력을 150ms 간격으로 연달아 넣는다. 돌려주는 값: 마지막 상태와 마지막 이동의 도착 시각.
function walk(state, dirs, startMs) {
  let s = state;
  let t = startMs;
  for (const d of dirs) {
    s = handleKey(s, d, t);
    t += 150;
  }
  return { state: s, arrive: t };
}
const rep = (dir, n) => Array(n).fill(dir);

test("level 1 map: 15x10, 5 flowers in reading order with honey 5..9 (sum 35), 1 wasp, none on the start row/column", () => {
  assert.equal(LEVEL_1.length, 10);
  for (const row of LEVEL_1) assert.equal(row.length, 15);
  const s = createState(LEVEL_1, LEVEL_1_HONEY);
  assert.deepEqual(s.flowers.map((f) => [f.x, f.y, f.amount]), [[2, 1, 5], [11, 1, 6], [12, 6, 7], [1, 8, 8], [13, 8, 9]]);
  assert.equal(s.flowers.reduce((a, f) => a + f.amount, 0), 35);
  assert.deepEqual(s.wasps.map((w) => [w.x, w.y]), [[4, 3]]);
  for (const o of [...s.flowers, ...s.wasps]) assert.ok(o.y !== 4 && o.x !== 7);
  assert.equal(s.status, "playing");
});

test("a 5-honey flower shows 1 left at 4999ms and is done at 5000ms after arrival", () => {
  const { state } = walk(createState(["BF"], [5]), ["right"], 0); // 도착 150ms
  const a = tick(state, 150 + 4999);
  assert.equal(remainingHoney(a.flowers[0]), 1);
  assert.equal(isDone(a.flowers[0]), false);
  assert.equal(a.status, "playing");
  const b = tick(a, 150 + 5000);
  assert.equal(remainingHoney(b.flowers[0]), 0);
  assert.equal(isDone(b.flowers[0]), true);
});

test("no honey is collected while moving: 0 at 149ms and 0 at the arrival instant 150ms", () => {
  const { state } = walk(createState(["BF"], [5]), ["right"], 0);
  assert.equal(tick(state, 149).flowers[0].collectedMs, 0);
  assert.equal(tick(tick(state, 149), 150).flowers[0].collectedMs, 0);
});

test("move time does not count: pressing at 0 and ticking at 1150ms gives exactly 1000ms", () => {
  const { state } = walk(createState(["BF"], [5]), ["right"], 0);
  assert.equal(tick(state, 1150).flowers[0].collectedMs, 1000);
});

test("leaving a flower keeps its progress and returning continues it", () => {
  let s = walk(createState(["BFF"], [5, 6]), ["right"], 0).state; // (1,0) 도착 150
  s = handleKey(s, "right", 3150); // 3000ms 서다 떠남
  assert.equal(remainingHoney(s.flowers[0]), 2);
  s = handleKey(s, "left", 3300); // 떠난 동안 (2,0)의 꽃은 별개
  assert.equal(remainingHoney(s.flowers[0]), 2);
  const back = 3300 + 150; // 도착
  const a = tick(s, back + 1999);
  assert.equal(isDone(a.flowers[0]), false);
  assert.equal(isDone(tick(a, back + 2000).flowers[0]), true);
});

test("two flowers keep independent progress", () => {
  let s = walk(createState(["BFF"], [5, 6]), ["right"], 0).state;
  s = handleKey(s, "right", 2150); // 첫 꽃에서 2000ms
  s = tick(s, 2300 + 1000); // 둘째 꽃에서 1000ms
  assert.equal(s.flowers[0].collectedMs, 2000);
  assert.equal(s.flowers[1].collectedMs, 1000);
  assert.deepEqual(s.flowers.map(remainingHoney), [3, 5]);
});

test("arriving on the wasp fails exactly at arrival (599ms playing, 600ms fail)", () => {
  const { state } = walk(createState(LEVEL_1, LEVEL_1_HONEY), ["up", "left", "left", "left"], 0); // (4,3) 도착 600
  assert.deepEqual([state.x, state.y], [4, 3]);
  const a = tick(state, 599);
  assert.equal(a.status, "playing");
  assert.equal(tick(a, 600).status, "fail");
});

test("the tile next to the wasp is safe however long the bee stands there", () => {
  const { state } = walk(createState(LEVEL_1, LEVEL_1_HONEY), ["up", "left", "left"], 0); // (5,3) 도착 450
  assert.deepEqual([state.x, state.y], [5, 3]);
  assert.equal(tick(tick(state, 450 + 3000), 450 + 60000).status, "playing");
});

test("after a fail, handleKey and tick return the same state object", () => {
  const { state } = walk(createState(LEVEL_1, LEVEL_1_HONEY), ["up", "left", "left", "left"], 0);
  const failed = tick(state, 600);
  assert.equal(failed.status, "fail");
  assert.equal(handleKey(failed, "right", 1000), failed);
  assert.equal(tick(failed, 5000), failed);
});

test("success boundary: one flower of 5 is playing at 4999ms and success at 5000ms after arrival", () => {
  const { state } = walk(createState(["BF"], [5]), ["right"], 0);
  assert.equal(tick(state, 150 + 4999).status, "playing");
  assert.equal(tick(state, 150 + 5000).status, "success");
});

test("level 1 full route (48 moves, 35s of honey): playing at 42199ms, success at 42200ms", () => {
  const route = [
    [[...rep("left", 5), ...rep("up", 3)], 5],
    [rep("right", 9), 6],
    [["right", ...rep("down", 5)], 7],
    [[...rep("down", 2), ...rep("left", 11)], 8],
    [rep("right", 12), 9],
  ];
  let s = createState(LEVEL_1, LEVEL_1_HONEY);
  let t = 0;
  let moves = 0;
  for (const [dirs, honey] of route) {
    const w = walk(s, dirs, t);
    s = w.state;
    moves += dirs.length;
    t = w.arrive + honey * 1000;
  }
  assert.equal(moves, 48);
  assert.equal(t, 42200);
  assert.equal(tick(s, 42199).status, "playing");
  const done = tick(s, 42200);
  assert.equal(done.status, "success");
  assert.equal(handleKey(done, "left", 43000), done);
});

test("tick ignores equal or earlier times and non-finite times, and never mutates its input", () => {
  const { state } = walk(createState(["BF"], [5]), ["right"], 0);
  const s = tick(state, 1000);
  const before = JSON.stringify(s);
  assert.equal(tick(s, 1000), s);
  assert.equal(tick(s, 999), s);
  for (const bad of [NaN, undefined, Infinity]) assert.equal(tick(s, bad), s);
  const next = tick(s, 2000);
  assert.notEqual(next, s);
  assert.equal(JSON.stringify(s), before);
});

test("leaving a flower first credits the time stood there, and the new tile gets none", () => {
  let s = walk(createState(["BFF"], [5, 6]), ["right"], 0).state; // (1,0) 도착 150
  s = handleKey(s, "right", 1650); // 1500ms 서다 이동
  assert.equal(s.flowers[0].collectedMs, 1500);
  assert.equal(s.flowers[1].collectedMs, 0);
});

test("createState rejects an F count that differs from the honey list and bad bee start counts", () => {
  assert.throws(() => createState(["BFF"], [5]));
  assert.throws(() => createState(["BF"], [5, 6]));
  assert.throws(() => createState(["BF"]));
  assert.throws(() => createState([".F"], [5]));
  assert.throws(() => createState(["BBF"], [5]));
});

test("one huge dt (hidden tab) caps at the amount and succeeds", () => {
  const { state } = walk(createState(["BF"], [5]), ["right"], 0);
  const s = tick(state, 1_000_000);
  assert.equal(s.flowers[0].collectedMs, 5000);
  assert.equal(s.status, "success");
});

test("one huge dt on the wasp tile fails", () => {
  const { state } = walk(createState(["BW"]), ["right"], 0);
  assert.equal(tick(state, 1_000_000).status, "fail");
});

test("a key press after arriving on the wasp settles to fail and does not move", () => {
  const { state } = walk(createState(["BW."]), ["right"], 0); // 도착 150
  const after = handleKey(state, "right", 400);
  assert.equal(after.status, "fail");
  assert.equal(after.x, 1);
});

test("after success handleKey is ignored", () => {
  const { state } = walk(createState(["BF."], [5]), ["right"], 0);
  const done = tick(state, 5150);
  assert.equal(done.status, "success");
  assert.equal(handleKey(done, "right", 6000), done);
});
