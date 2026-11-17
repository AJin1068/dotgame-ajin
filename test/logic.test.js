import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVEL_1, LEVEL_1_HONEY } from "../src/levels.js";
import { createState, moveBee, handleKey } from "../src/logic.js";

// 기대값은 GAME_DESIGN.md 5장·2장 값에서 가져온다.
// 레벨 1: 15 x 10칸, 벌 시작 칸은 가로 7, 세로 4 (0부터 셈).

test("level 1 is 15 columns by 10 rows", () => {
  assert.equal(LEVEL_1.length, 10);
  for (const row of LEVEL_1) assert.equal(row.length, 15);
});

test("bee starts at column 7, row 4 on level 1", () => {
  const s = createState(LEVEL_1, LEVEL_1_HONEY);
  assert.equal(s.x, 7);
  assert.equal(s.y, 4);
  assert.equal(s.cols, 15);
  assert.equal(s.rows, 10);
});

test("one key press moves exactly one tile in each direction", () => {
  const s = createState(LEVEL_1, LEVEL_1_HONEY);
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
  const top = { ...createState(LEVEL_1, LEVEL_1_HONEY), x: 0, y: 0 };
  assert.equal(moveBee(top, "left"), top);
  assert.equal(moveBee(top, "up"), top);
  const bottomRight = { ...createState(LEVEL_1, LEVEL_1_HONEY), x: 14, y: 9 };
  assert.equal(moveBee(bottomRight, "right"), bottomRight);
  assert.equal(moveBee(bottomRight, "down"), bottomRight);
});

test("an input during the 150ms move is dropped", () => {
  const s0 = createState(LEVEL_1, LEVEL_1_HONEY);
  const s1 = handleKey(s0, "right", 0);
  assert.equal(s1.x, 8);
  const s2 = handleKey(s1, "right", 149);
  assert.equal(s2.x, 8);
});

test("after 150ms a new key press moves one more tile", () => {
  const s0 = createState(LEVEL_1, LEVEL_1_HONEY);
  const s1 = handleKey(s0, "right", 0);
  const s2 = handleKey(s1, "right", 150);
  assert.equal(s2.x, 9);
});

test("handleKey does not change the input state object", () => {
  const s0 = createState(LEVEL_1, LEVEL_1_HONEY);
  const s1 = handleKey(s0, "left", 0);
  assert.equal(s0.x, 7);
  assert.equal(s1.x, 6);
});

// 9장 기준 3: 가장자리 바깥 입력은 아무 일도 일어나지 않는다 (이동 잠금도 걸리지 않는다).
test("an outward press at the edge changes nothing and starts no lock", () => {
  const edge = { ...createState(LEVEL_1, LEVEL_1_HONEY), x: 0, y: 4 };
  const after = handleKey(edge, "left", 0);
  assert.equal(after, edge);
  assert.equal(after.moving, null);
  const next = handleKey(after, "right", 1);
  assert.equal(next.x, 1);
});

// 9장 기준 4: 이동 중 입력은 버리고, 150ms 뒤 다시 누르면 한 칸 이동한다.
test("a dropped input returns the same state and later presses still work", () => {
  const s1 = handleKey(createState(LEVEL_1, LEVEL_1_HONEY), "up", 0);
  assert.equal(s1.y, 3);
  const dropped = handleKey(s1, "left", 100);
  assert.equal(dropped, s1);
  const s2 = handleKey(dropped, "left", 300);
  assert.equal(s2.x, 6);
  assert.equal(s2.y, 3);
});

// 이동 잠금이 끝난 뒤 받은 입력은 새 이동의 출발 칸을 이전 칸으로 기록한다 (렌더 보간에 쓰인다).
test("a move accepted at lock expiry records its own origin tile", () => {
  const s1 = handleKey(createState(LEVEL_1, LEVEL_1_HONEY), "right", 0);
  const s2 = handleKey(s1, "down", 150);
  assert.equal(s2.x, 8);
  assert.equal(s2.y, 5);
  assert.equal(s2.moving.fromX, 8);
  assert.equal(s2.moving.fromY, 4);
  assert.equal(s2.moving.until, 300);
});

// 시각이 유한한 숫자가 아니면 입력을 버린다 (잠금을 우회할 수 없다).
test("a non-finite timestamp is dropped and cannot bypass the lock", () => {
  const s1 = handleKey(createState(LEVEL_1, LEVEL_1_HONEY), "right", 0);
  for (const bad of [NaN, undefined, Infinity]) {
    assert.equal(handleKey(s1, "down", bad), s1);
  }
});

// 5장에는 벌 시작 칸 B가 하나뿐이다.
test("a level with two bee start cells is rejected", () => {
  assert.throws(() => createState(["B.", "B."]));
});

// 방향 문자열이 up/down/left/right가 아니면 무시한다 (Object.prototype 키 포함).
test("an unknown direction is ignored, including Object.prototype keys", () => {
  const s0 = createState(LEVEL_1, LEVEL_1_HONEY);
  for (const dir of ["toString", "constructor", "__proto__", "hasOwnProperty", "diagonal"]) {
    const s = handleKey(s0, dir, 0);
    assert.equal(s, s0);
    assert.equal(s.x, 7);
    assert.equal(s.y, 4);
  }
});
