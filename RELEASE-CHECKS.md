# Release preparation checks

Verified locally on 2026-09-18. No new Jev calls, complete games, rollout analysis, scientific benchmarks or external deployment were performed.

## Passed

- TypeScript check and production Next.js build.
- Clean source snapshot build without `.env.local`, ignored artifacts or sibling native model files. A Windows directory-junction build attempt initially failed because Turbopack disallows links outside its root; repeating with an ordinary dependency directory succeeded.
- Removed an unused historical credential-loader dependency from the web route. Token parsing is parity-tested against the unchanged legacy helper. No server trace in the final clean build includes `.env.local`.
- 56 distinct focused TypeScript/JavaScript tests across analytics, request parity, blinded construction, selector, hosted/native adapter, Ultra and match lifecycle. Provider responses were mocked. Native parity uses only fixed boards. One Ultra test checks a bounded 100-move segment, not a full game.
- Three Python native-service validation tests and source-manifest integrity verification.
- Pinned Docker image build, health/readiness, authentication and malformed/overflow board rejection.
- Exact Linux-container versus verified Windows-native move and candidate-value parity on three fixed boards. Production Next.js proxy also matches those fixtures and preserves generation/sequence IDs.
- Desktop/mobile Play and Research smoke checks on the production build. Five-board layout, presets, keyboard/touch controls, Step/Pause/Restart, stale responses, Inspect navigation/timing/evidence, charts, error state, reduced motion and no horizontal overflow. All Jev requests were intercepted with explicit test fixtures.
- Separate browser check for local Ultra controls, independent fixture batches, Pause and Restart.
- Bundled font loading, saved-data chart rendering and visible-copy checks.
- Exact local credential values absent from candidate Git files and browser bundles. No checkpoint, executable, oversized binary or environment file is included in Git.
- All 20 source references in the public historical summaries match the original saved SHA-256 hashes.

Screenshots are retained locally under `artifacts/ready-*`, including full-page desktop/mobile Play and Research, Inspect, and an error state. They use fixture moves, not newly measured Jev results.

## Remaining external checks

- Authenticate Vercel and Hugging Face and configure a dedicated GitHub remote.
- Publish the Docker Space, configure the matching server-to-server secret, and connect its URL.
- Configure shared Upstash, Turnstile, signed-session secret and daily Jev request budget.
- Test actual distributed rate limits, hosted sleep/wake behavior and a live hosted Jev move after those services are configured. Local fixtures cannot verify them.

See DEPLOYMENT.md for exact setup, deployment and rollback steps. The public demo must not bypass protection to work around missing configuration. No claim is made that current Jev variants outperform either specialist. The added three-seed move-500 result is a post-hoc legacy snapshot, not a new complete-game benchmark.
