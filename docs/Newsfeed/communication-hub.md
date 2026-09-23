# News Feed → Dealership Communication Hub

The `/newsfeed` route is no longer a list of announcements. It is the internal
communication hub: targeted posts with priority and categories, read and
acknowledgement tracking, comments, reactions, attachments, links into real DMS
records, saved posts, @mentions, per-user notification preferences, reporting,
and automated posts generated from live dealership activity.

Nothing about the old feed was thrown away — the same `public.news_updates`
table, the same `content_reactions` reactions, the same login warm-cache
hand-off, the same `NewsFeedUi` presentation-layer convention.

---

## 1. Before it works — two manual steps

Both are one-off, and both have to be done by hand in Supabase.

1. **Run the migration.**
   `src/lib/database/schema/news-feed-hub.sql`, in the Supabase SQL editor.
   The file says at the top to run it as four separate executions (the editor
   wraps a paste in one transaction, and section 1 takes an exclusive lock on
   `news_updates` that would otherwise deadlock against the running app). Every
   section is idempotent, so re-running one after a failure is safe.

2. **Create the storage bucket.**
   A **private** bucket named `news-attachments`. No storage policies are
   needed: uploads and downloads both go through the service key, and the only
   way a browser reaches a file is the role-guarded
   `/api/news/attachments/:id` route, which redirects to a 5-minute signed URL.

Until the migration runs, the feed still loads (every new column has a default
that reproduces today's behaviour) but the new tables do not exist, so reads,
acknowledgements, comments and saves will error.

Optionally, add the cron schedule — see §6.

---

## 2. Where everything lives

| Concern | File |
|---|---|
| Vocabulary (priorities, categories, statuses, link types, departments) | `src/lib/news/constants.js` |
| Role permissions | `src/lib/news/permissions.js` |
| Dates, authors, mention tokens, snippets | `src/lib/news/format.js` |
| Notify rule (pure — used in the browser) | `src/lib/news/notify.js` |
| API-route viewer resolution | `src/lib/news/serverViewer.js` |
| Post reads/writes, scheduling, pinning, revisions | `src/lib/database/newsFeed/posts.js` |
| Read / acknowledge / saved | `src/lib/database/newsFeed/engagement.js` |
| Comments | `src/lib/database/newsFeed/comments.js` |
| Attachments (storage + metadata) | `src/lib/database/newsFeed/attachments.js` |
| Links to DMS records | `src/lib/database/newsFeed/links.js` |
| @mentions | `src/lib/database/newsFeed/mentions.js` |
| Notification preferences | `src/lib/database/newsFeed/preferences.js` |
| Reporting | `src/lib/database/newsFeed/analytics.js` |
| News-specific search | `src/lib/database/newsFeed/search.js` |
| Automated posts + daily summary | `src/lib/database/newsFeed/systemPosts.js` |
| Browser API wrapper | `src/lib/api/news.js` |
| Page state + actions | `src/hooks/useNewsFeed.js` |
| Components | `src/components/NewsFeed/*` |
| Styles | `src/styles/families/news.css` (family id `news` in `variants.js`) |
| Page / presentation layer | `src/pages/newsfeed.js`, `src/components/page-ui/newsfeed-ui.js` |

`src/lib/database/newsUpdates.js` still exists and still exports the same
names — `warmNewsUpdatesCache` is what `src/pages/login.js` calls — but its read
path is now `/api/news` rather than a direct Supabase select.

---

## 3. Audience filtering is server-side

The old feed fetched every post and filtered in the browser. It does not any
more: `getFeed()` resolves the viewer's departments from their roles and never
sends a post the viewer is not entitled to read. Every other route
(`/api/news/:id`, its comments, its attachments, search, linked records)
applies the same test, so a targeted post cannot leak through a side door.

An untargeted post, or one targeted at **General**, reaches everyone — which is
how the pre-hub feed behaved, so existing rows keep their meaning.

---

## 4. Permissions

From `src/lib/news/permissions.js`, all derived from `src/lib/auth/roles.js`:

| Capability | Who |
|---|---|
| `canPublish` / `canPin` | All-access, manager-scoped roles, HR core, and anything reading as a manager or director — the same population that had the old "Add Update" button |
| `canTrackAcknowledgements` | Same as publish, plus a post's own author |
| `canViewAnalytics` | All-access, HR core, audit admins, managers/directors |
| `canModerate` (edit/delete anyone's post, delete any comment) | All-access and HR core only |
| Everyone signed in | Read, react, comment, save, acknowledge |

A post's author always keeps edit and delete on their own post. Automated
(`source = 'system'`) posts cannot be hand-edited — they are rewritten by the
job that owns them — but a moderator can delete one that fired wrongly.

---

## 5. Behaviour worth knowing

- **Sort order** is pinned → priority → recency, applied on the server, so the
  order the API returns is the order the feed paints.
- **Opening a post marks it read.** An acknowledgement is separate and always
  deliberate; acknowledging implies a read.
- **Editing the wording of a post that requires acknowledgement clears the
  existing acknowledgements** — a sign-off is against wording, not a row id.
- **Every edit snapshots the previous version** into `news_post_revisions`,
  visible to anyone who can see the post.
- **Scheduled posts** appear as soon as their `publish_at` passes, whether or
  not the cron sweep has run; the sweep just tidies the status column.
- **Expired posts** drop out of the feed immediately and are archived by the
  sweep. They are never deleted, so analytics stay intact.
- **Deletes are soft** (`deleted_at`).
- **Mentions** are stored inline in the body as `@[Name](u:123)` and indexed in
  `news_mentions`. Removing the name from the text removes the mention.
- **Urgent posts always notify**, whatever the reader has muted. That is the
  only preference that cannot be switched off, and the preferences dialog says
  so rather than offering a switch that does nothing.

---

## 6. Automated posts

`/api/cron/news-sweep` (guarded by `CRON_SECRET`, like the other cron routes):

1. publishes scheduled posts whose time has come,
2. archives expired posts,
3. writes the activity/capacity alerts,
4. with `?dailySummary=true`, writes the daily dealership summary.

Suggested schedule:

```
0 * * * *    /api/cron/news-sweep
0 18 * * *   /api/cron/news-sweep?dailySummary=true
```

The alerts read live operational tables — `jobs`, `parts_job_items`,
`vhc_checks`, `deliveries`/`delivery_stops`, `appointments`, `invoices` — and
each is keyed on a UNIQUE `system_key`, so a re-run refreshes the existing post
instead of duplicating it. Current rules and thresholds:

| Post | Fires when | Goes to |
|---|---|---|
| Daily summary | Once a day, on request | General |
| Workshop busy | ≥ 12 appointments on a day in the next 3 | Workshop, Service |
| Parts backlog | ≥ 25 lines awaiting stock | Parts, Service, Workshop |
| VHC backlog | ≥ 20 items pending authorisation | Service, Workshop |
| Busy delivery day | ≥ 10 stops planned today | Parts, Service |

Thresholds are arguments on each function in `systemPosts.js`.

---

## 7. Design system compliance

- Post cards are `<LayerTheme>`; anything nested inside them is
  `<LayerSurface>` — the ladder alternates as it nests (CLAUDE.md §3.0).
- No borders anywhere except `--separating-line` row rules inside the comment
  thread, the acknowledgement tracker and the edit history (§3.0a).
- Priority and state are signalled by a tinted chip **plus a glyph**, never by
  colour alone, so the feed reads correctly in greyscale (§3.0a rule 3).
- Every control is a shared primitive: `Button`, `InputField`,
  `DropdownField` / `MultiSelectDropdown`, `SearchBar`, `TabGroup`,
  `PopupModal`, `EmptyState`, `ReactionBar`, `ReactionSummary`.
- All appearance lives in `src/styles/families/news.css`, registered in
  `src/components/ui/variants.js` as family `news` and imported by
  `families/index.css`. There are no one-off inline visual styles in the new
  files — `npm run check:design` holds them to zero.

`check:borders`, `check:layers`, `check:dropdowns`, `check:text-contrast`,
`check:encoding` and `uk:check` all pass on this work.

---

## 8. Reusable outside the feed

`<NewsLinkedPosts recordType="job_card" recordId={jobNumber} />`
(`src/components/NewsFeed/NewsLinkedPosts.js`) renders "Mentioned in N
announcements" on any DMS record and links each one to
`/newsfeed?post=<id>`, which opens it directly. It renders nothing when there
is nothing linked, so it is safe to mount unconditionally.

**It is not yet mounted on any record page** — where it belongs on the job
card, customer and VHC views is a layout decision, not a technical one.
