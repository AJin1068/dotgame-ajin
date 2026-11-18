# R3 final plan (pending approval)

Authoritative design delta and per-file steps: stage-02-revision.md (sha256 [REDACTED]) in this run directory. Review: Architect stage-02 CLEAR/APPROVE (48ceb648...), Critic stage-02 OKAY (4e52656a...).

## ADR
- Decision: one goal (goal-3) implementing storm timer (90s per level, tie = success), levels 2-3, WebAudio sound, src/strings.js UI text, criteria 12-19, 57 tests total.
- Drivers: deterministic fake-clock boundary tests; AGENTS.md compliance (8 colours, no forbidden features, numbers from the design doc); human-checkable criteria with keys and stopwatch.
- Alternatives considered: key-to-advance levels, level select/URL params (rejected: forbidden/added control); setInterval storm (rejected: untestable).
- Why chosen: pure tick(nowMs) extension, opt-in storm option keeps R1/R2 tests unchanged.
- Consequences: a new src/sound.js and src/strings.js; auto-advance after 3s result hold; F5 restarts at level 1.
- Follow-ups: none in scope; near-white storm screen glare noted as risk 15.

## Intent Reconciliation
No open items. All new values (에이전트 제안) are approved. R1/R2 numbers and test expectations unchanged.

## Execution rules
Design doc (design-v3) first, then code with tests red first; expected node --test total exactly 57 after checking 31 baseline; e2e scripts extended; human checks criteria 12-19; screenshot-gate rejection of flat-colour imagery is closed on human confirmation with annotate_ledger; stuck rules per revision section 11; do not edit AGENTS.md; commits design-v3 and goal-3 after human OK, then push.
