import { test } from "node:test";
import assert from "node:assert/strict";
import { isStartKey, startLevel, tick, stormSecondsLeft, STORM_MS } from "../src/logic.js";
import { LEVELS } from "../src/levels.js";

// 기대값은 GAME_DESIGN.md 3장 타이틀 규칙(수정 키 제외 모든 키가 시작, 소나기 90초는 시작 키 시각부터)에서 가져온다. 시계는 가짜(ms 정수).

test("title: arrows, space, letters, Enter and F-keys are start keys", () => {
  for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "a", "Enter", "Escape", "F5"]) {
    assert.equal(isStartKey(key), true, key);
  }
});

test("title: pure modifier keys Shift/Control/Alt/Meta are not start keys", () => {
  for (const key of ["Shift", "Control", "Alt", "Meta"]) assert.equal(isStartKey(key), false, key);
});

test("title: a missing or empty key is not a start key", () => {
  assert.equal(isStartKey(undefined), false);
  assert.equal(isStartKey(""), false);
});

test("title: startLevel puts the bee on the start cell and the storm clock starts at the given time", () => {
  const s = startLevel(LEVELS[0].rows, LEVELS[0].honey, 100000);
  assert.equal(s.status, "playing");
  assert.deepEqual([s.x, s.y], [7, 4]);
  assert.equal(s.moving, null);
  assert.equal(stormSecondsLeft(s, 100000), 90);
  assert.equal(tick(s, 100000 + STORM_MS - 1).status, "playing");
  const f = tick(s, 100000 + STORM_MS);
  assert.equal(f.status, "fail");
  assert.equal(f.failReason, "storm");
});

test("title: waiting before the start key does not use up the storm time (HUD shows 90 at start)", () => {
  const s = startLevel(LEVELS[0].rows, LEVELS[0].honey, 250000);
  assert.equal(stormSecondsLeft(s, 250000), 90);
  assert.equal(stormSecondsLeft(s, 250001), 90);
  assert.equal(stormSecondsLeft(s, 251000), 89);
});
