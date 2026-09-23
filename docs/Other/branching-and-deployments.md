# Branching & Deployments

## The contract

| Branch | Purpose | Vercel |
|---|---|---|
| `development` | All normal ongoing work. Push freely, from any device. | **Preview** deployment per push |
| `main` | Approved Production releases only. Never commit directly. | **Production** deployment per push |

Vercel's Production Branch for project `hnpsystem` is set to `main`. Vercel deploys
*every* other branch it sees as a Preview automatically — no extra config is needed for
`development` to get Preview URLs.

Each push to `development` produces a fresh Preview URL (shown in the Vercel dashboard and
on the GitHub commit/PR). The Production URL only changes when `main` moves.

## Day-to-day (single device)

```bash
npm run git:sync          # checkout development + pull (fails fast if tree is dirty)
# ...work...
git add -A && git commit -m "..."
git push                  # → Preview deployment
```

## Working across multiple devices

Always finish a session by pushing, and always start one by syncing:

```bash
# leaving device A
git add -A && git commit -m "..." && git push

# arriving at device B
npm run git:sync
```

`git:sync` uses `--ff-only`, so if both devices committed it stops rather than creating a
surprise merge. Resolve it deliberately:

```bash
git pull --rebase origin development
```

## Releasing to Production

Once the Preview for `development` has been checked and approved:

```bash
npm run git:release
```

That command:
1. refuses to run with uncommitted changes,
2. fast-forwards local `development` from origin,
3. lists the commits about to go live,
4. checks out `main`, merges `development` with `--no-ff`, pushes,
5. returns you to `development`.

Pushing `main` triggers the Vercel Production build. Nothing else deploys to Production.

If you prefer a review step, open a PR from `development` → `main` on GitHub instead and
merge it there — same result, plus the CI checks run on the PR.

## CI

[.github/workflows/playwright.yml](../.github/workflows/playwright.yml) runs the web and desktop
builds on pushes to `main`, `master` and `development`, and on PRs targeting those branches.
Playwright execution is disabled in GitHub Actions. The legacy `test` job remains as a fast
compatibility check so protected branches still receive the expected status; Playwright can
still be run manually through the package scripts. The workflow keeps its legacy filename, but
appears in GitHub Actions as `Build Checks`.

## Helper scripts

| Script | Does |
|---|---|
| `npm run git:sync` | Get this device onto an up-to-date `development` |
| `npm run git:release` | Merge approved `development` into `main` and push (Production) |

Both live in [tools/scripts/branch-flow.js](../tools/scripts/branch-flow.js).
