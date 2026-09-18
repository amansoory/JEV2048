# Deploy Jev Arcade

## Authentication

From PowerShell:

```powershell
cd C:\Users\ArmanM\jev-2048
npx vercel@latest login
```

Complete the browser login, then verify with `npx vercel@latest whoami`. GitHub authentication is not required for direct Vercel CLI deployment. Current CLI dependencies prefer Node 22 or newer.

## Project and required services

1. Run `npx vercel@latest link` and create/select a dedicated **jev-2048** project. The supplied vercel.json selects Next.js.
2. In that project's Vercel Marketplace/Storage settings, attach an Upstash Redis database. Set **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN** to its REST credentials if the integration uses different variable names.
3. In Cloudflare Turnstile, create a Managed widget for the project's production hostname. Add **NEXT_PUBLIC_TURNSTILE_SITE_KEY** and **TURNSTILE_SECRET_KEY** to Vercel.
4. Add **TYPESAFE_API_KEY** from the existing local credential file to Vercel's encrypted server environment variables. Do not paste it into chat or pass it as a command argument. Add **SESSION_SECRET**, a securely generated secret of at least 32 random bytes, through the same environment-variable interface.
5. Enable variables for the intended Vercel environment, then run `npx vercel@latest --prod`. The public Turnstile site key is compiled into the frontend, so redeploy after changing it.
6. On the deployed domain, complete the human check and press Step. Confirm one legal live move and reported probabilities. Preview deployments also need a hostname permitted by Turnstile.

Do not disable the protection checks to get public Jev play working.

## Shared protection

Public decisions require a server-verified Turnstile challenge, checked against the hostname and action, followed by a signed HttpOnly/Secure/SameSite=Strict session cookie. The cookie expires after 12 hours.

One Redis Lua acquisition is atomic across instances and enforces:

- One active decision per verified session, including across board restarts.
- At most eight concurrent provider requests across the deployment.
- At most 600 decisions per IP per minute and 1,200 across the deployment per minute.
- A 25-second lease with owner-checked release. Provider timeout is 15 seconds and SDK retries are disabled.

Limits apply to shared traffic windows, not a game's lifetime. Busy requests return a visible error and Retry. Redis failure refuses the call. Vercel/remote requests cannot use the local process lock as a substitute.

The local loopback development server uses only its process lock and does not require a challenge. This bypass is disabled on Vercel. No persistent gameplay database or user account is needed; current boards are held in the browser, validated by the server, and decisions return without mutating another session's state.

These controls reduce automated abuse and bound concurrency. They are not a hard account spending budget. Configure provider spending alerts and monitor usage before promoting broadly.

Sources: [Vercel login](https://vercel.com/docs/cli/login), [Vercel Marketplace storage](https://vercel.com/docs/marketplace-storage), [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## Verification status

Public requests without shared configuration were tested to fail closed. The real shared Redis and Turnstile deployment remains untested until those account resources are connected. The production Next.js build and local real Jev calls are verified separately.
