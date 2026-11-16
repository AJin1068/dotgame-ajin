import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVEL_1 } from "../src/levels.js";
import { createState, moveBee, handleKey } from "../src/logic.js";

// 기대값은 GAME_DESIGN.md 5장·2장 값에서 가져온다.
// 레벨 1: 15 x 10칸, 벌 시작 칸은 가로 7, 세로 4 (0부터 셈).

test("level 1 is 15 columns by 10 rows", () => {
  assert.equal(LEVEL_1.length, 10);
  for (const row of LEVEL_1) assert.equal(row.length, 15);
});

test("bee starts at column 7, row 4 on level 1", () => {
  const s = createState(LEVEL_1);
  assert.equal(s.x, 7);
  assert.equal(s.y, 4);
  assert.equal(s.cols, 15);
  assert.equal(s.rows, 10);
});

test("one key press moves exactly one tile in each direction", () => {
  const s = createState(LEVEL_1);
  assert.deepEqual(
    [moveBee(s, "up").x, moveBee(s, "up").y],
    [7, 3],
  );
  assert.deepEqual(
    [moveBee(s, "down").x, moveBee(s, "down").y],
    [7, 5],
  );
  assert.deepEqual(
    [moveBee(s, "left").x, moveBee(s, "left").y],
    [6, 4],
  );
  assert.deepEqual(
    [moveBee(s, "right").x, moveBee(s, "right").y],
    [8, 4],
  );
});

test("a move out of the map is ignored", () => {
  const top = { ...createState(LEVEL_1), x: 0, y: 0 };
  assert.equal(moveBee(top, "left"), top);
  assert.equal(moveBee(top, "up"), top);
  const bottomRight = { ...createState(LEVEL_1), x: 14, y: 9 };
  assert.equal(moveBee(bottomRight, "right"), bottomRight);
  assert.equal(moveBee(bottomRight, "down"), bottomRight);
});

test("an input during the 150ms move is dropped", () => {
  const s0 = createState(LEVEL_1);
  const s1 = handleKey(s0, "right", 0);
  assert.equal(s1.x, 8);
  const s2 = handleKey(s1, "right", 149);
  assert.equal(s2.x, 8);
});

test("after 150ms a new key press moves one more tile", () => {
  const s0 = createState(LEVEL_1);
  const s1 = handleKey(s0, "right", 0);
  const s2 = handleKey(s1, "right", 150);
  assert.equal(s2.x, 9);
});

test("handleKey does not change the input state object", () => {
  const s0 = createState(LEVEL_1);
  const s1 = handleKey(s0, "left", 0);
  assert.equal(s0.x, 7);
  assert.equal(s1.x, 6);
});
