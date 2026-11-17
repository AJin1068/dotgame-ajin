import { LEVEL_1 } from "./levels.js";
import { createState, handleKey, MOVE_MS } from "./logic.js";
import { PALETTE, BEE_SPRITE } from "./sprites.js";

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

let state = createState(LEVEL_1);

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

function drawBee(now) {
  const { x, y } = beePosition(now);
  const left = x * TILE + (TILE - 8 * SPRITE_PX) / 2;
  const top = y * TILE + (TILE - 8 * SPRITE_PX) / 2;
  BEE_SPRITE.forEach((row, py) => {
    row.forEach((idx, px) => {
      if (idx === null) return;
      ctx.fillStyle = PALETTE[idx];
      ctx.fillRect(left + px * SPRITE_PX, top + py * SPRITE_PX, SPRITE_PX, SPRITE_PX);
    });
  });
}

function frame(now) {
  drawFloor();
  drawBee(now);
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
