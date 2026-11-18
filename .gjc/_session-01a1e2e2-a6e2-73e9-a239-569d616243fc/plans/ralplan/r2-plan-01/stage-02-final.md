# R2 Final Plan (pending approval)

Source revision (authoritative design delta and per-file steps): .gjc/_session-01a1e2e2-a6e2-73e9-a239-569d616243fc/plans/ralplan/r2-plan-01/stage-02-revision.md (sha256 [REDACTED]). Executors must read it in full; this final plan adds the ADR, the reconciliation and execution rules. Review: Architect pass 2 CLEAR/APPROVE (stage-02-architect.md, sha 5c6db983...), Critic pass 2 OKAY (stage-02-critic.md, sha 6375a54d...).

## ADR
- Decision: R2 is one goal (goal-2). Fix GAME_DESIGN.md 2/3/4/5/6/7/8/9장 first (design-v2), then code: tick(state, nowMs) in src/logic.js with per-flower collection, instant fail on wasp arrival, result screens without UI text, countable honey cells, tests and e2e extended honestly.
- Drivers: AGENTS.md (design doc is the only source; pure logic; map copied from 5장; 8 colors), human-checkable browser criteria 5-11, R1 behavior and R1 e2e must stay valid.
- Alternatives considered: HUD text for results (rejected: UI text is R3 and needs strings.js), splitting into multiple goals (rejected: collection, wasp and result share one validation surface), clamping dt for hidden tabs (rejected: not in design; documented and covered by the human check).
- Why chosen: smallest change that satisfies the interview facts (5 flowers with fixed honey, auto collect, fixed wasp, instant fail, success when all honey is collected) with testable numbers (4999/5000 ms, 149/150 ms, 42200 ms full route).
- Consequences: e2e bee identification changes (last 50 4x4 rects with a 50-rect sanity assert); the R1 18 key-sequence checks and 13 unit tests must still pass; expected totals in the revision (node --test: 31 tests).
- Follow-ups: R3 (storm timer, levels 2-3, sound, UI text), hidden-tab behavior if the design later wants a clamp.

## Intent Reconciliation
See stage-02-post-interview.md: reconciled-clean. Material open items: none. Caveat: write criterion 7 as about 3 s with the human leaving right when the 2nd cell vanishes (+-0.5 s tolerance kept).

## Execution rules (from standing user decisions)
1. Step 1 of the goal is the design doc (design-v2 content from stage-02-revision.md section 3), committed as design-v2 only after the code and human check, per AGENTS.md; code follows the revision section 5 file order.
2. Run node --test test/ (must report exactly the expected count), node e2e/key-sequence.js, node e2e/chrome-render.js, then the human browser check of criteria 5-11 from revision section 11. Say which criteria numbers to check and how to open (python3 -m http.server 8000, http://localhost:8000).
3. Quality gate: run the boundary gate honestly. The ultragoal screenshot rule rejects flat-color dot screenshots as placeholder (known, recorded for G001). If that is the only remaining rejection, do not pad or edit imagery: close the goal by human browser confirmation and record the gate message and reason with gjc ultragoal steer --kind annotate_ledger, without asking. If anything else is rejected, fix it or replan.
4. Stuck rules: same attempt more than 6 times, or the same check X twice in a row, or an out-of-scope feature: stop, replan via ralplan, commit replan-N.
5. Do not edit AGENTS.md. Do not commit .gjc runtime files beyond what is already tracked.
