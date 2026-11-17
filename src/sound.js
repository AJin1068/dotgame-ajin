// GAME_DESIGN.md 7장 효과음. WebAudio 합성만 쓴다 (파일·fetch·배경음악 없음).
// 음 하나 = OscillatorNode 1개 + GainNode 1개. AudioContext는 resume()(첫 방향키)에서 만든다.

const GAIN = 0.08;
// 이름 -> 음 목록 { type, hz, at(시작 오프셋 초), dur(초) }
const SOUNDS = {
  gather: [{ type: "square", hz: 880, at: 0, dur: 0.06 }],
  success: [
    { type: "square", hz: 523, at: 0, dur: 0.12 },
    { type: "square", hz: 659, at: 0.12, dur: 0.12 },
    { type: "square", hz: 784, at: 0.24, dur: 0.12 },
  ],
  fail: [{ type: "triangle", hz: 196, at: 0, dur: 0.4 }],
};

export function createSound() {
  let ctx = null;
  return {
    resume() {
      const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!Ctor) return;
      if (ctx === null) ctx = new Ctor();
      ctx.resume?.();
    },
    play(name) {
      if (ctx === null || !Object.hasOwn(SOUNDS, name)) return;
      for (const note of SOUNDS[name]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = note.type;
        osc.frequency.value = note.hz;
        gain.gain.value = GAIN;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const when = ctx.currentTime + note.at;
        osc.start(when);
        osc.stop(when + note.dur);
      }
    },
  };
}
