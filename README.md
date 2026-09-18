# Jev Arcade

Next.js + React + TypeScript, with locally owned shadcn/ui Button and Radix Tabs, a self-hosted DM Sans font, Motion tile animation, and Recharts.

Local URL: **http://127.0.0.1:2048**

## Run

```powershell
cd C:\Users\ArmanM\jev-2048
npm ci
npm run build
npm start
```

Development: `npm run dev`. The existing ignored `.env.local` already contains the server-only TYPESAFE_API_KEY. On a new checkout, copy `.env.example` and fill its placeholders locally. Never overwrite an existing configured file. Never use NEXT_PUBLIC_ for the API key.

## Play

Choose You vs Jev or Jev vs Heuristic. Arrow keys, direction buttons and swipes control the human board. Step makes one decision; Normal waits 800 ms between responses; Fast has no intentional delay. Pause prevents the next request and allows the current move to finish. Restart resets both boards and ignores pending responses. The request lock stays held until the outstanding request settles.

There is no game move or API-call cap. In a bot match, the surviving bot continues until both boards end. Winner is determined by final score. API errors stop automatic play and offer Retry. A heuristic is never silently substituted for Jev.

Independent copies of the seeded random generator produce the same start. Different choices change empty cells and can produce different spawn positions. Jev decisions need not repeat.

## Inspect decisions

How it works shows each selected move's exact prior board, engine-calculated legal options, Jev's actual choice distribution, and the resulting board with its spawn and score change. The latest 40 decisions are available for replay. Before the first call, a sample is explicitly labeled and has no invented probabilities or timing.

The current Jev policy receives board, score, move number, highest tile, legal directions, and outcome features. Merge metadata now comes directly from the engine. Strategy tuning is outside this redesign. No performance claim is made from the earlier three-seed/eight-turn exploration, which did not preserve the original prompt exactly and cannot establish superiority.

Charts align each player's actual points by move number. No values are carried forward after a player stops. The tooltip and keyboard/touch range inspector expose scores. Missing reported token usage is labeled unavailable.

## Checks

```powershell
npm test
npm run typecheck
npm run build
# Production server must already be running:
npm run test:browser
# Optional: 16 real Jev requests and final screenshots.
$env:LIVE_JEV='1'
npm run test:browser
Remove-Item Env:LIVE_JEV
```

The browser suite uses installed Microsoft Edge. Routine browser tests explicitly stub provider responses. They verify font loading, boards above the fold at 1366×768, keyboard and real touch input, both modes, a complete simulated match, score chart tooltip, sample/live replay consistency, Pause/Restart while a response is pending, Retry, and no overlaps. Live mode makes genuine provider calls.

Before/after desktop and mobile screenshots, explainer screenshots, and real decision evidence are in the ignored `artifacts/` folder. Legacy static UI/server files remain for regression tests; Next.js is the active app.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md). `npx vercel@latest whoami` was checked and requires account login. No public deployment was created.

Public requests fail closed until Redis, Turnstile and the signing secret are configured. This is enforced server-side, including Vercel production and preview environments. The key never goes to the browser.

Remaining deployment checks: live Redis/Turnstile integration and a real move on the deployed domain. Cross-browser coverage beyond Edge and long-running real Jev games are not claimed.
