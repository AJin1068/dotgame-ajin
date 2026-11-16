# Deep Interview Spec: 꿀벌 꿀 모으기

## Metadata
- Interview ID: 01a1e2e2-deep-interview-bee-game
- Rounds: 5 (+ Round 0 topology gate, + restate gate)
- Final Ambiguity Score: 19%
- Type: greenfield (저장소에는 AGENTS.md만 있음)
- Generated: 2026-11-16 (KST)
- Threshold: 60%
- Threshold Source: --quick mode default
- Initial Context Summarized: no
- Status: PASSED
- Auto-Answered Rounds: 0
- Architect Failures: 0
- Lateral Reviews: 0 (ambiguity 전이 구간 없음, 단일 사용자 응답만 사용)
- Lateral Panel Failures: 0
- Refined Rounds: 0
- Closure Overrides: 0
- Restated Goal: 플레이어는 방향키로 벌을 움직여 꽃 5송이의 꿀을 각 꽃에 정해진 양만큼 채우고, 고정 시간(소나기) 전에 모두 채우면 성공하며, 고정 위치의 말벌에 닿으면 실패한다.

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.9 | 0.40 | 0.36 |
| Constraint Clarity | 0.8 | 0.30 | 0.24 |
| Success Criteria | 0.7 | 0.30 | 0.21 |
| **Total Clarity** | | | **0.81** |
| **Ambiguity** | | | **0.19** |

## Topology
| Component | Status | Description | Coverage / Deferral Note |
|-----------|--------|-------------|--------------------------|
| 꿀 수집 | active | 벌이 꽃 5송이에서 꿀을 모음 | 방향키 이동, 꽃 위 체류 시 자동 채집, 꽃별 목표량까지 채우면 완료. 수치는 기획서 작성 시 확정 |
| 말벌 위협 | active | 말벌에 닿으면 실패 | 말벌은 고정 위치에서 정지, 접촉 즉시 실패 |
| 소나기 타이머 | active | 소나기 전에 완료해야 함 | 고정 시간에 소나기 발생. 초 단위 값은 기획서 작성 시 확정 |

## Established Facts
- 꽃마다 꿀 양이 정해져 있고, 벌이 그 양만큼 채우면 해당 꽃 완료 (Round 1)
- 말벌은 고정 위치에서 움직이지 않으며 접촉 즉시 실패 (Round 2)
- 소나기는 고정 시간에 옴 (Round 3)
- 벌 조작: 키보드 방향키 이동, 꽃 위에 머물면 자동 채집 (Round 4)
- 꽃별 꿀 양, 소나기 초 단위 값은 기획서 작성 시 정함 (Round 5, 사용자 이연)

## Trigger Metadata
- 전 라운드 trigger 없음. 모호도 추이: 1.00 (Round 0 전) → 0.39 → 0.30 → 0.23 → 0.19 → 0.19

## Lateral Review Panel
- 미소집. 단일 사용자 응답 기반으로 진행.

## Locked Intent
- artifact:honey-run: 꽃 5송이의 꿀을 소나기 전에 모두 모으면 성공
- surface:wasp-contact: 말벌에 닿으면 실패
- constraint:storm-timer: 소나기가 오기 전에 완료해야 함

## Goal
플레이어는 방향키로 벌을 움직여 꽃 5송이의 꿀을 각 꽃에 정해진 양만큼 채운다. 고정 시간의 소나기가 오기 전에 5송이를 모두 채우면 성공이고, 고정 위치의 말벌에 닿으면 실패한다.

## Constraints
- 꽃 5송이, 각 꽃의 꿀 양은 꽃마다 다르게 정해진다 (수치는 기획서에서 확정)
- 소나기는 고정 시간에 온다 (초 단위 값은 기획서에서 확정)
- 말벌은 고정 위치에서 움직이지 않는다
- 말벌 접촉은 즉시 실패
- 벌 조작은 방향키, 꽃 위 체류 시 자동 채집

## Non-Goals
- 말벌 이동, 말벌 패턴 (말벌은 고정)
- 채집 시 별도 버튼 조작 (자동 채집)
- 이 인터뷰에서 정하지 않은 기능 일체 (AGENTS.md: 기획서에 없는 기능은 만들지 않음)

## Acceptance Criteria
- [ ] 방향키로 벌이 화면에서 이동한다
- [ ] 벌이 꽃 위에 머물면 그 꽃의 꿀이 자동으로 채워진다
- [ ] 꽃 5송이 각각이 정해진 양을 채우면 완료 상태가 된다
- [ ] 5송이를 모두 완료한 상태에서 소나기 시간 전이면 성공 화면이 뜬다
- [ ] 소나기 시간이 되었을 때 5송이가 모두 완료되지 않았으면 실패한다
- [ ] 말벌(고정 위치)에 벌이 닿으면 즉시 실패한다
- [ ] 꽃별 꿀 양과 소나기 시간의 수치가 기획서에 적혀 있고 코드가 그 수치를 쓴다

## Deferrals
- 꽃별 꿀 양 수치: 사용자가 기획서 작성 시 정하기로 함 (Round 5)
- 소나기 초 단위 값: 같은 이유로 기획서 작성 시 정함. Round 3에서 선택한 "고정 시간" 예시 문구의 30초는 사용자가 확정한 값이 아님
- 기획 문서: AGENTS.md는 GAME_DESIGN.md를 기준으로 지정하지만 현재 저장소에 없음. 수치는 GAME_DESIGN.md 작성 후 확정해야 함

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| "모두 모은다"의 의미가 불명확 | 꽃 상태 정의 요청 | 꽃별 고정 양을 벌이 채우면 완료 |
| 말벌이 움직이는지 불명확 | 이동 여부 질문 | 고정 위치, 접촉 즉시 실패 |
| 소나기 시점이 불명확 | 제한 시간 방식 질문 | 고정 시간 |
| 조작 방식 불명확 | 입력 방식 질문 | 방향키, 꽃 위 자동 채집 |

## Technical Context
- 저장소: AGENTS.md만 존재. 소스, 패키지 파일, git 기반 게임 코드 없음
- AGENTS.md 제약 적용 대상: HTML + Canvas 2D + ES modules, 의존성 0, 맵은 GAME_DESIGN.md 5장 문자 격자, 스프라이트는 팔레트 배열, 색은 GAME_DESIGN.md 6장 8색, 테스트 기대값은 기획서 수치에서 가져옴
- 따라서 GAME_DESIGN.md 작성 또는 확보가 실행 전 선행 조건

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| 벌 (Bee) | core | 위치, 이동 | 방향키로 이동, 꽃에 머묾 |
| 꽃 (Flower) | core | 목표 꿀 양, 채워진 양, 완료 여부 | 벌이 머물면 채워짐, 5송이 |
| 말벌 (Wasp) | supporting | 고정 위치 | 벌과 접촉 시 실패 |
| 소나기 (Storm) | supporting | 고정 도래 시간 | 도래 시 미완료면 실패 |

## Ontology Convergence
Ontology 스냅샷은 저장되지 않았음 (round 간 엔티티 추적 미실행). 이 명세의 엔티티 목록은 최종 답변 기준으로 정리함.

## Interview Transcript
<details>
<summary>Full Q&A (5 rounds + Round 0 + restate)</summary>

### Round 0 (Topology)
**Q:** 3개 구성 요소(꿀 수집, 말벌 위협, 소나기 타이머)와 잠금 의도가 맞는지 확인
**A:** 맞음

### Round 1 (꿀 수집 / Success Criteria)
**Q:** "꽃 5송이의 꿀을 모두 모음"은 무슨 뜻인가?
**A:** 꽃마다 꿀 양이 정해져 있고, 벌이 그 양만큼 채워야 완료
**Ambiguity:** 39%

### Round 2 (말벌 위협 / Constraints)
**Q:** 말벌은 어떻게 움직이고 닿으면 어떻게 되는가?
**A:** 고정된 위치에서 가만히 있음. 접촉 시 바로 실패
**Ambiguity:** 30%

### Round 3 (소나기 타이머 / Constraints)
**Q:** 소나기는 언제 오나?
**A:** 고정 시간(예시 문구 30초 포함, 초 단위 값은 미확정)
**Ambiguity:** 23%

### Round 4 (꿀 수집 / Goal)
**Q:** 플레이어는 벌을 어떻게 움직이나?
**A:** 키보드 방향키로 이동, 꽃 위에 머물면 자동 채집
**Ambiguity:** 19%

### Round 5 (꿀 수집 / Success Criteria)
**Q:** 꽃별 꿀 양과 소나기 시간을 지금 정하나, 기획서 작성 때 정하나?
**A:** 기획서를 만들 때 정함
**Ambiguity:** 19%

### Restate
**Goal:** 플레이어는 방향키로 벌을 움직여 꽃 5송이의 꿀을 각 꽃에 정해진 양만큼 채우고, 고정 시간의 소나기 전에 모두 채우면 성공, 고정 위치의 말벌에 닿으면 실패한다.
**A:** 예, 확정
</details>
