# Jev 2048

Play 2048 against Jev or compare bots at **http://127.0.0.1:2048/play**. Research explains what was built and what the saved results show.

```powershell
npm ci
npm run dev
```

Keep `TYPESAFE_API_KEY` in ignored `.env.local`. `.env.example` lists fake placeholders. For a production build, use `npm run build` followed by `npm start`.

## Bots and controls

The five current Jev options use the same pinned Jev classifier with different inputs: board and rules, board analysis, expectimax, n-tuple, or both experts. Code generates legal outcomes and randomly labels them before asking Jev to choose. Direction names and specialist recommendations are hidden. Probabilities describe preference among candidates, not win odds. Expectimax and the pretrained n-tuple bot are separate specialist baselines.

You vs Jev offers three opponents. Watch the bots offers input/specialist presets and a custom selector for two to five boards. Historical policies and experiments remain in source and saved results but are not in the main selector.

Run, Pause, Step, Restart, speed and seed controls work independently of any one board finishing. Games continue past 2048 to true game over. Normal and Fast animate; Fast Jev adds no intentional delay, while local animated moves retain their existing 140 ms delay. Local Ultra batches 100 moves for Expectimax/N-tuple and rejects stale batches after Pause/Restart. Remote Ultra is disabled. No silent fallback is used.

The same seed repeats the initial board and spawn stream. Different moves alter the set of empty cells, so later spawn locations can differ. Jev responses are not assumed deterministic.

## Native n-tuple

On this Windows workspace, local inference uses the unchanged sibling `jev-2048-models/matched-evaluation/ntuple-bridge.exe` and verified 4×6 weights. Public inference uses the persistent Linux worker in `deploy/ntuple`, accessed only through the server-side proxy. Neither weights nor binaries belong in Git. Native compute time excludes process communication, network and service wake-up.

The frozen bridge supports ranks through 32,768. If any legal outcome exceeds that representation, n-tuple-dependent bots report an explicit unsupported-board error. The learned evaluation is never replaced or changed to work around it.

## Inspect and match analytics

Inspect records before/after boards, anonymous mappings, supplied evidence, reported probabilities, selected move, agreement, tokens and separated stage timings. It shows observable data, not hidden reasoning. Charts align scores by move number and keep live session data separate from saved studies.

Memory retains 128 detailed moves and 2,000 numeric points per board. Older history is archived in IndexedDB and loaded on demand; Restart deletes the prior board's history. Evidence is bounded to 65,536 serialized characters per move. Storage failure is explicit and never affects gameplay. Deferred specialist audits are asynchronous, with at most three pending; unavailable values remain unknown.

## Verification and deployment

```powershell
npm run typecheck
npm run test:release
npm run build
npm start
# Another terminal; mock Jev/native responses, no paid calls:
npm run test:release:browser
```

Native fixed-board parity has a separate test requiring the sibling Windows model workspace: `node --import tsx --test test/ntuple.test.ts`. The Docker service includes its own fixed-board smoke test. No validation command automatically runs historical studies or full games.

See [DEPLOYMENT.md](DEPLOYMENT.md) for Hugging Face, Vercel, shared rate limits, required secrets and rollback. Public inference fails closed until the shared protection is configured. No external deployment has been performed.

## Research and attribution

`public/research-data.json` contains verified descriptive results and original artifact hashes. `public/diagnostic-warm.json` contains three saved warm diagnostic samples. Neither proves superiority of current Jev variants. Original artifacts and experimental implementations are preserved; no historical study is rerun by the app or build.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [SEARCH-SOLVER.md](SEARCH-SOLVER.md), and historical result documents. The native source is MIT-licensed TDL2048+ by Hung Guei. This project's Jev orchestration and UI are separate from upstream algorithms.
