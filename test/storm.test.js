import { test } from "node:test";
import assert from "node:assert/strict";
import { createState, handleKey, tick, stormSecondsLeft, nextLevelDue, STORM_MS } from "../src/logic.js";

// 기대값은 GAME_DESIGN.md 2장 소나기 값(90000ms, 동률=성공, 말벌 우선, 도래 시각까지만 정산)에서 가져온다. 시계는 가짜(ms 정수).

test("storm: a state created without the option never storms (R1/R2 calls unchanged)", () => {
  const s = tick(createState(["B."], []), 0);
  assert.equal(tick(s, 10_000_000).status, "playing");
});

test("storm: STORM_MS is 90000; 89999ms playing, 90000ms fail with failReason storm", () => {
  assert.equal(STORM_MS, 90000);
  const s = tick(createState(["B."], [], STORM_MS), 0);
  assert.equal(tick(s, 89999).status, "playing");
  const f = tick(s, 90000);
  assert.equal(f.status, "fail");
  assert.equal(f.failReason, "storm");
});

test("storm: the clock starts at the first tick time", () => {
  const s = tick(createState(["B."], [], STORM_MS), 5000);
  assert.equal(tick(s, 94999).status, "playing");
  assert.equal(tick(s, 95000).status, "fail");
});

test("storm: finishing the last honey exactly at the storm time is a success (tie)", () => {
  // 도착 150ms + 꿀 5000ms = 5150ms, 소나기 도래 0+5150
  let s = tick(createState(["BF"], [5], 5150), 0);
  s = handleKey(s, "right", 0);
  const end = tick(s, 5150);
  assert.equal(end.status, "success");
  assert.equal(end.failReason, null);
});

test("storm: one ms short of finishing before the storm is a storm fail", () => {
  let s = tick(createState(["BF"], [5], 5149), 0);
  s = handleKey(s, "right", 0);
  const end = tick(s, 5149);
  assert.equal(end.status, "fail");
  assert.equal(end.failReason, "storm");
  assert.equal(end.flowers[0].collectedMs, 4999);
});

test("storm: a huge dt still counts honey collected before the storm arrived (success)", () => {
  let s = tick(createState(["BF"], [5], 10000), 0);
  s = handleKey(s, "right", 0);
  assert.equal(tick(s, 1_000_000).status, "success");
});

test("storm: a huge dt only credits honey up to the storm time", () => {
  let s = tick(createState(["BF"], [9], 5000), 0);
  s = handleKey(s, "right", 0);
  const end = tick(s, 1_000_000);
  assert.equal(end.status, "fail");
  assert.equal(end.failReason, "storm");
  assert.ok(end.flowers[0].collectedMs <= 4850);
});

test("storm: after a storm fail, tick and handleKey return the same object", () => {
  const f = tick(tick(createState(["B."], [], 1000), 0), 1000);
  assert.equal(f.status, "fail");
  assert.equal(tick(f, 5000), f);
  assert.equal(handleKey(f, "right", 5000), f);
});

test("storm: a key pressed after the storm time confirms the fail and does not move the bee", () => {
  const s = tick(createState(["B."], [], 5000), 0);
  const after = handleKey(s, "right", 5000);
  assert.equal(after.status, "fail");
  assert.equal(after.failReason, "storm");
  assert.equal(after.x, 0);
});

test("storm: failReason is wasp for a wasp, storm for a storm, null while playing or on success", () => {
  let w = tick(createState(["BW"], []), 0);
  w = handleKey(w, "right", 0);
  assert.equal(tick(w, 150).failReason, "wasp");
  assert.equal(w.failReason, null);
  let ok = tick(createState(["BF"], [1]), 0);
  ok = handleKey(ok, "right", 0);
  const done = tick(ok, 1150);
  assert.equal(done.status, "success");
  assert.equal(done.failReason, null);
});

test("nextLevelDue: success at T waits 3000ms (2999 no, 3000 yes); playing, fail and the last level never advance", () => {
  let s = tick(createState(["BF"], [1], STORM_MS), 0);
  s = handleKey(s, "right", 0);
  assert.equal(nextLevelDue(s, 5000, 0, 3), false); // playing
  const done = tick(s, 1150);
  const T = done.lastMs;
  assert.equal(nextLevelDue(done, T + 2999, 0, 3), false);
  assert.equal(nextLevelDue(done, T + 3000, 0, 3), true);
  assert.equal(nextLevelDue(done, T + 3000, 1, 3), true);
  assert.equal(nextLevelDue(done, T + 100000, 2, 3), false);
  const fail = tick(tick(createState(["B."], [], 10), 0), 10);
  assert.equal(nextLevelDue(fail, 100000, 0, 3), false);
});

test("stormSecondsLeft: 90 at start, rounds up, 0 from 90000ms, null without a storm", () => {
  const s = tick(createState(["B."], [], STORM_MS), 0);
  assert.equal(stormSecondsLeft(s, 0), 90);
  assert.equal(stormSecondsLeft(s, 1), 90);
  assert.equal(stormSecondsLeft(s, 1000), 89);
  assert.equal(stormSecondsLeft(s, 60000), 30);
  assert.equal(stormSecondsLeft(s, 89999), 1);
  assert.equal(stormSecondsLeft(s, 90000), 0);
  assert.equal(stormSecondsLeft(s, 200000), 0);
  assert.equal(stormSecondsLeft(createState(["B."], []), 0), null);
});

test("storm: handleKey as the very first call starts the clock at its time", () => {
  const s = handleKey(createState(["BF"], [9], 5000), "right", 1000);
  assert.equal(tick(s, 5999).status, "playing");
  const f = tick(s, 6000);
  assert.equal(f.status, "fail");
  assert.equal(f.failReason, "storm");
});

test("storm: the storm is judged even when the move lock outlasts the storm time", () => {
  let s = tick(createState(["BF"], [9], 5000), 0);
  s = handleKey(s, "right", 4900); // lock until 5050, storm at 5000
  const f = tick(s, 5000);
  assert.equal(f.status, "fail");
  assert.equal(f.failReason, "storm");
  assert.equal(f.flowers[0].collectedMs, 0);
});

test("storm: wasp arrival at the same ms as the storm is a wasp fail", () => {
  let s = tick(createState(["BW"], [], 150), 0);
  s = handleKey(s, "right", 0);
  const f = tick(s, 150);
  assert.equal(f.status, "fail");
  assert.equal(f.failReason, "wasp");
});
