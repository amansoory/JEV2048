---
title: Jev 2048 N-tuple Evaluator
emoji: 🧮
colorFrom: green
colorTo: purple
sdk: docker
app_port: 7860
license: mit
---

# Native n-tuple evaluator

Authenticated inference for the Jev 2048 web app. No Jev requests, game loops, spawning, training or search occur here. One persistent process loads the pretrained tables once and returns greedy action values for a supplied board. The browser never calls this service directly.

## Reproducible build

The Dockerfile pins both base images by digest and Debian packages through a dated snapshot. It builds the unchanged verified bridge and upstream source listed in `source-manifest.json`. `verify_source.py` rejects changed source. `model_setup.py` downloads only the author's 4×6 checkpoint, validates both hashes and decompresses it inside the image. Weights are never committed. Startup checks the decompressed hash again.

Upstream: https://github.com/moporgic/TDL2048
Commit: a99f620aec0d30a75943a4c9646743f1f53b0197
License: MIT, Copyright (c) 2021 Hung Guei. See `TDL2048/LICENSE.md`.
This project adds the stdin/stdout bridge and HTTP wrapper; upstream does not contain Jev integration.

Checkpoint: https://moporgic.info/2048/model/4x6patt.w.xz
Compressed: 164,834,696 bytes, SHA-256 `d779836e30da37bb72e83438ad8dedd6fd5358063b48e49509ec336aeb3cc6d9`.
Decompressed: 268,435,545 bytes, SHA-256 `41292737878c8663f5928acf7e44d03036635db9f74db62de950c1e4dc7e141d`.
Hashes were recorded locally during original validation, not supplied by the publisher. The binary contains four little-endian float32 tables of 16,777,216 entries. Complete metadata is in `provenance.json`.

## Hugging Face

1. Create a Docker Space, using CPU hardware. Copy this directory's contents to the Space repository root, including hidden files. Do not upload weights or executable files.
2. In Space Settings, add the runtime secret `NTUPLE_SERVICE_SECRET` (at least 24 characters; use a securely generated secret). Put the same value in Vercel's server-side variable. Never put it in source or a public variable.
3. Push the Space repository. The controlled image build downloads and checks the model. Wait for `/ready` to return HTTP 200 and `status: ready`.
4. Set Vercel `NTUPLE_SERVICE_URL` to the Space's HTTPS `*.hf.space` URL. Keep it server-side.

Use a public Space with the authenticated inference endpoint. A private Space additionally requires Hugging Face access authentication, which this proxy does not implement. Free hardware may sleep; the app exposes a timeout and Retry rather than substituting another policy. No remote Ultra batching is enabled.

## Local Docker validation

From this directory, after supplying `NTUPLE_SERVICE_SECRET` in your shell environment without printing it:

```powershell
docker build -t jev-ntuple:local .
docker run --rm --name jev-ntuple -p 127.0.0.1:7860:7860 --env NTUPLE_SERVICE_SECRET jev-ntuple:local
```

In another terminal with the same secret environment variable:

```powershell
node smoke.mjs
```

The smoke test checks health, readiness, authentication, invalid input and exact action/value parity against three saved fixed-board native fixtures. It runs no games. Set `NTUPLE_TEST_URL` to test another service.

## API and limits

- `GET /health`: process liveness, no credentials or internal paths.
- `GET /ready`: loading, ready or unavailable; HTTP 503 unless ready.
- `POST /v1/evaluate`: Authorization Bearer secret and JSON `{ "board": [16 row-major tile values] }`. Returns legal action values, selected direction, native compute milliseconds, checkpoint and source identity.
- Exactly one board, at most 1,024 request bytes, no extra fields, only zero or powers of two, at least two occupied cells. Duplicate fields, booleans and native rank overflow are rejected.
- At most four admitted inference requests and twelve HTTP handlers. One native computation at a time; queue wait up to one second and computation timeout three seconds. Startup readiness timeout 45 seconds. Native failure is explicit; restart the service to recover.
- Tiles through 32,768 only. If any candidate would create 65,536, reject the board. This preserves the frozen rank-15 bridge instead of silently changing evaluation.
- Shared per-IP/session limits belong to the protected Next.js proxy backed by Upstash. The service semaphore is only per-process concurrency control.

## Operations

Rotate the shared secret in both services together. Roll back to a previously verified Space commit and Vercel deployment together if response schemas change. Stop the Space to disable native inference; the app must then show an error. Do not replace responses with heuristic values.

Official setup: https://huggingface.co/docs/hub/spaces-sdks-docker
