# R1 Plan (Planner stage 1)

Gate: GAME_DESIGN.md 4장 오브젝트, 5장 레벨 1 맵, 6장 8색 팔레트를 design-v1로 채우고 사람이 승인하기 전에는 코드 작성 금지.

Goal: 맵 위에서 벌이 방향키 1회에 정확히 한 칸씩 이동한다 (2장 값: 32px 타일, 15×10칸, 480×320px, 150ms).

Steps after gate: levels.js 복사(5장), logic.js moveBee 순수 함수, test/logic.test.js 2장 기대값, index.html+main.js 키 입력(e.repeat 무시, 이동 중 입력 버림), sprites.js 6장 팔레트.

Verification: node --test test/ 통과; 브라우저 수동 확인 a) 한 번 입력 한 칸 b) 누르고 있어도 한 칸 c) 가장자리 무시 d) 이동 중 입력 버림.

Open questions (must be answered in design-v1): Q1 R1 수용 기준을 9장에 지금 쓸지 (9장은 R2); Q2 레벨 1 맵에 꽃·말벌 글자를 넣을지 (기본안: 빈 바닥만); Q3 벌 시작 칸; Q4 이동 중 입력 버림 규칙 승인.

Scope: in = 이동, 레벨1 맵 표시, 벌 스프라이트. out = 채집, 말벌, 소나기, 점수, 레벨 2·3, 사운드, UI 문구.

Consensus: planner stage only; architect/critic not run.
