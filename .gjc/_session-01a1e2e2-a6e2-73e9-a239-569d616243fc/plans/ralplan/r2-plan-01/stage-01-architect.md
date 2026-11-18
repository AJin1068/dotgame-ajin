# Architect review pass 1 - R2 plan (stage-01-planner sha 9293577e...)

## Summary
The tick/handleKey design is sound: logical position moves at press, tick defers collection and wasp contact to moving.until, and handleKey settles on the old tile before moving. R1 tests and e2e stay valid with the stated adjustments. No blockers. One visible-design defect (result screens) and a few doc/e2e precision items.

## Claims verified (file-backed)
- 5장 map in plan: F at (2,1)(11,1)(12,6)(1,8)(13,8), W at (4,3); start row 4 / col 7 empty, so R1 edge paths (e2e edge(), logic tests) remain unobstructed. Path length 8+9+6+13+12=48; 48*150+35000=42200 correct; horizontal-first routes avoid (4,3).
- BEE_SPRITE non-null pixels = 50 (counted from src/sprites.js); bar rects (h=5, h=3) and floor rects (32x32, 32x2) are never 4x4, so 'last 50 4x4 rects' isolates the bee if main.js draws bee after flowers/wasp.
- Existing R1 filter (4x4 + palette 0-3) WOULD be fooled by flower sprite (uses palette 1), so the plan's change to e2e bee identification is necessary and sufficient.
- tick semantics: from=max(lastMs, moving.until); moving-phase only advances lastMs; wasp check at nowMs>=until; collectedMs integer-ms with floor => 4999/5000, 149/150, 42199/42200 boundaries are exact under a fake clock. handleKey order (lock check, then no-op move identity return, then tick, then move) preserves R1 identity assertions (edge press returns same object, dropped input returns s1) and R1 'moving.fromX/until' expectations (settled state keeps x,y of origin).
- Animation vs logic: logical x,y is destination during the 150ms; main.js beePosition interpolates from moving.fromX until until. Fail is set only at the first tick with now>=until, same instant the interpolation reaches the tile, so the result screen never shows before the bee visually arrives. Adjacent-tile and pass-by of non-wasp tiles are safe.
- Clock mixing (rAF ts vs performance.now): guard nowMs<=lastMs returns same state; worst case sub-frame skew, no negative dt. Acceptable.
- AGENTS.md: pure logic (tick takes nowMs), map copied from 5장, honey list is not a coordinate table (count mismatch throws), 8 colors only, no strings.js and zero UI text: compliant. Result screen without text is implementable (full-canvas fillRect + large sprite).

## Findings
1. MEDIUM - result sprites are camouflaged on their own background (plan 3장 / 5장 item 4). Success bg is palette 1 (#FFD23F) and the large BEE_SPRITE body pixels are palette 1 (18 pixels), fail bg is palette 7 and WASP_SPRITE body is palette 7 (majority of pixels). The 64x64 sprite loses its body fill and reads as floating outline/stripe fragments; the human cannot confirm 'big bee' / 'big wasp' (criteria 8, 9). Fix: draw a palette-0 (#1A1A1A) square panel (e.g. 80x80, 1px margin) behind the large sprite, or use palette 0 as result background with the full-screen color carried by a thick border; keep the full-canvas fill color check (w===480,h===320) for the e2e. Only 6장 colors needed.
2. LOW - e2e tile() throws 'bee was not drawn' when no 4x4 rects exist. In result frames the bee is drawn as 8px rects, so criteria 8/9 post-result 'no change on input' checks must not call tile(); make the reader return null in result frames and assert via the 480x320 fill style plus unchanged fill after further presses. Also assert the identified bee group has exactly 50 rects, so a draw-order break fails loudly instead of mis-locating.
3. LOW - design doc text inconsistency: 4장 row says flower uses palette 6,1,0 but the sprite spec uses only 6 and 1; 6장 edit contains the garbled clause for index 5 ('꽃 줄기 없음 대신 변경 없음'). Make 4장 say 6,1 only and drop the index-5 clause so GAME_DESIGN.md stays the single clean source (AGENTS.md).
4. LOW - risk 5 (hidden tab dt) is acknowledged and accepted (에이전트 제안). Note the exposure is larger than 'one big dt': on return the first rAF tick can complete a flower or whole level while the tab was hidden and on a flower. Accept as recorded; the 8장 one-liner should say it concretely. Do not add a dt clamp (new rule beyond design).
5. LOW - test wiring: test/index.js only imports logic.test.js; node --test test/ discovers files itself. Following the 'import in index.js' pattern is fine, but verify honey.test.js does not run twice or get skipped (run once and check the test count).

## Planner's named risks
- R1 e2e bee-identification regression: correctly diagnosed and fixed (see Claims). Residual: draw-order contract is implicit, hence finding 2 (count==50 assert, comment in main.js).
- R1 path regression through new map: closed by 5장 placement principle plus map unit test.

## Root Cause
None blocking. Finding 1 stems from reusing the same palette index for sprite body and screen background.

## Recommendations
1. Fold findings 1-3 into 3장/4장/6장 doc text and the e2e design before executor handoff (cheap, doc-first per AGENTS.md).
2. Keep tick/handleKey order exactly as specified; add unit test that pressing at now>=until on a wasp tile returns fail without moving (covers handleKey-before-frame path).
3. Keep scope: no dt clamp, no restart button.

## Architectural Status
WATCH

## Code Review Recommendation
COMMENT

## Tradeoffs
- Panel behind result sprite (+1 fillRect, no new color) vs. keep as is (cheaper but unreadable sprite): panel chosen.
- dt clamp vs. documented limitation: limitation kept (no new rules).
