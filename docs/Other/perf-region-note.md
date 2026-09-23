# Function region pin (lhr1)

`vercel.json` now pins Serverless Functions to `lhr1` (London).

**Why.** The Supabase project's pooler endpoint is
`aws-1-eu-west-2.pooler.supabase.com` — the database lives in AWS eu-west-2
(London). `vercel.json` previously carried no `regions` key, so functions ran in
whatever the project/platform default is; Vercel's platform default is `iad1`
(Washington DC).

With functions in `iad1` and the database in `eu-west-2`, every Postgres round
trip crosses the Atlantic: roughly 75–90 ms each way. API routes in this app
commonly issue several sequential queries, so a single request can spend
300–800 ms purely on geography, before any query execution.

**How to confirm the previous setting** (this cannot be read from the repo):
Vercel dashboard → Project → Settings → Functions → Function Region.
If it already said London, this pin is a no-op that documents the requirement.
If it said Washington DC (or anything outside eu-west), this change alone should
be the single largest production latency improvement available.

**Reversal.** Delete the `regions` key.
