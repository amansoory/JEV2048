# Complete-game comparison

Four fixed starting seeds per policy, 20 complete games. No move cap; play continued to game over even after 2048. Seeds: holdout-2048-a17, holdout-2048-b39, holdout-2048-c61, holdout-2048-d83.

| Policy | Reached 2048 | Mean score ± sample SD | Score range | Median | Mean moves ± SD | Mean decision ms | p95 ms | Jev calls | Reported input tokens |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| existing | 0/4 (0%) | 1153 ± 368 | 652–1536 | 1212 | 124.3 ± 27.9 | 225.03 | 357.00 | 497 | 507343 |
| immediate | 0/4 (0%) | 2389 ± 846 | 1216–3196 | 2572 | 204.0 ± 49.8 | 219.15 | 329.00 | 817 | 803467 |
| lookahead | 0/4 (0%) | 6162 ± 1400 | 4140–7312 | 6598 | 429.5 ± 71.4 | 226.75 | 348.00 | 1739 | 2297426 |
| heuristic | 0/4 (0%) | 3183 ± 1255 | 1684–4756 | 3146 | 258.8 ± 78.1 | 0.03 | 0.07 | 0 | 0 |
| search | 4/4 (100%) | 37880 ± 16561 | 25528–61404 | 32294 | 1880.3 ± 727.3 | 6.47 | 21.95 | 0 | 0 |

## What the results support

Search was strongest here: 4/4 reached 2048, and it had the highest score on every seed. This small sample does not establish a 100% long-run success rate. It is a search-based game solver, not a trained model.

Lookahead was the strongest Jev variant, beating existing Jev and the unchanged heuristic on all four paired starts. It is selected for live play. None of the Jev variants reached 2048 in these held-out games. Compact immediate outcomes alone improved mean score over the existing prompt but still trailed the unchanged heuristic overall. All variants, including unsuccessful ones, remain in the report and runner.

Selection used these results, so they are selection evidence, not an independent evaluation of the selected winner. Requests and solver weights were frozen before held-out games. No seed-based tuning was performed. More unseen seeds are needed for broader claims.

## Protocol and cost

The exact pre-change request is preserved in jev-baseline.js. immediate supplies compact exact outcomes. lookahead adds exact spawn-weighted expectations over one random spawn and the best possible immediate reply, maximizing points and space separately. These measures are not guaranteed outcomes and can require different replies. Jev receives no solver moves or heuristic scores and chooses its own legal direction through Choice. The fixed heuristic in public/engine.js is unchanged.

The development pilot used development-cost-2026 (one complete game per Jev policy plus heuristic): existing score 3168, immediate 3396, lookahead 12892, heuristic 1384. Lookahead reached 1024 there, not 2048. It used 1329 Jev calls and 1575203 reported input tokens in total. Before holdout, the estimate was about 5300 calls and 6.3M input tokens. The search development seed solver-development-01 reached 4096 with score 72424; it is excluded from held-out totals.

Actual held-out Jev usage: 3053 attempted calls, 3608236 reported input tokens, 129650 reported output tokens. 22 failed/invalid attempts were retried explicitly by the evaluation runner, with no fallback moves. Missing usage for failed requests cannot be reconstructed, so totals are reported usage, not a billing guarantee. Existing, immediate and lookahead call counts include retries. The browser does not silently retry or switch policies; errors require Retry.

Latency above uses successful decision records only. Jev includes request preparation and API round trip, with millisecond rounding in saved turn records. Search/heuristic are local CPU measurements on this machine, not an equal-hardware or equal-compute benchmark. Failed-request latency is not included in the summary. The original pilot runner's cumulative latency field can double-count validation-failure time, so it is deliberately not used for these Jev latency summaries. Heuristic timings were measured by replaying its same deterministic games and checking exact final score and move counts, because the initial runner did not time local moves.

Each game uses an independent copy of the seeded stream. Identical seeds reproduce starts; different directions change empty cells and later spawn positions. Jev itself may change decisions between calls, and jev-latest is a moving alias. Actual model IDs are stored per turn. Same seeds do not make future boards identical or make the API deterministic.

Manifest files contain source hashes. Raw per-turn checkpoints and final results are in artifacts/evaluation. Bootstrap confidence intervals are not claimed with only four seeds; the report gives sample SD, range, median and every result instead.

## Every complete result

| Seed | Policy | Score | Highest | Moves | 2048 | Calls | Input tokens |
|---|---|---:|---:|---:|---|---:|---:|
| holdout-2048-a17 | existing | 1232 | 128 | 128 | no | 128 | 131217 |
| holdout-2048-a17 | heuristic | 3156 | 256 | 260 | no | 0 | 0 |
| holdout-2048-a17 | immediate | 1216 | 64 | 138 | no | 138 | 135506 |
| holdout-2048-b39 | existing | 1536 | 128 | 153 | no | 153 | 154556 |
| holdout-2048-b39 | immediate | 2408 | 256 | 199 | no | 199 | 195932 |
| holdout-2048-b39 | heuristic | 1684 | 128 | 166 | no | 0 | 0 |
| holdout-2048-c61 | existing | 652 | 64 | 86 | no | 86 | 87741 |
| holdout-2048-a17 | lookahead | 6804 | 512 | 458 | no | 461 | 601854 |
| holdout-2048-b39 | lookahead | 4140 | 256 | 332 | no | 334 | 440454 |
| holdout-2048-c61 | heuristic | 3136 | 256 | 252 | no | 0 | 0 |
| holdout-2048-c61 | immediate | 3196 | 256 | 256 | no | 256 | 250942 |
| holdout-2048-d83 | existing | 1192 | 128 | 130 | no | 130 | 133829 |
| holdout-2048-d83 | immediate | 2736 | 256 | 223 | no | 224 | 221087 |
| holdout-2048-c61 | lookahead | 6392 | 512 | 428 | no | 431 | 572416 |
| holdout-2048-d83 | heuristic | 4756 | 256 | 357 | no | 0 | 0 |
| holdout-2048-d83 | lookahead | 7312 | 512 | 500 | no | 513 | 682702 |
| holdout-2048-a17 | search | 61404 | 4096 | 2885 | yes | 0 | 0 |
| holdout-2048-b39 | search | 27076 | 2048 | 1388 | yes | 0 | 0 |
| holdout-2048-c61 | search | 25528 | 2048 | 1305 | yes | 0 | 0 |
| holdout-2048-d83 | search | 37512 | 2048 | 1943 | yes | 0 | 0 |

## Reproduce

Set only server-side TYPESAFE_API_KEY in ignored .env.local. Run npm run evaluate:pilot, npm run evaluate:complete, npm run evaluate:search. Completed Jev checkpoints are reused; use a new documented seed set and separate artifact names for independent evidence. npm run evaluate:search reruns deterministic search games. Run node test/summarize-evaluation.mjs to rebuild this summary.
