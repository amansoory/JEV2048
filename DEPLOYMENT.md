# Deploy Jev 2048

The web app runs on Vercel. The frozen n-tuple model runs in a separate Linux Docker service. Deploy the model service first. There is no Windows executable or checkpoint in the web deployment. The two original local model and research workspaces remain untouched.

## Current handoff

The application builds locally. The Linux service matches the verified Windows selector on three fixed boards, including candidate values. No new benchmark or provider call was made during release preparation. External deployment is blocked by missing Vercel/Hugging Face authentication and unconfigured shared services. There is no GitHub remote on the local repository. No external resources or production secrets were created.

## 1. Publish the native service

1. Sign in to Hugging Face and create a **Docker Space** on CPU hardware. A public Space works with the application's own authenticated endpoint; private-Space platform authentication is not implemented.
2. Upload the contents of `deploy/ntuple/` to the Space root, preserving `TDL2048/`, `native/`, hidden files, README front matter and the Dockerfile. Do not upload model weights or local executables.
3. Add `NTUPLE_SERVICE_SECRET` through **Settings → Secrets**, using a cryptographically random value of at least 24 characters. This must match Vercel's server variable. Do not print or commit it.
4. Wait for the image build and check `https://YOUR-SPACE.hf.space/ready`. It must return 200 and `status: ready`. Hash mismatch fails the build/startup.
5. Run the fixed-board smoke test from `deploy/ntuple`: set `NTUPLE_TEST_URL` to the HTTPS Space URL and supply `NTUPLE_SERVICE_SECRET` through the environment, then `node smoke.mjs`. It performs no games or Jev requests.

The Dockerfile uses pinned image digests and a dated Debian snapshot. The upstream source, bridge and checkpoint hashes are recorded in the service directory. One persistent worker loads the 4×6 weights once. The native encoding supports tiles through 32,768 and rejects any board whose legal outcomes exceed that. No fallback is allowed. Service sleep can cause the first request to time out; visitors can Retry. Hosted network/wake-up time is not native compute latency. Remote Ultra is disabled; local Ultra is unchanged.

## 2. Configure shared protection

Use an Upstash Redis database shared by every Vercel instance and a Cloudflare Turnstile Managed widget covering the production hostname. Configure these through provider dashboards; choose plans yourself before activation. A preview hostname needs its own allowed Turnstile hostname, too.

Server-only Vercel variables:

| Variable | Value |
| --- | --- |
| TYPESAFE_API_KEY | Existing local Jev credential, transferred privately |
| NTUPLE_SERVICE_URL | HTTPS Space URL, e.g. https://YOUR-SPACE.hf.space |
| NTUPLE_SERVICE_SECRET | Same runtime secret as the Space |
| UPSTASH_REDIS_REST_URL | Shared Redis REST endpoint |
| UPSTASH_REDIS_REST_TOKEN | Shared Redis REST credential |
| SESSION_SECRET | Cryptographically random secret of at least 32 bytes |
| TURNSTILE_SECRET_KEY | Widget's server secret |
| PUBLIC_DAILY_JEV_CALLS | Daily UTC admitted-request budget; suggested 1000, 0 disables Jev; code default 12000 |

The only intentionally public variable is `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Set it before building and redeploy after changing it. Never add `NEXT_PUBLIC_` to any secret.

Public requests require same-origin validation and a signed, 12-hour HttpOnly/Secure/SameSite=Strict session established by server-verified Turnstile. Atomic Redis scripts enforce one active request per session per inference kind, per-board locks, eight active requests per kind across instances, 300 requests/IP/minute, 180/session/minute and 1,200 globally/minute. Leases expire after 60 seconds and release checks ownership. The daily Jev budget counts admitted requests even if they fail. It is a request budget, not an exact currency budget. SDK retries are disabled; explicit client retries are independently admitted and counted.

The hosted UI permits one Jev board at a time. Local comparison can run multiple distinct Jev boards with bounded server concurrency. Redis or protection failures refuse inference. Local loopback development bypasses public budgets; its in-memory locks do not protect a distributed deployment. No per-game cap is imposed locally. Keep provider account spending limits and alerts enabled separately.

## 3. GitHub and Vercel

From PowerShell:

```powershell
cd C:\Users\ArmanM\jev-2048
# Create an empty dedicated repository through GitHub's website first.
git remote add origin https://github.com/YOUR-ACCOUNT/jev-2048.git
git push -u origin HEAD
npx vercel@latest login
npx vercel@latest link
```

Select or create a dedicated `jev-2048` Vercel project using Next.js. Alternatively, import the GitHub repository in the Vercel dashboard. Configure all variables above for the intended deployment environment before deploying. Do not paste credentials into chat or command arguments. Use the dashboard's secret fields or interactive `vercel env add` prompts.

Local checks before release:

```powershell
npm ci
npm run typecheck
npm run test:release
npm run build
npm start
# In a second terminal; fixtures intercept provider requests.
npm run test:release:browser
```

When the Space and shared protection are ready:

```powershell
npx vercel@latest --prod
```

No authenticated CLI session exists on this machine at handoff, so this command has not been run. GitHub authentication is separate from Vercel authentication.

## 4. Release verification

- Confirm Play and Research, the bundled font, mobile layout and Inspect.
- Complete Turnstile. Run one N-tuple Step and check its model/checkpoint identity in Inspect.
- Confirm unauthenticated requests fail and unconfigured/failed Redis never permits inference.
- Verify loading, timeout and Retry after service wake-up.
- Confirm Pause/Restart invalidate pending results and that public Ultra is disabled.
- A real hosted Jev smoke call still needs to be performed after configuring the provider and budget. Do not describe offline fixtures as live Jev results.
- Do not rerun historical studies for deployment verification.

## Data, security and rollback

`.env.local`, generated weights/binaries, screenshots, raw artifacts and build output are ignored. Only sanitized research summaries and their source hashes ship publicly. The diagnostics are frozen single samples, not benchmark averages. Analytics remain in the visitor's browser: 128 detailed records and 2,000 numeric points in memory per board; older moves are archived in IndexedDB until Restart, subject to browser quota. Evidence has a 65,536-character bound. Unknown timing/usage stays unavailable.

To disable public Jev, set the daily budget to 0 and redeploy. To disable n-tuple, pause the Space or unset its URL and redeploy; requests fail explicitly. Roll back Vercel to a previous verified deployment and the Space to its matching source commit. Preserve checkpoint hashes and never replace failed model responses with another bot.

Official references: [Vercel CLI deployment](https://vercel.com/docs/cli/deploy), [Docker Spaces and secrets](https://huggingface.co/docs/hub/spaces-sdks-docker), [Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted).
