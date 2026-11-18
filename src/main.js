import { LEVELS } from "./levels.js";
import { handleKey, tick, remainingHoney, isDone, stormSecondsLeft, nextLevelDue, soundEvents, MOVE_MS, isStartKey, startLevel } from "./logic.js";
import { createSound } from "./sound.js";
import { levelLabel, stormLabel, levelClear, allClear, failWasp, failStorm, titleName, titlePrompt } from "./strings.js";
import { PALETTE, BEE_SPRITE, FLOWER_SPRITE, WASP_SPRITE } from "./sprites.js";

const TILE = 32; // GAME_DESIGN.md 2장 타일 크기
const HUD_TOP = 320; // 맵 영역 y 0~319 아래 HUD 띠 y 320~351 (3장)
const HUD_H = 32;
const HUD_TEXT_Y = 336;
const SPRITE_PX = 4; // 스프라이트 1픽셀 = 4px (4장)

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.font = "16px monospace"; // 7장 UI 문구 글꼴 (웹폰트 없음)
ctx.textBaseline = "middle";

const sound = createSound();

const KEY_TO_DIR = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

let levelIndex = 0;
let state = null; // 타이틀 화면에서는 null. 시작 키에서 레벨 1 상태가 된다.

function begin(now) {
  levelIndex = 0;
  state = startLevel(LEVELS[0].rows, LEVELS[0].honey, now); // 소나기 90초는 시작 키 시각부터
}

// 모든 상태 갱신은 여기로: 효과음 판정 후 상태 교체.
function update(next) {
  for (const name of soundEvents(state, next)) sound.play(name);
  state = next;
}

function drawFloor() {
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      ctx.fillStyle = PALETTE[4];
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.fillStyle = PALETTE[5];
      ctx.fillRect(x * TILE, y * TILE + TILE - 2, TILE, 2);
    }
  }
}

// 이동 중이면 출발 칸에서 도착 칸까지 150ms 동안 보간해서 그린다 (렌더만).
function beePosition(now) {
  if (state.moving === null) return { x: state.x, y: state.y };
  const t = Math.min(1, Math.max(0, (now - (state.moving.until - MOVE_MS)) / MOVE_MS));
  return {
    x: state.moving.fromX + (state.x - state.moving.fromX) * t,
    y: state.moving.fromY + (state.y - state.moving.fromY) * t,
  };
}

function drawSprite(sprite, left, top, px) {
  sprite.forEach((row, py) => {
    row.forEach((idx, pxIdx) => {
      if (idx === null) return;
      ctx.fillStyle = PALETTE[idx];
      ctx.fillRect(left + pxIdx * px, top + py * px, px, px);
    });
  });
}

function drawTileSprite(sprite, x, y) {
  drawSprite(sprite, x * TILE + (TILE - 8 * SPRITE_PX) / 2, y * TILE + (TILE - 8 * SPRITE_PX) / 2, SPRITE_PX);
}

function drawBee(now) {
  const { x, y } = beePosition(now);
  drawSprite(BEE_SPRITE, x * TILE + (TILE - 8 * SPRITE_PX) / 2, y * TILE + (TILE - 8 * SPRITE_PX) / 2, SPRITE_PX);
}

// 꿀 칸 막대 (4장): 바탕 (3*양+1)x6px, 남은 꿀 1개당 노란 2x4px 칸 1개, 피치 3px. 4x4 rect를 쓰지 않는다.
function drawHoneyBar(f) {
  ctx.fillStyle = PALETTE[0];
  ctx.fillRect(f.x * TILE + 2, f.y * TILE + 25, 3 * f.amount + 1, 6);
  ctx.fillStyle = PALETTE[1];
  for (let i = 0; i < remainingHoney(f); i++) ctx.fillRect(f.x * TILE + 3 + 3 * i, f.y * TILE + 26, 2, 4);
}

// HUD (3장): 맵 아래 전용 띠 y 320~351, 480x32 팔레트 0 바탕, 글자 세로 가운데 y=336. 왼쪽 레벨, 오른쪽 남은 소나기 초(팔레트 1 글자). 4x4 rect 없음.
function drawHud(now) {
  ctx.fillStyle = PALETTE[0];
  ctx.fillRect(0, HUD_TOP, 480, HUD_H);
  ctx.fillStyle = PALETTE[1];
  ctx.textAlign = "left";
  ctx.fillText(levelLabel(levelIndex + 1, LEVELS.length), 8, HUD_TEXT_Y);
  ctx.textAlign = "right";
  ctx.fillText(stormLabel(stormSecondsLeft(state, now)), 472, HUD_TEXT_Y);
}

// 결과 화면 (3장): 전체 배경(성공=팔레트 1, 말벌 실패=팔레트 7, 소나기 실패=팔레트 3) + 패널 80x80 (200,120)
// + 큰 스프라이트 64x64 (208,128) + 패널 아래 문구 1줄 (240,232).
function drawResult() {
  const success = state.status === "success";
  const wasp = state.failReason === "wasp";
  ctx.fillStyle = PALETTE[success ? 1 : wasp ? 7 : 3];
  ctx.fillRect(0, 0, state.cols * TILE, state.rows * TILE); // 480x320 (2장)
  ctx.fillStyle = PALETTE[0];
  ctx.fillRect(200, 120, 80, 80);
  drawSprite(wasp ? WASP_SPRITE : BEE_SPRITE, 208, 128, 8);
  const text = success ? (levelIndex === LEVELS.length - 1 ? allClear : levelClear(levelIndex + 1)) : wasp ? failWasp : failStorm;
  ctx.fillStyle = PALETTE[wasp ? 3 : 0];
  ctx.textAlign = "center";
  ctx.fillText(text, 240, 232);
}

// 타이틀 화면 (3장): 맵 영역 480x320 팔레트 4 + 팔레트 0 패널 320x240 (80,40) + 큰 벌 64x64 (208,56)
// + 게임 이름 (240,160, 32px) + 안내 문구 (240,224, 16px). HUD 띠는 팔레트 0 바탕만, 글자 없음.
function drawTitle() {
  ctx.fillStyle = PALETTE[4];
  ctx.fillRect(0, 0, 480, 320);
  ctx.fillStyle = PALETTE[0];
  ctx.fillRect(80, 40, 320, 240);
  drawSprite(BEE_SPRITE, 208, 56, 8);
  ctx.textAlign = "center";
  ctx.font = "32px monospace";
  ctx.fillStyle = PALETTE[1];
  ctx.fillText(titleName, 240, 160);
  ctx.font = "16px monospace";
  ctx.fillStyle = PALETTE[3];
  ctx.fillText(titlePrompt, 240, 224);
  ctx.fillStyle = PALETTE[0];
  ctx.fillRect(0, HUD_TOP, 480, HUD_H);
}

// 그리기 순서 계약 (4장, e2e/key-sequence.js가 의존): 바닥 -> 꽃 -> 말벌 -> HUD -> 벌 -> 꿀 막대.
// 벌 스프라이트의 4x4 rect 50개가 프레임의 마지막 4x4 rect들이어야 한다. HUD와 막대는 4x4가 아니다.
function frame(now) {
  if (state === null) {
    drawTitle();
    requestAnimationFrame(frame);
    return;
  }
  update(tick(state, now));
  if (nextLevelDue(state, now, levelIndex, LEVELS.length)) {
    levelIndex++; // 레벨 전환은 소리 없음, 맵이 나타나는 순간 소나기 시작
    state = startLevel(LEVELS[levelIndex].rows, LEVELS[levelIndex].honey, now);
  }
  if (state.status === "playing") {
    drawFloor();
    const open = state.flowers.filter((f) => !isDone(f));
    for (const f of open) drawTileSprite(FLOWER_SPRITE, f.x, f.y);
    for (const w of state.wasps) drawTileSprite(WASP_SPRITE, w.x, w.y);
    drawHud(now);
    drawBee(now);
    for (const f of open) drawHoneyBar(f);
  } else {
    drawResult();
    drawHud(now);
  }
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return; // 키 반복 입력 무시 (2장)
  if (state === null) {
    // 타이틀 (3장): 시작 키는 소비하고(벌은 안 움직임), 같은 keydown에서 소리를 켜고 레벨 1을 시작한다.
    if (!isStartKey(e.key)) return;
    if (Object.hasOwn(KEY_TO_DIR, e.key)) e.preventDefault();
    sound.resume();
    begin(performance.now());
    return;
  }
  if (!Object.hasOwn(KEY_TO_DIR, e.key)) return;
  const dir = KEY_TO_DIR[e.key];
  e.preventDefault();
  sound.resume(); // 방향키마다 호출하지만 AudioContext는 타이틀의 시작 키에서 이미 만들어졌다 (자동재생 정책)
  update(handleKey(state, dir, performance.now()));
});

requestAnimationFrame(frame);
