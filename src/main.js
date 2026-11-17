import { LEVEL_1, LEVEL_1_HONEY } from "./levels.js";
import { createState, handleKey, tick, remainingHoney, isDone, MOVE_MS } from "./logic.js";
import { PALETTE, BEE_SPRITE, FLOWER_SPRITE, WASP_SPRITE } from "./sprites.js";

const TILE = 32; // GAME_DESIGN.md 2장 타일 크기
const SPRITE_PX = 4; // 스프라이트 1픽셀 = 4px (4장)

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const KEY_TO_DIR = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

let state = createState(LEVEL_1, LEVEL_1_HONEY);

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

// 결과 화면 (3장): 전체 배경(성공=팔레트 1, 실패=팔레트 7) + 패널 80x80 (200,120) + 큰 스프라이트 64x64 (208,128).
function drawResult() {
  const success = state.status === "success";
  ctx.fillStyle = PALETTE[success ? 1 : 7];
  ctx.fillRect(0, 0, state.cols * TILE, state.rows * TILE); // 480x320 (2장)
  ctx.fillStyle = PALETTE[0];
  ctx.fillRect(200, 120, 80, 80);
  drawSprite(success ? BEE_SPRITE : WASP_SPRITE, 208, 128, 8);
}

// 그리기 순서 계약 (4장, e2e/key-sequence.js가 의존): 바닥 -> 꽃 -> 말벌 -> 벌 -> 꿀 막대.
// 벌 스프라이트의 4x4 rect 50개가 프레임의 마지막 4x4 rect들이어야 한다. 막대는 벌 뒤에 그리되 4x4가 아니다.
function frame(now) {
  state = tick(state, now);
  if (state.status === "playing") {
    drawFloor();
    const open = state.flowers.filter((f) => !isDone(f));
    for (const f of open) drawTileSprite(FLOWER_SPRITE, f.x, f.y);
    for (const w of state.wasps) drawTileSprite(WASP_SPRITE, w.x, w.y);
    drawBee(now);
    for (const f of open) drawHoneyBar(f);
  } else {
    drawResult();
  }
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (e) => {
  if (e.repeat) return; // 키 반복 입력 무시 (2장)
  if (!Object.hasOwn(KEY_TO_DIR, e.key)) return;
  const dir = KEY_TO_DIR[e.key];
  e.preventDefault();
  state = handleKey(state, dir, performance.now());
});

requestAnimationFrame(frame);
