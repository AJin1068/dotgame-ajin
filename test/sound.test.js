import { test } from "node:test";
import assert from "node:assert/strict";
import { createState, handleKey, tick, soundEvents } from "../src/logic.js";
import * as strings from "../src/strings.js";

// 기대값은 GAME_DESIGN.md 7장(효과음 규칙)에서 가져온다. 시계는 가짜(ms 정수).
const onFlower = (honey, stormMs = null) => handleKey(tick(createState(["BF"], [honey], stormMs), 0), "right", 0);

test("soundEvents: honey dropping gives gather once; no change or the same object gives nothing", () => {
  const arrived = tick(onFlower(5), 150);
  assert.deepEqual(soundEvents(arrived, tick(arrived, 1150)), ["gather"]);
  assert.deepEqual(soundEvents(arrived, tick(arrived, 1149)), []);
  assert.deepEqual(soundEvents(arrived, arrived), []);
});

test("soundEvents: the last honey of the level gives success only; wasp and storm fails give fail", () => {
  const almost = tick(onFlower(1), 1149);
  assert.deepEqual(soundEvents(almost, tick(almost, 1150)), ["success"]);
  const w = handleKey(tick(createState(["BW"], []), 0), "right", 0);
  assert.deepEqual(soundEvents(tick(w, 149), tick(tick(w, 149), 150)), ["fail"]);
  const st = onFlower(9, 5000);
  const before = tick(st, 4999);
  assert.deepEqual(soundEvents(before, tick(before, 5000)), ["fail"]);
});

test("soundEvents: nothing once the game has ended (no repeated sound)", () => {
  const almost = tick(onFlower(1), 1149);
  const done = tick(almost, 1150);
  assert.deepEqual(soundEvents(done, tick(done, 9999)), []);
  assert.deepEqual(soundEvents(done, done), []);
});

test("strings: 4 result texts are distinct and non-empty; labels contain their numbers", () => {
  const texts = [strings.levelClear(1), strings.allClear, strings.failWasp, strings.failStorm];
  for (const t of texts) assert.ok(t.length > 0);
  assert.equal(new Set(texts).size, 4);
  assert.ok(strings.levelLabel(2, 3).includes("2") && strings.levelLabel(2, 3).includes("3"));
  assert.ok(strings.stormLabel(60).includes("60"));
});
