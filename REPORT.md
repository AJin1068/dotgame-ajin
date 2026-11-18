# REPORT — 꿀벌 꿀 모으기

> ✍️ 표시가 있는 곳은 직접 한두 줄 써 주세요. 나머지는 커밋과 `.gjc` 기록을 그대로 옮긴 사실입니다.

기록 위치
- ralplan: `.gjc/_session-01a1e2e2-a6e2-73e9-a239-569d616243fc/plans/ralplan/` (R1: `01a1e2e2-…/`, R2: `r2-plan-01/`, R3: `r3-plan-01/`)
- ultragoal: 같은 세션 폴더의 `ultragoal/goals.json`, `ultragoal/ledger.jsonl` (40줄)
- 이하 "ledger N"은 `ledger.jsonl`의 N번째 줄이다.

## 1. 기획서가 자란 과정 (라운드별 한 줄)

| 라운드 | 커밋 | 추가된 것 |
|---|---|---|
| R0 | `00b94a0` design-v0 | 한 줄 콘셉트와 이동 규칙만. 나머지 장은 제목만 두고 "다음 라운드 메모"로 미룸 |
| R1 | `f947eaa` design-v1 | 레벨 1 맵(15×10, 32px 타일), 8색 팔레트, 기술 스펙(ES module, package.json 없음), 수용 기준 1~4 |
| R1 보완 | `cb6f67c` fix-4, `ff8a95b` fix-5 | 8장에 e2e 스크립트가 확인하는 것과 못 하는 것을 적음 |
| R2 | `42f3b4e` design-v2 | 꽃·꿀 채집·말벌·성공/실패, 수용 기준 5~11 |
| R3 | `8dc0b4f` design-v3 | 소나기 90초, 레벨 2~3, 사운드, UI 문구, 맵 아래 HUD 띠, 수용 기준 12~19 |
| R3 마무리 | `7656369` design-v3 | 타이틀 화면 흐름, 수용 기준 20, 1~20 사람 확인 표시 |

✍️ 기획서를 키우면서 느낀 점 한 줄: 

## 2. 막힌 goal 분석: G001 (R1)

**무엇이 막혔나.** R1 구현은 끝났지만 G001을 complete로 기록하지 못했다.

1. 처음에는 사람 브라우저 확인(9장 기준 1~4)을 기다리며 멈췄다 (ledger 4, 7, 8: `human_blocked`).
2. 확인을 마친 뒤에는 quality gate가 스크린샷을 거부했다. 거부 이유는 "screenshot artifact must be non-uniform, not blank, solid, tiny, or placeholder imagery"였다 (ledger 10). 우리 게임은 기획서 6장에 따라 8색 평면 도트라서, 실제 화면도 한 색이 대부분을 차지한다. headless Chrome 캡처, 무손실 재인코딩, 사람이 찍은 캡처까지 모두 거부되었다 (ledger 12).
3. 에이전트는 통과시키려고 이미지에 노이즈를 넣거나 편집하지 않았다 (ledger 10, 12).

**어떻게 처리했나.** gjc에는 스크린샷 규칙을 면제하는 방법이 없다. 그래서 사람 확인을 근거로 goal을 닫고, 거부 메시지와 이유를 ledger에 남기기로 결정했다 (ledger 12, `steering_accepted`/`annotate_ledger`). 같은 이유로 막히는 이후 goal도 같은 방식으로 닫았다. 이후 G003은 같은 계열의 "4096 bytes 미만" 거부로 막혔다 (ledger 30, 32). 그래서 `goals.json`에는 G001, G003, G004가 `blocked`로 남아 있다. 숨기지 않고 그대로 두었다.

**같이 드러난 문제.** 위 과정에서 gate가 다른 증거도 요구했다.
- `node --test test/`가 Node 22에서 테스트를 0개 실행했다 (G001 evidence). → `9ad7269` fix-1에서 `test/index.js`를 추가
- e2e를 "해당 없음"으로 둘 수 없었다. → `cb6f67c` fix-4에서 key-sequence 재생과 headless Chrome 렌더 스크립트를 추가
- integration base가 없었다. → 원격 저장소를 만들고 `f947eaa`를 origin/main으로 push

**replan을 하지 않은 이유.** 막힌 원인이 계획의 결함이 아니었다. 사람 확인 대기와 gate의 스크린샷 휴리스틱 때문이었다. 그래서 ralplan으로 돌아가지 않았다. R2의 G002는 사람 확인을 기다리느라 blocked가 되었다. 계획을 고치지 않고 G003으로 대체했다 (ledger 27, 28: `mark_blocked_superseded`, `noReplacementRequired`).

✍️ 이 막힘에서 배운 점 한 줄: 

## 3. harness가 막아 준 사례 / 못 막은 사례

### 막아 준 사례
- **테스트가 실제로 도는지 확인했다.** gate가 테스트 0개 실행을 통과시키지 않아서, Node 22에서 `node --test test/`가 아무것도 안 돌던 문제를 R1에서 잡았다 (`9ad7269` fix-1).
- **방향키 입력 검증이 강해졌다.** R1 검토 단계에서 `Object.prototype` 키(예: `"constructor"`)가 방향으로 처리될 수 있는 문제가 나와서 막았다 (`b2d5bb6` fix-3). 이어서 숫자가 아닌 시간 값, 프로토타입 키 같은 입력 가드도 보강했다 (`ff8a95b` fix-5).
- **e2e 없이 넘어가지 못했다.** gate가 e2e "해당 없음"을 거부했다. 그래서 키 입력 재생 스크립트와 headless Chrome 렌더 스크립트가 생겼고, 이후 라운드마다 회귀 검사로 썼다 (`cb6f67c` fix-4, `c059b41` fix-6).
- **AGENTS.md 금지 목록을 지켰다.** package.json과 외부 라이브러리 없이 끝까지 갔다. 스크린샷이 거부되었을 때도 이미지를 조작하지 않았다 (ledger 10).

### 못 막은 사례
- **HUD가 맵 맨 아래 줄을 가렸다.** 단위 테스트와 e2e는 모두 통과했지만 사람이 브라우저에서 보고 기준 12를 X로 표시했다. canvas를 480×352로 늘려 HUD 띠를 맵 아래로 옮기고 고쳤다 (`9a88379` goal-4, ledger 38). 이후 "벌이 9행에 있을 때 HUD와 겹치지 않음" 검사를 e2e에 추가했다 (GAME_DESIGN.md 8장).
- **gate가 진짜 화면을 placeholder로 판정했다.** 평면 도트 게임의 실제 캡처를 "단색 이미지"로 거부했다 (ledger 10, 30). 반대로 막을 필요가 없는 것을 막은 사례다.
- **기록이 커밋되지 않았다.** ralplan 플랜과 `goals.json`/`ledger.jsonl`이 R3가 끝날 때까지 git에 추가되지 않았다. 채점기 dry-run을 돌려 보고서야 알았고, `c77ff21` fix-7에서 커밋했다. 스크린샷도 마지막에 `2a60ea0` fix-8로 추가했다.
- **goal 번호가 어긋났다.** 커밋 번호와 라운드가 일대일로 맞지 않는다. R3 구현이 `goal-4`(`9a88379`, `4711125`)와 `goal-5`(`9e00b84`, `17d89b2`)로 두 번씩 찍혔고, `goal-3` 커밋은 없다.

✍️ 다음에 AGENTS.md에 추가하고 싶은 규칙 한 줄: 

## 4. 사람이 한 일
- 각 라운드 ralplan 최종 플랜 승인 (ledger 13: r2-plan-01, ledger 31: r3-plan-01)
- 브라우저에서 수용 기준 1~20 확인. 1~19는 타이틀 추가 전 빌드에서 확인했고, 20은 타이틀 화면에서 확인했다 (ledger 40, `7656369`)
- 스크린샷 4장 캡처: `screenshots/title.png`, `play.png`, `clear.png`, `fail.png`. `clear.png`는 레벨 1 클리어 화면이다
- 스크린샷 gate 거부 시 사람 확인으로 닫는다는 결정 (ledger 12)
