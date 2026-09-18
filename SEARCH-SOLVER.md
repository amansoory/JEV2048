# Search solver and rule audit

## Choice of integration

Reviewed [ovolve/2048-AI](https://github.com/ovolve/2048-AI) and [nneonneo/2048-ai](https://github.com/nneonneo/2048-ai).

Ovolve is already JavaScript. It uses iterative-deepening alpha-beta search with a deliberately adversarial subset of spawn positions. Its evaluation rewards empty cells, smoothness, monotonic rows/columns, and the largest tile. Its original winning-state short circuit would need adaptation for continuing beyond 2048. Its published success rate is not a measurement of this app.

Nneonneo uses expectimax with actual 90/10 tile probabilities, a row evaluation table and a highly optimized C++ bitboard. A native build or Wasm toolchain would add maintenance here. We instead use a small JavaScript adaptation of its evaluation and search approach in a reusable Web Worker. This is not the full original solver and does not inherit its published performance claims.

`public/search-solver.js` explores three player moves including the current move, with two intervening spawn layers. Every expanded chance node averages every empty cell and both tile values. Paths below probability 0.0001 stop at the evaluator. Evaluation weights are the upstream defaults: empty cells 270, merge opportunities 700, monotonicity penalty 47 on fourth powers of ranks, rank-sum penalty 11 on powers of 3.5, row offset 200000. Terminal search states score zero. A merge-opportunity feature counts equal-value runs, not the engine's count of merges on this turn.

The port uses cached row arrays, avoiding 64-bit bitwise limitations in JavaScript. Unlike the original four-bit representation, it does not saturate 32768 merges. It does not read the actual seeded random stream. Ties use up, left, down, right. Fixed depth and probability pruning make move choices deterministic for a given board. Computation is local, with no API usage.

Attribution: Robert Xiao and contributors, nneonneo/2048-ai. The complete MIT copyright and permission notice ships at `public/licenses/nneonneo-MIT.txt` and is linked in the app. The recorded source revision is beside it. Ovolve was investigated but no source from it is shipped.

## Original rules

The reference files under `test/reference` are from Gabriele Cirulli's original MIT-licensed 2048 repository, with license and pinned revision. The differential test runs its real movement implementation on 1000 deterministic boards in all four directions, suppressing only the post-move random spawn to compare deterministic outcomes.

Verified: compress through gaps, equal adjacent tiles merge once, edge-first traversal, merged-value scoring, legal directions, game over, no mutation, no random draw on an invalid move, two starting tiles, one spawn after each changed move, 90% 2 / 10% 4, uniform empty-cell selection. The optimized search movement is cross-checked against the game engine too.

Differences are intentional: this app automatically continues beyond the 2048 milestone instead of asking 'Keep going'. Our seeded generator draws position before value; the original unseeded implementation draws value before position. Their distributions match, not their random-number consumption order. An unreachable entirely empty board has no legal slide here; normal games always begin with two tiles.

There is no 256 ceiling. The unchanged heuristic only evaluates the immediate board, has no stochastic search, and rewards any corner rather than preserving one chosen corner. The existing Jev request also supplied only immediate outcomes. These limitations plausibly explain weak play, but the experiment cannot isolate a single causal feature. Losing near 256 is a policy outcome, not a game-over rule.

## Runtime and measurements

The search worker computes one decision at a time. Every returned move is validated by the game engine before application. Restart changes the match generation and ignores stale responses, including worker responses. Pause stops the next turn and lets an already-started turn finish. A completed board freezes while the other continues. Reaching 2048 does not end either board.

Search and heuristic timing is local decision computation. Jev timing includes an API round trip and request preparation. Hardware and network differ, so latency is a user-experience measurement, not an equal-compute benchmark. See `POLICY-RESULTS.md` and raw artifacts for this implementation's complete-game results.
