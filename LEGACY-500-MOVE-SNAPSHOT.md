# Legacy Jev comparison at move 500

A post-hoc snapshot from saved complete games, extracted without running games or making provider calls. Seeds and policy definitions come from `artifacts/policy-lab-continuous/evaluation-manifest.json`. These are the legacy direction-based Feature and Assisted policies, not the current anonymous-candidate variants.

| Seed | Feature Jev | Assisted Jev | Pure expectimax |
|---|---:|---:|---:|
| lab-eval-11 | 7,312 | 9,212 | 7,336 |
| lab-eval-29 | 7,248 | 7,444 | 7,224 |
| lab-eval-47 | 7,440 | 7,308 | 7,332 |
| Mean | 7,333.3 | 7,988.0 | 7,297.3 |

Feature Jev led pure expectimax by 36 points on average (0.49%) at move 500 and in two of the three seeds. Assisted Jev had the highest mean among these three at that cutoff. This does not support calling Feature Jev the best Jev variant overall.

The games continued beyond this snapshot. A move-500 score is not a final-game ranking, and three seeds do not establish general superiority. This cutoff was extracted after results existed, not established as a new independent evaluation. The separate two-seed assisted agreement audit and ten-state arbitration experiments must not be conflated with these games.

Reproducible per-seed values, final scores/move counts and original file SHA-256 hashes are in `public/legacy-500-moves.json`. Original artifacts were not edited.
