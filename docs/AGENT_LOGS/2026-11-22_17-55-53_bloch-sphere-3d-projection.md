Title: Bloch-sphere 3D projection depth offset (Wave 2.7)

Summary:
- Modified src/ui/inspector-view.js drawSphere(): arrow tip now projects using v.y depth offset (tx = cx + v.x*R + v.y*R*0.35) so |i>/|-i> states do not collapse onto the center.
- Arrow head direction dx/dy now derived from projected 2D length (projectedLen) with a zero-guard, while len is kept for the > 0.02 draw threshold.
- Extracted pure, exported projectBloch(v, cx, cy, R) helper at module scope for testability; depthScale = 0.35 const.
- Added 4 tests to test/ui/inspector-view.test.js verifying |i>/|-i> depth offsets are opposite and x/z cardinal mapping is preserved.
- Verified: node --input-type=module --check passes; node --test full suite: 866 pass, 0 fail (was 862). inspector-view.js is 343 lines (< 400).
