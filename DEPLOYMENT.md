# Deploy Jev 2048

The web app runs on Vercel. The frozen n-tuple model runs in a separate Linux Docker service. Deploy the model service first, after the no-deployment instruction is lifted. There is no Windows executable or checkpoint in the web deployment. The two original local model and research workspaces remain untouched.

## Current handoff

The application builds locally. The Linux service matches the verified Windows selector on three fixed boards, including candidate values. No new benchmark or provider call was made during release preparation. External deployment is blocked by missing Vercel authentication and Oracle VM access and unconfigured shared services. The GitHub remote is https://github.com/amansoory/JEV2048.git. No external resources or production secrets were created.

## 1. Publish the native service on Oracle Cloud

Use [deploy/ntuple/ORACLE.md](deploy/ntuple/ORACLE.md). It includes the exact A1 Flex size (1 OCPU, 6 GB RAM, 50 GB boot disk), Ubuntu ARM build, firewall ports, persistent systemd worker, Nginx HTTPS and fixed-board smoke test. No Hugging Face service is used.

The service authenticates `Authorization: Bearer <NTUPLE_SERVICE_SECRET>`. Only HTTPS port 443 is exposed for inference; native port 7860 is loopback-only. Original source, greedy selection and checkpoint are unchanged. ARM parity remains a release prerequisite. Local native mode and hosted Ultra restrictions are unchanged.

## 2. Configure shared protection

Use an Upstash Redis database shared by every Vercel instance and a Cloudflare Turnstile Managed widget covering the production hostname. Configure these through provider dashboards; choose plans yourself before activation. A preview hostname needs its own allowed Turnstile hostname, too.

Server-only Vercel variables:

| Variable | Value |
| --- | --- |
| TYPESAFE_API_KEY | Existing local Jev credential, transferred privately |
| NTUPLE_SERVICE_URL | Oracle HTTPS hostname, e.g. https://ntuple.example.com |
| NTUPLE_SERVICE_SECRET | Same secret as /etc/jev-ntuple.env on Oracle |
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
# Only push after deployment is authorized if GitHub auto-deployment is connected.
git push -u origin HEAD:main
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

When the Oracle service and shared protection are ready, and deployment is authorized:

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

To disable public Jev, set the daily budget to 0 and redeploy. To disable n-tuple, stop the Oracle systemd service or unset its URL and redeploy; requests fail explicitly. Roll back Vercel to a previous verified deployment and the Oracle service to its matching source commit. Preserve checkpoint hashes and never replace failed model responses with another bot.

Official references: [Vercel CLI deployment](https://vercel.com/docs/cli/deploy), [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted).
