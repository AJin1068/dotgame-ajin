// e2e: macOS Google Chrome --headless 로 http://localhost:8000 을 열어 렌더와 콘솔 에러 0을 확인한다.
// 실행: node e2e/chrome-render.js   (외부 패키지 없음, Node 22.12 이상, macOS, Google Chrome 설치 필요)
//   CHROME_BIN 으로 Chrome 경로를 바꿀 수 있고, E2E_OUT 으로 증거 파일(스크린샷·전사 JSON) 위치를 정한다.
//
// 무엇을 하나
//   1) 8000 포트가 비어 있으면 python3 -m http.server 8000 을 띄우고(이미 떠 있으면 그대로 쓰고) 끝나면 내린다.
//   2) Chrome --headless --dump-dom 으로 index.html 이 로드되어 <canvas id="game" width="480" height="320"> 가 DOM 에 있는지 본다.
//   3) Chrome --headless --screenshot 으로 PNG 를 찍어 직접 디코드하고(zlib 만 사용), 아래를 픽셀로 확인한다.
//      - 바닥 색(#9BD17A)과 음영 색(#6DB35C, 타일 아래 2px)이 정확히 480x320 영역을 채운다 (캔버스 1:1 렌더)
//      - GAME_DESIGN.md 6장 팔레트 색(바닥 음영, 벌 몸통/줄무늬/날개)이 실제로 그려졌다
//      - 벌 몸통 색이 시작 칸(가로 7, 세로 4)에는 있고 (0,0) 칸에는 없다
//      - 이미지가 단색이 아니다
//   4) --enable-logging=stderr 로 받은 Chrome 로그에서 CONSOLE 줄(console.error 등 콘솔 메시지)이 0개인지 본다.
//      console.error 한 줄이 CONSOLE 1줄로 잡히는 것은 확인했다. 스크립트 로드 실패(404)가 CONSOLE 줄로 잡히는지는 확인하지 못했다.
//      대신 모듈이 로드되지 않으면 벌이 안 그려지므로 아래 렌더 확인(3)이 실패한다.
//
// 무엇을 못 하나 (정직하게)
//   - 키 입력을 보내지 않는다. 이 스크립트는 "처음 화면이 올바르게 그려지고 콘솔 에러가 없다"만 확인한다.
//     이동 로직은 e2e/key-sequence.js 와 node --test test/ 가, 실제 키보드로 움직이는 느낌은 사람의 브라우저 확인(9장)이 맡는다.
//   - 애니메이션을 보지 않는다. virtual-time 으로 한 번 찍은 정지 화면 한 장이다.
//   - Chrome 한 종류(macOS)만 본다. Firefox/Safari, 다른 OS, 다른 화면 배율은 확인하지 않는다.
//   - CONSOLE 줄만 콘솔 에러로 센다. 로드 실패는 위 이유로 렌더 확인이 대신 잡는다. Chrome 이 따로 남기는 다른 ERROR 로그는 전사 JSON 에 기록만 하고 실패로 보지 않는다.

import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { inflateSync } from "node:zlib";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL_ = "http://localhost:8000";
const outDir = process.env.E2E_OUT || path.join(os.tmpdir(), "dotgame-e2e");
fs.mkdirSync(outDir, { recursive: true });
const shotPath = path.join(outDir, "chrome-render.png");

// GAME_DESIGN.md 6장 팔레트
const FLOOR = "#9BD17A";
const SHADE = "#6DB35C";
const BEE_BODY = "#FFD23F";
const BEE_STRIPE = "#2B2118";
const BEE_WING = "#F4F8FF";
const TILE = 32;
const START = { x: 7, y: 4 }; // 5장

const checks = [];
const check = (name, ok, observed) => checks.push({ name, result: ok ? "PASS" : "FAIL", observed });

async function serverUp() {
  try {
    const r = await fetch("http://127.0.0.1:8000/index.html");
    return r.ok;
  } catch {
    return false;
  }
}

function hexToRgb(h) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function decodePng(buf) {
  let p = 8;
  let w, h, bitDepth, colorType;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error("interlaced PNG is not supported");
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error(`unsupported PNG: bitDepth=${bitDepth} colorType=${colorType}`);
  const bpp = colorType === 6 ? 4 : 3;
  const stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let v;
      if (filter === 0) v = row[x];
      else if (filter === 1) v = row[x] + a;
      else if (filter === 2) v = row[x] + b;
      else if (filter === 3) v = row[x] + ((a + b) >> 1);
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        v = row[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(`bad PNG filter ${filter}`);
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, bpp, px };
}

const near = (px, i, rgb) => Math.abs(px[i] - rgb[0]) <= 2 && Math.abs(px[i + 1] - rgb[1]) <= 2 && Math.abs(px[i + 2] - rgb[2]) <= 2;

let server = null;
const transcript = { kind: "chrome-headless-render", url: URL_, chrome: CHROME, commands: [], consoleLines: [], otherChromeLogLines: [], checks, screenshot: shotPath };
let exitCode = 1;
try {
  if (!(await serverUp())) {
    server = spawn("python3", ["-m", "http.server", "8000"], { cwd: root, stdio: "ignore" });
    transcript.startedServer = "python3 -m http.server 8000";
    for (let i = 0; i < 50 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 100));
  } else transcript.startedServer = "reused an already running server on :8000";
  if (!(await serverUp())) throw new Error("http server on :8000 did not come up");

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dotgame-chrome-"));
  const base = ["--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=800,600", "--virtual-time-budget=3000", "--enable-logging=stderr", "--v=0", "--no-first-run", `--user-data-dir=${profile}`];

  const domArgs = [...base, "--dump-dom", URL_];
  transcript.commands.push([CHROME, ...domArgs].join(" "));
  const dom = await execFileP(CHROME, domArgs, { timeout: 60000, maxBuffer: 1 << 24 });
  check("DOM has <canvas id=\"game\" width=\"480\" height=\"320\">", /<canvas[^>]*id="game"[^>]*width="480"[^>]*height="320"|<canvas[^>]*width="480"[^>]*height="320"[^>]*id="game"/.test(dom.stdout), `dom length ${dom.stdout.length}`);

  const shotArgs = [...base, `--screenshot=${shotPath}`, URL_];
  transcript.commands.push([CHROME, ...shotArgs].join(" "));
  const shot = await execFileP(CHROME, shotArgs, { timeout: 60000, maxBuffer: 1 << 24 });

  const lines = `${dom.stderr}\n${shot.stderr}`.split("\n");
  transcript.consoleLines = lines.filter((l) => /CONSOLE/.test(l));
  transcript.otherChromeLogLines = lines.filter((l) => /ERROR/.test(l) && !/CONSOLE/.test(l)).slice(0, 20);
  check("console messages / load errors from Chrome == 0", transcript.consoleLines.length === 0, `${transcript.consoleLines.length} CONSOLE lines`);

  const png = decodePng(fs.readFileSync(shotPath));
  const { w, h, bpp, px } = png;
  const floor = hexToRgb(FLOOR);
  const shade = hexToRgb(SHADE);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  const colors = new Map();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * bpp;
      const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
      colors.set(key, (colors.get(key) || 0) + 1);
      if (near(px, i, floor) || near(px, i, shade)) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  check("screenshot is not a single flat color", colors.size >= 4, `${colors.size} distinct colors in ${w}x${h}`);
  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  check("floor + shade colors (each tile has a 2px shade strip) cover a 480x320 canvas rendered 1:1", boxW === 480 && boxH === 320, `floor bbox ${boxW}x${boxH} at (${minX},${minY})`);

  const has = (hex) => [...colors.keys()].some((k) => Math.abs(((k >> 16) & 255) - hexToRgb(hex)[0]) <= 2 && Math.abs(((k >> 8) & 255) - hexToRgb(hex)[1]) <= 2 && Math.abs((k & 255) - hexToRgb(hex)[2]) <= 2);
  for (const [name, hex] of [["floor shade", SHADE], ["bee body", BEE_BODY], ["bee stripe", BEE_STRIPE], ["bee wing", BEE_WING]]) check(`6장 palette color drawn: ${name} ${hex}`, has(hex), has(hex) ? "present" : "missing");

  const countIn = (tx, ty, hex) => {
    const rgb = hexToRgb(hex);
    let n = 0;
    for (let y = minY + ty * TILE; y < minY + (ty + 1) * TILE; y++) for (let x = minX + tx * TILE; x < minX + (tx + 1) * TILE; x++) if (near(px, (y * w + x) * bpp, rgb)) n++;
    return n;
  };
  const atStart = countIn(START.x, START.y, BEE_BODY);
  const atOrigin = countIn(0, 0, BEE_BODY);
  check(`bee body color is in the start tile (${START.x},${START.y}) and not in tile (0,0)`, atStart > 0 && atOrigin === 0, `start tile ${atStart}px, tile (0,0) ${atOrigin}px`);

  const failed = checks.filter((c) => c.result !== "PASS");
  for (const c of checks) console.log(`${c.result}  ${c.name}\n      ${c.observed}`);
  console.log(`\nchrome-render: ${checks.length - failed.length}/${checks.length} passed (screenshot: ${shotPath})`);
  exitCode = failed.length === 0 ? 0 : 1;
} catch (err) {
  console.error(`chrome-render: error: ${err.message}`);
  transcript.error = err.message;
} finally {
  if (server) server.kill();
  fs.writeFileSync(path.join(outDir, "chrome-render-transcript.json"), JSON.stringify(transcript, null, 2));
}
process.exit(exitCode);
