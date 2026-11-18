# Architect review pass 1 (R1 planner)

Architectural Status: WATCH
Decision: REQUEST CHANGES

Findings:
- A1 HIGH: GAME_DESIGN.md 2장 값(32px, 15x10, 150ms)이 에이전트 제안이라 테스트 기대값으로 쓰면 순환 검증이 됨. 사람 승인 후 테스트.
- A2 MEDIUM: 5장(맵)과 6장(팔레트)이 비어 있어 levels.js 복사와 sprites.js 팔레트 단계가 실행 불가. design-v1에서 채운 뒤 코드.
- A3 MEDIUM: 이동 잠금·입력 버림은 순수 로직(handleKey(state, dir, nowMs))으로 두고 main.js는 키 매핑과 시간만 공급.
- A4 MEDIUM: 이동 중 입력 버림 규칙은 미승인이며 빠른 연타 한 번을 잃을 수 있어 '한 번 입력 = 한 칸'과 충돌 가능. Q4 승인 게이트 유지.
- A5 MEDIUM: 9장이 R2 빈 상태라 R1 검증 a-d가 기획서에 연결되지 않음. R1 항목을 9장에 추가.
- A6 LOW: 벌 시작 칸과 스프라이트 배열은 4장 오브젝트 목록이 먼저 필요.

Scope check: 계획 자체는 기획서 밖 기능을 추가하지 않음. 순수 로직과 캔버스 분리는 AGENTS.md와 일치.
read-only review. Parent persists this receipt.
