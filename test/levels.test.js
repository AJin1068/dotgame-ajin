import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS } from "../src/levels.js";
import { createState, handleKey, tick, STORM_MS } from "../src/logic.js";

// 기대값은 GAME_DESIGN.md 5장(레벨 2·3 맵, 클리어 경로, 말벌 확인 경로)에서 가져온다. 시계는 가짜(ms 정수).

const rep = (dir, n) => Array(n).fill(dir);
const fresh = (i) => tick(createState(LEVELS[i].rows, LEVELS[i].honey, STORM_MS), 0);
// dirs를 150ms 간격으로 넣는다. 마지막 이동의 도착 시각을 함께 돌려준다.
function walk(s, dirs, t) {
  for (const d of dirs) {
    s = handleKey(s, d, t);
    t += 150;
  }
  return { s, t };
}
// route = [[dirs, 꿀 양], ...]: 꽃마다 꿀이 다 사라질 때까지 서 있는다. 마지막 꽃 직전(-1ms)과 끝의 상태를 돌려준다.
function clear(level, route) {
  let s = fresh(level);
  let t = 0;
  for (const [dirs, honey] of route.slice(0, -1)) {
    ({ s, t } = walk(s, dirs, t));
    t += honey * 1000;
  }
  const [dirs, honey] = route.at(-1);
  ({ s, t } = walk(s, dirs, t));
  t += honey * 1000;
  return { before: tick(s, t - 1), end: tick(s, t), t };
}

test("levels: 3 levels, each 15x10 with one B at (7,4), 5 flowers, honey 1..9 per flower", () => {
  assert.equal(LEVELS.length, 3);
  for (const { rows, honey } of LEVELS) {
    assert.equal(rows.length, 10);
    for (const row of rows) assert.equal(row.length, 15);
    assert.equal(rows.join("").split("B").length - 1, 1);
    assert.equal(rows[4][7], "B");
    assert.equal(rows.join("").split("F").length - 1, 5);
    assert.equal(honey.length, 5);
    for (const h of honey) assert.ok(h >= 1 && h <= 9);
  }
});

test("level 2: flowers in reading order with honey 6,7,8,8,9 (sum 38), wasps (2,3) (10,3)", () => {
  const s = createState(LEVELS[1].rows, LEVELS[1].honey);
  assert.deepEqual(s.flowers.map((f) => [f.x, f.y, f.amount]), [[1, 1, 6], [13, 1, 7], [4, 6, 8], [12, 6, 8], [6, 8, 9]]);
  assert.equal(s.flowers.reduce((a, f) => a + f.amount, 0), 38);
  assert.deepEqual(s.wasps.map((w) => [w.x, w.y]), [[2, 3], [10, 3]]);
});

test("level 3: flowers in reading order with honey 7,8,8,9,9 (sum 41), wasps (3,3) (11,3) (5,6)", () => {
  const s = createState(LEVELS[2].rows, LEVELS[2].honey);
  assert.deepEqual(s.flowers.map((f) => [f.x, f.y, f.amount]), [[2, 1, 7], [12, 1, 8], [1, 6, 8], [13, 6, 9], [8, 8, 9]]);
  assert.equal(s.flowers.reduce((a, f) => a + f.amount, 0), 41);
  assert.deepEqual(s.wasps.map((w) => [w.x, w.y]), [[3, 3], [11, 3], [5, 6]]);
});

test("levels: no flower or wasp on the start row (4) or start column (7)", () => {
  for (const { rows, honey } of LEVELS) {
    const s = createState(rows, honey);
    for (const o of [...s.flowers, ...s.wasps]) assert.ok(o.y !== 4 && o.x !== 7);
  }
});

test("level 2 clear route with the storm on: 43249ms playing, 43250ms success, no wasp", () => {
  const { before, end, t } = clear(1, [
    [["left", ...rep("down", 4)], 9],
    [[...rep("left", 2), ...rep("up", 2)], 8],
    [rep("right", 8), 8],
    [["right", ...rep("up", 5)], 7],
    [rep("left", 12), 6],
  ]);
  assert.equal(t, 43250);
  assert.equal(before.status, "playing");
  assert.equal(end.status, "success");
  assert.equal(end.failReason, null);
});

test("level 3 clear route with the storm on: 46999ms playing, 47000ms success", () => {
  const { before, end, t } = clear(2, [
    [[...rep("up", 3), ...rep("left", 5)], 7],
    [rep("right", 10), 8],
    [["right", ...rep("down", 5)], 9],
    [[...rep("left", 5), ...rep("down", 2)], 9],
    [[...rep("left", 7), ...rep("up", 2)], 8],
  ]);
  assert.equal(t, 47000);
  assert.equal(before.status, "playing");
  assert.equal(end.status, "success");
});

test("wasp check routes (levels 2 and 3, 5 wasps): one tile before is safe, arrival fails with wasp", () => {
  const cases = [
    [1, ["up", ...rep("left", 5)]],
    [1, ["up", ...rep("right", 3)]],
    [2, ["up", ...rep("left", 4)]],
    [2, ["up", ...rep("right", 4)]],
    [2, [...rep("down", 2), ...rep("left", 2)]],
  ];
  for (const [level, dirs] of cases) {
    const { s: beside, t } = walk(fresh(level), dirs.slice(0, -1), 0);
    assert.equal(tick(beside, t + 3000).status, "playing", `${level} ${dirs}`);
    const { s: last, t: arrive } = walk(beside, dirs.slice(-1), t);
    assert.equal(tick(last, arrive - 1).status, "playing", `${level} ${dirs}`);
    const f = tick(last, arrive);
    assert.equal(f.status, "fail", `${level} ${dirs}`);
    assert.equal(f.failReason, "wasp", `${level} ${dirs}`);
  }
});
