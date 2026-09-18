# Oracle-hosted n-tuple evaluator

Deployment package for [amansoory/JEV2048](https://github.com/amansoory/JEV2048). The app stays on Vercel; this service runs on an Oracle Cloud VM. No Hugging Face account or deployment is used. See [ORACLE.md](ORACLE.md) for the exact VM, firewall, build, systemd, HTTPS and Vercel steps.

One persistent native process loads the unchanged pretrained 4×6 tables once. The service returns greedy moves and legal candidate values only. Game rules, spawning, seed state and scoring remain owned by the app. No games, training, Jev calls or alternative-policy fallback occur here.

## API

- `GET /health`: HTTP process liveness.
- `GET /ready`: HTTP 200 only after the checkpoint is verified and the worker is loaded; 503 while loading/unavailable.
- `POST /v1/evaluate`: `Authorization: Bearer <NTUPLE_SERVICE_SECRET>` and exactly `{ "board": [16 row-major tile values] }`. Returns `direction`, legal `options` with value/reward/afterstate, `compute_ms`, `model`, `checkpoint` and `source_commit`.

Exactly one 16-cell board, at least two occupied cells, zero or integer powers of two through 32,768. Extra/duplicate fields, booleans, floats, oversized bodies and any move producing 65,536 are rejected. Inputs cannot specify paths, commands or executable arguments.

Request body limit: 1,024 bytes. HTTP socket timeout: 5 seconds. At most 12 HTTP handlers and 4 admitted inference requests. One native computation at a time, with a 1-second queue wait and 3-second response timeout. The Vercel proxy times out after 12 seconds and validates returned actions and values. systemd restarts the service on worker failure; it never substitutes another bot.

`BIND_HOST` defaults to loopback and `PORT` to 7860. The Dockerfile explicitly binds inside the container; publish only to host loopback. Public access goes through HTTPS Nginx, never an exposed 7860 port. The proxy already keeps `NTUPLE_SERVICE_URL` and `NTUPLE_SERVICE_SECRET` server-side and uses the existing shared Upstash protection. Local Windows native inference remains unchanged when the URL is unset.

## Source and checkpoint

Upstream: https://github.com/moporgic/TDL2048
Commit: `a99f620aec0d30a75943a4c9646743f1f53b0197`.
MIT, Copyright (c) 2021 Hung Guei; full license: `TDL2048/LICENSE.md`.
`source-manifest.json` fixes the upstream and bridge bytes. `verify_source.py` rejects changes. This project adds the protocol/HTTP wrapper; upstream has no Jev integration.

Author URL: https://moporgic.info/2048/model/4x6patt.w.xz
- Compressed: 164,834,696 bytes; SHA-256 `d779836e30da37bb72e83438ad8dedd6fd5358063b48e49509ec336aeb3cc6d9`.
- Decompressed: 268,435,545 bytes; SHA-256 `41292737878c8663f5928acf7e44d03036635db9f74db62de950c1e4dc7e141d`.

Hashes were locally recorded during original validation, not published by the author. The format is four little-endian float32 tables of 16,777,216 entries. Setup verifies both sizes/hashes and installs atomically. Existing valid weights are reused; corruption fails closed. Startup verifies the decompressed checkpoint again. Weights, executables and environment files are ignored by Git.

## Validation

`python3 -m unittest test_server.py` uses offline fixtures. Once the service is ready, `python3 smoke.py` compares three saved fixed boards, without playing games. Supply the service secret via environment and optionally `NTUPLE_TEST_URL` for HTTPS.

The existing pinned Dockerfile is an **amd64** alternative, previously checked against the Windows native selector. Do not run that image under ARM emulation on the Oracle A1. Use `build-linux.sh` on A1, then require the fixed-board smoke test to pass. Actual Oracle ARM compilation/runtime remains unverified until a VM is available. The original engine and weights are not ported or changed.

Optional amd64 Docker commands (with the secret already in the environment):

```sh
docker build -t jev-ntuple:local .
docker run --rm --name jev-ntuple -p 127.0.0.1:7860:7860 --env NTUPLE_SERVICE_SECRET jev-ntuple:local
```

Native compute time excludes communication and network time. Hosted Ultra remains disabled. The frozen rank limit remains explicit; reaching it is not falsely reported as game over.
