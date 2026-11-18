# R1 Final Plan (pending approval)

Source revision: stage-03-revision.md (sha256 3263f80c...). Architect CLEAR/APPROVE, Critic OKAY, both pass 3.

## ADR
- Decision: R1 = 맵 위 벨 이동 하나. 기획서 v1 값(2·4·5·6·8장)을 근거로 코드를 쓴다.
- Drivers: AGENTS.md의 기획서 기준, 사람 승인 최소화(질문은 최종 승인과 브라우저 확인만), 단순한 정적 실행.
- Alternatives considered: (a) 코드를 먼저 쓰고 기획서는 나중에 — AGENTS.md 위반. (b) 빌드 도구나 번들러 사용 — 금지. (c) file:// 실행 — CORS로 차단.
- Why chosen: 기획서와 AGENTS.md가 이미 이 순서를 요구하고, 검토를 통과한 값이다.
- Consequences: 테스트는 2장 값으로만 쓴다. 이동 규칙이 틀리면 기획서를 먼저 고친다.
- Follow-ups: R2 (채집, 말벌, 꽃, 소나기, 9장 나머지), R3 (레벨 2·3, 사운드, UI 문구).

## Intent Reconciliation
See stage-03-post-interview.md: reconciled-clean. Material open items: none.

## Execution steps (goal: R1)
1. GAME_DESIGN.md 에 v1 반영 (stage-03-revision 의 내용 그대로). 이는 기획서 작업 이므로 작업 시작 전에 완료.
2. src/levels.js: 5장 문자 격자를 그대로 복사.
3. src/logic.js: 순수 함수 moveBee(state, dir) 와 입력 처리 함수 handleKey(state, dir, nowMs). canvas 참조 없음. 이동 중 입력 버림, 키 반복 무시는 여기서.
4. src/sprites.js: 6장 팔레트 인덱스를 쓴 8×8 벌 스프라이트 배열.
5. src/strings.js: R1에는 문구 없음 (파일은 만들지 않음).
6. test/logic.test.js: 2장 값(32px, 15x10, 150ms, 버림 규칙)만 기대값으로 삼는다. 예: 한 번 입력 = 정확히 1칸, 경계 밖 입력 무시, 이동 중 입력 버림.
7. index.html + src/main.js: canvas 480×320, 타일 32px, keydown에서 e.repeat 무시, 150ms 이동 애니메이션은 렌더만.
8. 실행 확인: node --test test/ 가 0개를 돌리면 실패로 보고 명령을 정확히 맞춘다 (N3-1). 실행 테스트 개수 > 0 확인.

## Browser check (goal 완료 시 사람이 확인)
열기: 터미널에서 `python3 -m http.server 8000` 실행 후 http://localhost:8000 열기.
- 9장 1: 방향키 한 번 → 정확히 한 칸, 150ms 안 도착.
- 9장 2: 방향키를 계속 누름 → 한 칸만.
- 9장 3: 가장자리에서 바깥 방향 → 아무 일 없음.
- 9장 4: 이동 중 다른 키 → 무시. 키를 뗐 다시 누르면 다시 한 칸.

## Open items
- AGENTS.md의 실행 줄은 사람이 수정했음. 코드 작업에서 수정하지 않는다.
