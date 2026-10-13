---
name: mlb-dashboard-dev
description: Conventions and step-by-step recipes for building features in the MLB StatCast live dashboard (mlb-platform/frontend — Next.js 14 App Router, Supabase Realtime, Recharts, Tailwind v4, Vitest). Use this whenever adding or changing a dashboard page, widget, metric card, chart, table, realtime feed, Supabase table/column the UI reads, or frontend tests in this repo — even for "small" UI tweaks, since the realtime, hydration, and typing rules here are easy to break silently.
---

# MLB dashboard development

The dashboard shows a live stream of pitches (and derived alerts) written to Supabase by the Python
consumer. Most bugs in this kind of app are invisible in a quick manual check — duplicated WebSocket
channels, hydration mismatches, unbounded state, untyped rows — so this skill encodes the patterns that
prevent them. Follow the recipe that matches the task, then run the checklist at the end.

## Architecture in one screen

```
supabase/migrations/*.sql        ← schema, RLS (anon = read-only), realtime publication  (source of truth)
frontend/lib/types.ts            ← row types mirroring the migration
frontend/lib/<domain>.ts         ← COLUMNS, WINDOW, parseX(row: unknown), mergeX, computeXStats   (pure, tested)
frontend/lib/rows.ts             ← mergeRows: dedupe by unique_id, newest-first by id, capped window
frontend/lib/supabase/server.ts  ← fetchRecentX() for the first render; never throws (returns [])
frontend/lib/supabase/client.ts  ← getBrowserSupabase(): one client per tab
frontend/hooks/use-realtime-inserts.ts
                                 ← the ONLY place that opens channels: unique names, backfill on every
                                   (re)subscribe, rAF burst coalescing, status, cleanup
frontend/components/providers/live-<x>-provider.tsx
                                 ← reducer + context + useLiveX(); mounted once in app/layout.tsx
frontend/components/<widget>.tsx ← presentational: typed props, no data access, easy to test
frontend/components/live*.tsx    ← "use client" connected wrappers: read the hook, render a widget
frontend/app/<route>/page.tsx    ← server components that compose connected widgets
```

Why it is shaped this way:

- **Providers live in the root layout.** Layouts persist across client navigation, so the subscription and
  buffered rows survive page changes, and every widget shares one channel per table. Opening a channel
  per component (the original design) multiplied WebSocket traffic and let widgets disagree.
- **Pages are server components** that only compose. All live numbers (metric cards, header meta) must come
  from the provider — a value computed on the server is frozen at request time while the table beside it keeps
  updating.
- **Presentational vs connected split** keeps widgets testable with plain props and keeps heavy client
  libraries out of pages that don't need them.

## Rules that are easy to break

1. **Rows from Supabase are `unknown` until parsed.** Run SSR results, backfills, and realtime `payload.new`
   through `parseX()` and drop `null`s. Never type a row as `any` or cast it; ESLint fails on `any`.
2. **Lists are newest-first, ordered by `id`** (bigserial insertion order). `created_at` is identical for every
   row in a consumer batch, so it can't order them. Widgets that want chronological order reverse locally.
3. **State is a capped window.** Merge with `mergeRows` (or a `mergeX` built on it) and a `*_WINDOW` constant.
   Return the *same array* when nothing changed so reducers can return the same state and React bails out.
4. **Only `useRealtimeInserts` opens channels.** It already handles StrictMode double-mount (realtime-js
   returns an existing channel for a reused name), backfill after reconnect, burst coalescing (a consumer
   commit can emit 100 INSERTs at once), and teardown. Don't hand-roll `supabase.channel(...)` elsewhere.
5. **Server and client must render identical text.** Format times with `formatPitchTime` (fixed `en-US`,
   `America/New_York`), never `toLocaleTimeString()` or `Date.now()` during render. Use `tabular-nums` and fixed
   widths for numbers/status text that change, so updates don't shift layout.
6. **Keep Recharts out of pages that don't chart.** A `"use client"` module ships whole. Put any widget that
   imports `recharts` in its own connected module (see `components/live-velocity-chart.tsx`). Check the
   First Load JS column in `npm run build` before and after.
7. **Memoize rows and disable chart animation** for streamed data: `memo()` list items keyed by `unique_id`
   (merges keep object identity, so only new rows render) and `isAnimationActive={false}` on series.
8. **Status is real.** Use `<ConnectionBadge />` for anything that says "Live"; never hardcode it.
9. **The browser only has the anon key, which is read-only under RLS.** The UI cannot write. Anything that
   needs a write belongs in the backend.

## Recipe: add a widget or metric for data already in a provider

1. Add any derived numbers to the domain's `computeXStats` in `lib/<domain>.ts` (pure, so it gets a unit test)
   rather than computing inside components. The provider memoizes stats once for all consumers.
2. Build a presentational component with typed props (`readonly Pitch[]`, a stats object, …) and an empty
   state. Accessible names: `role="img"` + `aria-label` for SVG/charts, `role="status"` for live text.
3. Add a thin connected wrapper in `components/live.tsx` (or its own `live-*.tsx` module if it pulls in a
   heavy dependency) that reads `useLiveX()` and renders the component.
4. Use it from a page. For header stats, pass `MetaItem`s / a `LiveMeta`-style component via `PageHeader`'s
   `meta` prop.
5. Test the presentational component with props; test new stats in `lib/*.test.ts`.

## Recipe: add a new realtime table/feed (end to end)

1. **Migration** — add `supabase/migrations/<timestamp>_<name>.sql` (never edit an applied migration):
   `create table if not exists`, `add column if not exists` for upgrades, an index on what you sort by,
   `enable row level security`, a `for select to anon, authenticated using (true)` policy, and add the table
   to the `supabase_realtime` publication with the guarded `do $$ … $$` block used in the init migration.
2. **Types** — add the row type to `lib/types.ts`, matching nullability exactly.
3. **Domain module** — `lib/<domain>.ts` with `X_COLUMNS` (explicit column list, kept in sync with the
   type), `X_WINDOW`, `parseX(row: unknown): X | null` (validate identity fields, coerce numerics, default
   enums), `mergeX` via `mergeRows`, and any stats.
4. **Initial load** — `fetchRecentX()` in `lib/supabase/server.ts`, using the shared `fetchRecent` helper so
   failures log and return `[]` instead of breaking the page.
5. **Provider** — `components/providers/live-x-provider.tsx`: an exported reducer (testable alone), a context,
   `useRealtimeInserts({ table, columns, limit, parse, onRows, onStatus })`, memoized value, and a `useLiveX()`
   that throws a clear error outside the provider. `onRows` receives a `source` ("backfill" | "realtime") —
   use it when the UI must tell genuinely new events apart from catch-up rows (e.g. unread counts).
6. **Layout** — fetch initial rows in `app/layout.tsx` with `Promise.all` alongside the others and nest the
   provider inside the existing ones.
7. **UI** — widgets/pages per the recipe above; add the route to `items` in `components/app-sidebar.tsx`.
8. **Tests** — parsing/stats in `lib/<domain>.test.ts`; provider behaviour with the shared fake client in
   `test/fake-supabase.ts` (see Testing).

If the backend must produce the data too, the Python side lives in `backend/src/mlb_pipeline/`
(`schemas.py` for the contract, `sink.py` for writes) — keep its row model and the TypeScript type aligned.

## Recipe: add a page

Create `app/<route>/page.tsx` as a server component: `<div className="mx-auto flex max-w-350 flex-col gap-6">`,
a `PageHeader` (eyebrow, title, description, `meta`), then sections using the card shell
`rounded-xl border border-border bg-card p-5 shadow-card`. No data fetching in the page — the layout's
providers already hold the data. Add a sidebar entry.

## Styling

Tailwind v4 with theme tokens from `app/globals.css` (`bg-card`, `text-muted-foreground`, `border-border`,
`text-accent`, `shadow-card`, `font-mono-stat`, `gradient-hero`). Prefer tokens over raw colours; the only
raw colours are data encodings (strike `#fb7185`, ball `#60a5fa`, accent series `oklch(0.72 0.16 195)`).
Use canonical utilities (`h-80`, `max-w-85`) instead of arbitrary values when one exists — the editor flags
these. Section labels follow the existing pattern: an `text-[11px] uppercase tracking-wider text-accent`
eyebrow above an `font-display text-xl font-semibold` heading.

## Testing

Vitest + React Testing Library in jsdom; tests sit next to the code as `*.test.ts(x)`; factories in
`test/factories.ts`.

- **Pure logic** (`lib/*`): parse valid/invalid rows, merge order/dedupe/cap/same-array bailout, stats on
  empty and mixed input.
- **Presentational components**: render with props, assert on roles/text, test the empty state.
- **Providers**: mock the browser client with the shared fake and drive it:

```ts
vi.mock("@/lib/supabase/client", async () => {
  const { fakeSupabase } = await import("@/test/fake-supabase");
  return { getBrowserSupabase: () => fakeSupabase.client };
});
// in tests:
act(() => fakeSupabase.channelFor("pitch_alerts").emitStatus("SUBSCRIBED"));
act(() => fakeSupabase.channelFor("pitch_alerts").emitInsert(row));
fakeSupabase.setBackfill("pitch_alerts", [row]);
```

Call `fakeSupabase.reset()` in `beforeEach`. Cover: SSR rows render immediately, backfill on subscribe,
realtime insert, malformed payload ignored, dedupe across backfill + realtime, cleanup on unmount.
Widgets that render `next/link` need `vi.mock("next/link", …)` returning a plain `<a>` in jsdom tests
(see `components/providers/live-alerts-provider.test.tsx`). Worked examples of every pattern above:
`live-pitches-provider.test.tsx` (status, bursts, StrictMode) and `live-alerts-provider.test.tsx`
(realtime-vs-backfill semantics).

## Checklist before calling it done

Run from `frontend/`:

```bash
npm run lint && npm run typecheck && npm run format:check && npm test && npm run build
```

Then confirm:
- No `any`, no unparsed rows, no new `supabase.channel(` outside `hooks/use-realtime-inserts.ts`
  (`grep -rn "\.channel(" app components lib hooks`).
- First Load JS for routes you didn't touch didn't grow (rule 6).
- New tables/columns have a migration, a type, a `*_COLUMNS` entry, and an RLS select policy.
- Anything labelled "live" updates without a reload.
