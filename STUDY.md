# Headless 2048 study

Date: 2026-09-18. No browser or running web server is required. The runner imports the same game engine, fixed heuristic, six policy definitions and pinned `jev-1.13.0` model used by the app. It does not change any policy or select a substitute move for Jev.

## Commands

From `C:\Users\ArmanM\jev-2048`, with `TYPESAFE_API_KEY` in ignored `.env.local` or the server environment:

```powershell
# Two-seed paid pilot, two independent games at a time
npm run evaluate -- --seeds 2 --concurrency 2 --phase pilot --out artifacts/study-pilot-2026-09-18

# Resume the pilot with exactly the original configuration
npm run evaluate -- --seeds 2 --concurrency 2 --phase pilot --out artifacts/study-pilot-2026-09-18 --resume

# Prepare 20 final seeds and freeze sources, WITHOUT making any API calls
npm run evaluate -- --seeds 20 --concurrency 4 --phase evaluation --out artifacts/study-final-2026-09-18 --prepare

# Explicit paid full-run command, only after reviewing the pilot forecast
npm run evaluate -- --seeds 20 --concurrency 4 --phase evaluation --out artifacts/study-final-2026-09-18 --resume

# Recreate CSV, Markdown, charts and intervals without API calls
npm run evaluate -- --out artifacts/study-pilot-2026-09-18 --report
```

A new output directory also works with `npm run evaluate -- --seeds 20 --concurrency 4`. Existing directories require `--resume`; changed frozen sources or configuration are rejected. Do not overwrite manifests to bypass that check. Create a separate study for changed policies.

Stop with Ctrl+C: new decisions stop, pending decisions settle, and journals are saved. If the process is forcibly terminated, completed moves and request attempts remain on disk. A crash can leave `runner.lock`; inspect the PID in that file and remove **only that lock** after verifying the process no longer exists. The lock prevents concurrent processes writing the same study. Resume replays saved directions from the seed and checks every recorded board and score. Completed policy/seed pairs are skipped. An in-flight request lost in a hard crash may have been billed without its response being recorded; the runner cannot recover that provider-side fact.

## Protocol

Before any request, the runner generates a random study UUID and a full seed list. Seeds are `phase/UUID/index`; `pilot`, `tuning`, and `evaluation` are separate namespaces. All six policies use every seed, and no seed is dropped because of its result. Reuse the manifest for repeatable initial boards and spawn streams. Different moves change available empty positions, so later tile positions diverge. Jev responses themselves are not guaranteed reproducible.

The manifest pins the model, source SHA-256 hashes, Node version, package lock, prices, concurrency and rate configuration. Source copies are stored in `frozen/`. Do not tune policies on final seeds. Current policies are preserved separately from earlier historical evaluations.

Games run until **no legal moves remain**, with no move or API-call cap. 2048 and 4096 are milestones, not stopping conditions. Their first move numbers are recorded. A transient API failure gets at most three retries (500/1,000/2,000 ms exponential backoff, or a longer provider Retry-After). An illegal choice gets one corrected legal-options request. Exhaustion is **incomplete**, not a loss. A resumed incomplete game keeps previous calls, usage and moves. Retry budgets restart on an explicit resume; earlier failed attempts remain in the append-only journal.

## Policies

- **Raw Jev:** current board, legal directions, basic rules and goal.
- **Strategy Jev:** the same state plus the existing human-written strategy principles.
- **Feature Jev:** code-calculated immediate outcomes for every legal direction.
- **Expectimax-assisted Jev:** equal-format future quality, risk, mobility and dispersion summaries for each legal direction, using three player plies, two random spawn layers, 90/10 spawn probabilities and the existing 0.0001 probability cutoff. Jev makes the final choice and never receives a recommended direction.
- **Fixed heuristic:** unchanged weighted immediate features, no future search.
- **Pure expectimax:** unchanged bounded search chooses its highest calculated value, without Jev. Adapted from nneonneo/2048-ai under MIT; see `SEARCH-SOLVER.md` and `public/licenses/nneonneo-MIT.txt`.

For assisted decisions, separate audit code calculates pure expectimax's preferred move on the **same pre-move board**. The journal retains all values, presented summaries, choice probabilities, ties and disagreements. After each disagreement, it measures the change in best bounded-search value after the actual spawn. This is descriptive: it includes random-spawn effects and is not a counterfactual estimate of what would have happened after choosing the solver's move. Audit work is excluded from recorded decision latency, but may affect other games through CPU contention.

## Limits and cost

Current [TypeSafe documentation](https://docs.typesafe.ai/models) lists 1,200 requests/minute and 250,000 tokens/second, subject to change. Defaults are lower: `--rpm 1000 --tps 200000`. One shared rolling-window limiter governs all concurrent games in this process. Each request reserves 32,768 tokens, conservatively covering the documented single-question context budget. Reservations are not billed usage; costs use reported usage only. The token limiter can throttle even when actual token usage is much lower. A 429 also triggers a shared cooldown. Never overlap requests within one game.

Set lower limits if your account requires them. Other apps or runner processes sharing the same API key are **not** coordinated by this process-local limiter. Pause other workloads or divide the account budget between them. This is a local study tool, not shared public-site abuse protection.

Prices are frozen as `--input-price 0.042 --output-price 0` USD per million tokens. Missing usage is counted explicitly; estimates based on known tokens are lower bounds, not invoices. The pilot produces `forecast-20-seeds.json`: linear calls, input/output tokens and cost estimates plus optimistic doubled-concurrency and observed-throughput runtime estimates. The optimistic estimate cannot fall below the configured request/token reservation rate floor. At the default token reservation, six requests per second is the maximum, so more concurrency may not increase throughput. Two seeds cannot establish a reliable upper bound for long games. **The runner does not automatically start a full study after a pilot.**

## Outputs and interpretation

- `manifest.json` and `frozen/`: pre-recorded seeds and source/configuration freeze.
- `NNN-policy.jsonl`: append-only per-game attempts, retries, actual moves, exact Jev evidence, distributions, assisted audits and terminal results. Writes are flushed to disk. Crash-tail recovery preserves the damaged bytes with a recovery marker.
- `results.jsonl`: append-only terminal snapshots. A resumed incomplete game can have multiple snapshots; use its latest result, never count snapshots as separate games.
- `summary.csv`: one latest row per policy/seed, including latency mean/median/p95, milestones, usage, cost and status.
- `statistics.json`: aggregates and all paired per-seed differences.
- `REPORT.md`, SVG charts: score and highest-tile distributions, 2048 success rates with Wilson intervals, latency, input/output tokens and costs.
- `events.jsonl`: runner sessions; `forecast-20-seeds.json`: planning estimate.

Only complete games enter score and success summaries. Incomplete runs are listed separately; exclusions can still bias comparisons, so inspect failure counts. Score means and paired score/success differences use reproducible 2,000-replicate percentile bootstrap intervals. Success proportions also use Wilson intervals. Pairing means matching starting seeds, not identical future boards. Intervals are exploratory and not adjusted for multiple comparisons. Two-seed bootstrap intervals are especially unstable. More independent final seeds are needed for performance claims.

Concurrent games share a Node process. Decision latency includes construction, provider time, limiter waits and retries; it is not isolated model-inference latency. Local CPU policies and network policies have different timing costs. A complete game can run much longer than the pilot average.

## Focused checks

```powershell
npm run test:study
node study/integration.test.mjs
node study/verify.mjs artifacts/study-pilot-2026-09-18
```

The integration check uses an explicit mock provider, makes no paid calls, interrupts and resumes real engine games, checks all six finish, verifies completed pairs are not rerun, and rejects altered frozen hashes. Mock results are isolated from the live pilot.

## Completed pilot: 2026-09-18

Both pilot seeds finished under all six policies: 12 complete games, no incomplete games, no transient retries and no missing token usage. Total: 5,353 Jev calls, 5,157,063 input tokens, 225,142 output tokens, estimated $0.216597, and 16.95 minutes at concurrency 2.

| Policy | Mean score | Score range | Reached 2048 |
|---|---:|---|---:|
| Raw Jev | 796 | 736–856 | 0/2 |
| Strategy Jev | 1,046 | 716–1,376 | 0/2 |
| Feature Jev | 10,770 | 6,168–15,372 | 0/2 |
| Expectimax-assisted Jev | 34,276 | 31,496–37,056 | 2/2 |
| Fixed heuristic | 2,576 | 2,060–3,092 | 0/2 |
| Pure expectimax | 89,272 | 62,152–116,392 | 2/2 |

Pure expectimax had the highest mean score in this pilot and reached 4096 and 8192. Assisted Jev reached 2048 in both games. It agreed with the pure solver's deterministic preferred direction in 3,554 of 3,559 decisions (99.86%). Four of the five disagreements were equal-best ties; one selected a lower search value. Search support accounts for much of the observed behavior. Two seeds are insufficient to establish general superiority; the report includes wide success intervals and exploratory paired bootstrap intervals.

The 20-seed projection is **53,530 calls, 51,570,630 input tokens, 2,251,420 output tokens, about $2.17, and roughly 149–169 minutes** with the current limits. Long games or provider changes can exceed this planning range. The conservative token reservation limiter constrains throughput even at concurrency 4. The full study is prepared but has not run.

[Complete pilot report and charts](artifacts/study-pilot-2026-09-18/REPORT.md), [CSV](artifacts/study-pilot-2026-09-18/summary.csv), [forecast](artifacts/study-pilot-2026-09-18/forecast-20-seeds.json), [final seed manifest](artifacts/study-final-2026-09-18/manifest.json).

Validation: six focused tests passed; a mock-only end-to-end run verified interruption, resume, all six completed policies, completed-pair skipping and source-hash rejection. Live replay verification checked all 12 games and 13,531 moves, recomputed 35 sampled search audits, and checked all five disagreements. SVG exports were rendered and inspected separately from benchmark execution. No browser UI was used to run games.
