# MLB StatCast Platform — Comprehensive Project Audit

> **Date:** 2026-11-10  
> **Branch:** `production-hardening`  
> **Auditor perspective:** Senior Full-Stack Engineer + Software Architect + PM + UX + DevOps

---

## 1. How the Application Works

### Architecture

```
MLB Stats API
    │
    ▼  (HTTP poll, every 5s when live)
producer.py  ──────────────────────────► Redpanda (Kafka)
                                           topic: live-pitches
                                           key: game_id:pitcher_id
simulator.py ──────────────────────────►  (3 partitions, zstd, idempotent)
                                                  │
                                                  ▼
                                         consumer.py
                                           • PitchEvent validation (Pydantic)
                                           • zone classification (zone.py)
                                           • fatigue detection (fatigue.py)
                                           • upsert live_pitches + pitch_alerts
                                           • DLQ for invalid messages
                                                  │
                                                  ▼ (at-least-once, idempotent upsert)
                                         Supabase Postgres
                                           live_pitches       ◄── RLS: anon read-only
                                           pitch_alerts       ◄── RLS: anon read-only
                                                  │
                                                  ▼ (Supabase Realtime WebSocket)
                                         Next.js Dashboard
                                           SSR: initial 50 pitches / 25 alerts
                                           Live: single channel per table, all widgets share it
```

### Technology Stack
- **Backend:** Python 3.12, confluent-kafka, Pydantic v2, pydantic-settings, tenacity, structlog, supabase-py
- **Frontend:** Next.js 14 App Router, TypeScript 5.7, Tailwind CSS v4, Recharts, Supabase Realtime, Vitest + RTL
- **Broker:** Redpanda (Kafka-compatible)
- **Database:** Supabase Postgres with RLS; Realtime publication on both tables
- **Infrastructure:** Docker Compose with multi-stage Dockerfiles, security hardening (read-only containers, capability drop)
- **CI:** GitHub Actions (backend lint/test, frontend lint/type/test/build, Docker image builds)

### Core Features
1. **Live Pitch Feed** — real-time table of the 50 most recent pitches with pitcher, type, velocity, inning, zone classification
2. **Velocity Chart** — streaming area chart of pitch speed over the session
3. **Strike Zone** — SVG scatter plot of recent pitch locations (catcher's view)
4. **Fatigue Alerts** — velocity-drop detection per (game, pitcher, pitch type); alerts streamed to the UI with unread badge
5. **Connection Badge** — real-time WebSocket status indicator shared across all widgets

---

## 2. What the Codebase Gets Right

Before the bugs: several things here are genuinely well-built and should be preserved.

- **Realtime architecture is correct.** One channel per table, opened only in `useRealtimeInserts`, backfill on every reconnect, burst coalescing via `requestAnimationFrame`, StrictMode-safe sequential channel names. This is the hardest part of a realtime dashboard and it's done right.
- **Backend reliability model is solid.** At-least-once delivery, idempotent upserts on `unique_id`, deterministic alert IDs, DLQ for invalid messages, tenacity retries splitting transient vs. permanent errors, heartbeat healthcheck.
- **Parsing is properly defensive.** Both `parsePitch` and `parseAlert` treat every row as `unknown` and coerce/default all fields. No `any` casts. ESLint enforces this.
- **Provider/presentational split is clean.** Pages are server components that compose connected widgets. Heavy client deps (recharts) are isolated in their own module so pages that don't chart don't pay for it.
- **Test coverage is real.** The backend fatigue tests cover all the edge cases (cooldown, replay, game isolation, team filtering, LRU eviction). Frontend provider tests exercise subscribe/backfill/dedupe/StrictMode/unmount.
- **Security basics are present.** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, anon key is read-only under RLS, service role key never touches the browser, `no-new-privileges` and `cap_drop: ALL` in Docker.

---

## 3. Bugs and Verified Issues

### FRONTEND

#### F-1 · Search input is non-functional (confirmed dead UI)
**File:** `frontend/app/layout.tsx:38-43`  
**Issue:** The header search bar is a plain `<input>` with placeholder text but no `onChange`, no routing, no search logic. It renders as an interactive element but does nothing.  
**Impact:** False affordance. Users try to search and nothing happens. Looks unfinished.  
**Fix:** Remove it entirely until search is implemented, or replace with a keyboard shortcut hint (`⌘K`) that opens a future command palette.

#### F-2 · User button is non-functional (confirmed dead UI)
**File:** `frontend/app/layout.tsx:48-50`  
**Issue:** A `<button>` element with a `<User>` icon has no `onClick`, no auth, no settings. It's visually prominent in the top-right corner.  
**Impact:** Same as above — false affordance, looks unpolished.  
**Fix:** Remove until auth is built, or replace with a plain avatar/initials display if branding needs it.

#### F-3 · `helperText` prop is dead code
**File:** `frontend/components/metric-card.tsx:8,16`  
**Issue:** `MetricCard` accepts both `helper` and `helperText` which collapse into the same `displayText` variable. No caller ever passes `helperText`.  
**Impact:** Confusing prop API, unnecessary surface area.  
**Fix:** Delete the `helperText` prop and the fallback assignment `helper || helperText`.

#### F-4 · `delta` prop on MetricCard is never used by any caller
**File:** `frontend/components/metric-card.tsx:12`  
**Issue:** The `delta` prop (and its `ArrowUpRight`/`ArrowDownRight` rendering) is wired up and type-checked, but `OverviewMetrics`, `VelocityMetrics`, and `AlertMetrics` never pass `delta`.  
**Impact:** `ArrowUpRight` and `ArrowDownRight` from lucide-react are imported but never render. Dead bundle weight (minor).  
**Fix:** Either wire `delta` up to real computed values (velocity change vs. previous window, alert count change) or remove the prop.

#### F-5 · "Stream Health" card shows static pipeline metadata, not live health
**File:** `frontend/app/page.tsx:6-11`  
**Issue:** The card lists `Producer → MLB Stats API`, `Broker → Redpanda`, etc. as if reporting live status, but these are hardcoded strings. There is no Kafka consumer lag, no message rate, no last-seen timestamp shown.  
**Impact:** Misleads users into thinking they're seeing real pipeline health when it's decorative. Erodes trust.  
**Fix (minimal):** Rename the section "About This Pipeline" and add a note that it's architectural info, not live status. **Fix (ideal):** Add a `pipeline_health` table or expose consumer lag via a backend API endpoint, then surface real metrics here.

#### F-6 · Hardcoded "TOR" in layout eyebrow and sidebar
**Files:** `frontend/app/page.tsx:18`, `frontend/components/app-sidebar.tsx:69`  
**Issue:** `"Game Day · TOR Live Feed"` in the overview page eyebrow, and `<ConnectionBadge label="TOR" />` in the sidebar footer are hardcoded. If the team changes via `TEAM_ABBREVIATION` env var, the backend will track the new team but the UI will still say "TOR".  
**Impact:** Requires a code change + rebuild to change the team. Technically incorrect if `TEAM_ABBREVIATION ≠ TOR`.  
**Fix:** Expose `NEXT_PUBLIC_TEAM_ABBREVIATION` as a build arg (already a pattern in the project for Supabase keys). Read it in a constants file and reference it everywhere. Add it to `docker-compose.yml` as a build arg alongside the Supabase keys.

#### F-7 · Pitch table column labeled "Result" shows zone evaluation, not pitch result
**File:** `frontend/components/pitch-table.tsx:60`  
**Issue:** The column header says "Result" but displays "IN ZONE" / "OUT OF ZONE" / "Unknown". In baseball, "Result" means the pitch/at-bat outcome (ball, strike, hit). This is a domain terminology error.  
**Impact:** Confusing to any baseball-literate user.  
**Fix:** Rename the column header to "Zone" or "Location".

#### F-8 · Strike zone SVG uses hardcoded light-background colors in a dark-only UI
**File:** `frontend/components/strike-zone.tsx:44`  
**Issue:** `className="block w-full rounded-lg border border-[#dbe8fb] bg-[#f8fbff]"` uses literal light-blue colors while the entire rest of the UI is dark. The app forces `className="dark"` on `<html>`, so there's no light/dark toggle, making this a permanent visual inconsistency.  
**Impact:** The strike zone looks like a foreign white box pasted into a dark dashboard. Jarring visual break.  
**Fix:** Replace with dark-compatible background (`bg-[oklch(0.26_0.03_255)]` or `bg-secondary`) and a matching border. The pitch dots are already color-coded so the visualization won't degrade.

#### F-9 · `font-display` utility is used but not defined
**Files:** `frontend/app/page.tsx:33`, `frontend/components/app-sidebar.tsx:38`, `frontend/components/page-header.tsx:28`, plus others  
**Issue:** `font-display` is used as a Tailwind class (implying a custom `display` font family), but `globals.css` only defines `--font-display` for the shadow variables — there is no `@theme` entry like `--font-family-display: ...`. In Tailwind v4, unrecognized `font-*` utilities silently produce no CSS output.  
**Impact:** Every heading meant to use a display font is instead rendering in the browser's default sans-serif. The brand distinction between body text and headings is lost.  
**Fix:** Add `--font-family-display: "Inter", ui-sans-serif, system-ui, sans-serif` to `@theme inline` in `globals.css`, or pull in a distinct display typeface (e.g. Cal Sans, Plus Jakarta Sans) via Google Fonts and define it there.

#### F-10 · Skeleton components exist but are never used
**File:** `frontend/components/ui/skeleton.tsx` (exists but unused)  
**Issue:** `skeleton.tsx` exports a `Skeleton` component but no widget ever uses it. All loading states use plain text ("Waiting for stream data...", "Waiting for velocity data...").  
**Impact:** No loading skeletons means the UI shows empty-state text before data arrives, which is visually abrupt.  
**Fix:** Add skeleton placeholders to `PitchTable` and `VelocityChart` for the initial SSR→realtime transition, using the existing `Skeleton` component.

#### F-11 · Missing Content-Security-Policy header
**File:** `frontend/next.config.mjs:7-19`  
**Issue:** The app sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` but no `Content-Security-Policy`. The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is embedded in the browser bundle.  
**Impact:** Any XSS vulnerability (injected script, malicious third-party) could read the anon key and exfiltrate all pitch/alert data via the Supabase REST API, since RLS only restricts writes.  
**Fix:** Add a CSP header. At minimum: `default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;`. Adjust for any CDN fonts.

#### F-12 · Velocity chart X-axis shows pitch index, not time or inning
**File:** `frontend/components/velocity-chart.tsx:34`  
**Issue:** The X-axis label is a sequential integer (`idx: points.length + 1`). There's no way to understand temporal context — was pitch #25 in the 1st inning or the 7th? Hovering the tooltip shows the pitch type and pitcher but not the inning or time.  
**Impact:** The chart is harder to interpret without temporal anchors.  
**Fix:** Add `inning` to `ChartPoint` and render inning change markers on the X-axis. Alternatively, use the pitch timestamp formatted as `HH:mm`.

---

### BACKEND

#### B-1 · `sink.recent_pitches` uses `select("*")` for warm start
**File:** `backend/src/mlb_pipeline/sink.py:57`  
**Issue:** The warm-start query fetches all columns from `live_pitches`. The result is then validated through `PitchEvent.model_validate(row)`, which requires specific fields. Using `select("*")` pulls unnecessary columns (`pitcher_first_name`, `pitcher_last_name`, `schema_version`, `zone_eval`, etc.) that add bandwidth.  
**Impact:** Minor inefficiency. At 5,000 rows and ~1KB/row, this adds ~5MB to startup time.  
**Fix:** Replace `select("*")` with an explicit column list matching `PitchEvent`'s required fields.

#### B-2 · Producer dedup state is lost on restart; consumer handles it but Kafka has duplicates
**File:** `backend/src/mlb_pipeline/producer.py:36`  
**Issue:** `LiveGamePoller._published` tracks already-published `unique_id`s in memory. On restart, this state is cleared, so the producer will re-publish pitches already in Kafka. The consumer's idempotent upsert handles this correctly (no DB duplicates), but it creates unnecessary Kafka messages.  
**Impact:** On producer restart mid-game, the existing game's full pitch history is re-published. For a 100-pitch game, that's 100 extra Kafka messages per restart.  
**Fix (minimal):** This is acceptable given the idempotent consumer. Document it as a known behavior in the README.  
**Fix (ideal):** Warm-start the `_published` set from the consumer's Supabase table on startup (similar to `warm_start` in the consumer), or use a Redis set for cross-restart dedup state.

#### B-3 · `max.poll.interval.ms` (600s) may be insufficient under heavy retry load
**File:** `backend/src/mlb_pipeline/kafka.py:40`  
**Issue:** `max.poll.interval.ms=600_000` (10 minutes). The consumer's retry budget for Supabase is 8 attempts with exponential backoff (initial=0.5s, max=30s), which could total up to ~3-4 minutes in the worst case. This fits within 10 minutes, but adds no margin. If the batch size is large and multiple retry loops stack, the consumer could exceed the poll interval and trigger a group rebalance.  
**Impact:** Rebalance mid-batch means the batch is re-processed after restart, which is safe (idempotent) but causes unnecessary double-processing.  
**Fix:** Either increase `max.poll.interval.ms` to 1,800,000 (30 min) with appropriate justification, or reduce retry attempts/max delay, or implement a progress-based heartbeat using the consumer's `poll()` between retry attempts.

#### B-4 · DLQ has no monitoring or alerting
**File:** `backend/src/mlb_pipeline/consumer.py:81-95`  
**Issue:** Invalid messages are forwarded to `live-pitches.dlq` with the validation error in a header. This works correctly, but there's no tooling to alert when the DLQ receives messages. Schema drift or a producer bug could silently accumulate invalid messages.  
**Impact:** A schema version mismatch could go undetected for hours or days.  
**Fix:** Add a DLQ depth check to the CI health check, or add a simple consumer that emits a metric/log when the DLQ has unprocessed messages. Redpanda Console (already in `docker-compose.yml`) shows topic lag visually.

#### B-5 · Fatigue detector's `_Key` includes `game_id` as an integer but Supabase returns strings
**File:** `backend/src/mlb_pipeline/fatigue.py:40`, `backend/src/mlb_pipeline/consumer.py:116-119`  
**Issue:** During `warm_start`, `PitchEvent.model_validate(row)` is called on raw Supabase rows. Supabase returns `game_id` as an integer from a Postgres `integer` column, so this is fine. However, if the schema ever changes the type or Supabase serializes differently, `game_id` type mismatches could cause the warm start to silently skip valid rows (caught by `ValidationError` and `continue`'d).  
**Impact:** Low risk currently, but the silent `continue` on `ValidationError` in `warm_start` means broken rows fail without any log entry.  
**Fix:** Change `except ValidationError: continue` to `except ValidationError as exc: log.warning("warm_start_row_invalid", error=exc.errors(...))`.

---

## 4. Product Evaluation

### What users currently get
A beautiful dark analytics dashboard that shows live pitch data for the Toronto Blue Jays (hardcoded) during games, with velocity trends, strike zone locations, and fatigue alerts. During off-season or non-game hours, the entire dashboard is empty ("Waiting for stream data...").

### Critical product gaps

**No off-season / non-game-time value.** The dashboard is useless when no games are live. This covers ~20 hours per day during the season and the entire off-season. The simulator profile exists but isn't mentioned prominently.

**No pitcher filter.** You can't focus on one pitcher. The velocity chart and strike zone mix all pitchers from the rolling 50-pitch window.

**No historical context.** There's no way to browse past games, compare outings, or see a pitcher's history across the season.

**Single-team, single-team perspective.** The team is hardcoded (even if the env var can change it). There's no multi-team view, no opponent pitching data.

**Static pipeline health card is misleading.** The "Stream Health" section on the overview page reads like live status but is static text.

### Recommended product improvements (realistic, high-value)

| # | Improvement | Value | Complexity |
|---|---|---|---|
| P1 | Expose `TEAM_ABBREVIATION` as a frontend build env var | Removes hardcoded TOR | Low |
| P1 | Pitcher filter on velocity/strike-zone pages | Analyze individual performance | Low |
| P2 | Simulator mode indicator ("DEMO" badge) when game_id=999999 | Transparency | Low |
| P2 | Last-pitch timestamp in page header | Know data is current | Low |
| P2 | Inning markers on velocity chart | Temporal context | Medium |
| P2 | Per-pitcher velocity cards in pitch type breakdown | Pitcher-centric view | Medium |
| P2 | Real pipeline health (last message time, messages/min) | Operational confidence | Medium |
| P3 | Historical game browser (dropdown of past games) | Off-game value | High |
| P3 | Multi-team support | Broader use case | High |
| P3 | Alert email/push notifications | Actionability | High |

### Features that add little value (consider removing/deferring)
- **Search bar (non-functional)** — remove until implemented
- **User button (non-functional)** — remove until auth is implemented  
- **Static pipeline card** — replace with real data or remove

---

## 5. Frontend Design Evaluation

### What works
- Dark theme is cohesive and sports-analytics appropriate
- Card components, metric cards, and typography are consistent
- Alert severity badges (critical/warning/info) are visually distinct and accessible
- `ConnectionBadge` with pulsing dot is an excellent live indicator
- Strike zone visualization (once the background is fixed) is clean

### What needs fixing

**Typography:** `font-display` is used everywhere but never resolves to a real font family (see F-9). Fixing this will immediately improve the visual quality of all headings.

**Pitch table header:** The table is inside a `rounded-xl` card but the table itself has another `rounded-lg border` wrapper — this creates a double-border with redundant shadow on the overview and strike zone pages. Remove the inner `border border-border bg-card shadow-sm` from `PitchTable` since it's already inside a card shell.

**Empty states:** Text-only empty states ("Waiting for stream data...") look fine in context but would benefit from a subtle icon (e.g. `Activity` from lucide-react with a spinner during connecting vs. a static icon when offline).

**Strike zone on mobile:** The strike zone is capped at `max-w-85` which works on mobile, but the grid layout on the strike zone page puts it in a `lg:col-span-2` column. On tablet widths (768px–1024px), both columns collapse and the strike zone gets full width while the pitch table is hidden. Test and confirm the responsive behavior is intentional.

**Velocity page chart:** The chart is inside a card with no title/label. The overview page has an eyebrow ("Velocity Trend") and h2 ("Session Pitch Speed") above the chart. The velocity page just has `<LiveVelocityChart />` inside a card with no label. Add the section header.

---

## 6. Backend and Infrastructure Evaluation

### What is solid
- Multi-stage Dockerfiles (builder + runtime), non-root user, standalone Next.js output
- Docker security hardening: `read_only: true`, `cap_drop: ALL`, `no-new-privileges: true`
- Kafka topic configuration: explicit creation (no auto-create), 3 partitions, key-based ordering per pitcher
- tenacity retry with transient/permanent error split in sink.py
- Structured JSON logging via structlog
- pydantic-settings for type-safe, env-sourced configuration
- Heartbeat file + healthcheck for stuck-loop detection

### What needs attention

**No staging environment.** Docker images are built in CI but `push: false`. There's no deployment target. This is the largest infrastructure gap.

**`heartbeat_path` defaults to `/tmp/mlb-pipeline.heartbeat`.** Docker configures `tmpfs: - /tmp`, which is correct. But `config.py` line 64 hardcodes this path. If the heartbeat file were a named volume or configurable, it would be easier to debug in production. Low priority.

**No log aggregation.** Containers log to stdout in JSON format (great), but there's no log collector (Loki, CloudWatch, Datadog). In production, `docker compose logs` doesn't scale.

**No metrics/APM.** There's no Prometheus exporter, no Grafana, no metrics on consumer lag, messages/sec, or upsert latency.

**Redpanda version is pinned to `v23.3.11` (2024).** This is over a year old. The latest is v24.x. While stability is a valid reason to pin, this should be tracked.

**`docker-compose.yml` has no resource limits.** No CPU/memory limits on any service. In production, an unbounded consumer could starve the redpanda broker.

---

## 7. CI/CD Evaluation

### Current state
The pipeline does:
1. Backend: ruff lint/format + pytest with coverage
2. Frontend: ESLint + TypeScript + Prettier + Vitest + Next.js build
3. Docker: build both images (no push)

### What's missing

#### Critical gaps
1. **No deployment** — images are built and discarded. The pipeline has no staging or production deployment step.
2. **No coverage enforcement** — `pytest --cov` runs but no minimum threshold. `npm test` runs but generates no coverage report.
3. **No dependency vulnerability scanning** — neither `pip-audit` nor `npm audit --audit-level=high` are run.
4. **No secret scanning** — no `git-secrets`, `trufflehog`, or `gitleaks` run.

#### Improvement opportunities
5. **No SAST** — no `bandit` (Python security linter) or `semgrep` rules.
6. **Coverage reports not uploaded** — coverage could be uploaded to Codecov or as a PR comment.
7. **No E2E tests** — no Playwright/Cypress tests that verify the page renders data end-to-end.
8. **No `pip install -e .` in CI** — backend CI runs `pip install -r requirements-dev.txt` but doesn't install the package itself (`pip install -e .`), so it relies on `PYTHONPATH` from pytest.ini. This works but would fail if any import resolution differs from production.

---

## 8. Prioritized Improvement Roadmap

### P0 — Critical (must fix before production)

| # | Issue | Location | Impact | Solution | Complexity | Dependencies |
|---|---|---|---|---|---|---|
| P0-1 | Search bar is non-functional, false affordance | `app/layout.tsx:38` | Breaks user trust | Remove or replace with `⌘K` hint | Low | None |
| P0-2 | User button is non-functional, false affordance | `app/layout.tsx:48` | Breaks user trust | Remove until auth exists | Low | None |
| P0-3 | No Content-Security-Policy header | `next.config.mjs` | XSS → anon key exposure | Add CSP header | Low | None |

### P1 — High (required for production reliability)

| # | Issue | Location | Impact | Solution | Complexity | Dependencies |
|---|---|---|---|---|---|---|
| P1-1 | `font-display` utility undefined — all headings use wrong font | `globals.css` | Brand/quality degradation | Add `--font-family-display` to `@theme` | Low | None |
| P1-2 | "TOR" hardcoded in UI; not driven by env var | `app/page.tsx`, `app-sidebar.tsx` | Config drift when team changes | Add `NEXT_PUBLIC_TEAM_ABBREVIATION` build arg | Low | None |
| P1-3 | Strike zone SVG background is light on dark UI | `strike-zone.tsx:44` | Visual inconsistency | Replace hardcoded light colors with theme tokens | Low | None |
| P1-4 | Pitch table column "Result" is a domain terminology error | `pitch-table.tsx:60` | Misleads baseball users | Rename to "Zone" | Low | None |
| P1-5 | `helperText` dead prop on MetricCard | `metric-card.tsx` | API confusion | Delete prop | Low | None |
| P1-6 | `delta` prop on MetricCard never used | `metric-card.tsx` | Dead bundle code | Wire up or remove | Low | None |
| P1-7 | `warm_start` row failures are silent | `consumer.py:117` | Invisible data issues | Log validation errors | Low | None |
| P1-8 | No coverage thresholds in CI | `ci.yml` | Coverage can silently drop to 0% | Add `--cov-fail-under=75` (backend) + vitest coverage config | Low | None |
| P1-9 | No dependency vulnerability scanning | `ci.yml` | Known CVEs go undetected | Add `pip-audit` and `npm audit --audit-level=high` | Low | None |
| P1-10 | No secret scanning | `ci.yml` | Accidental credential commits | Add `trufflehog` or `gitleaks` | Low | None |

### P2 — Medium (significant quality improvements)

| # | Issue | Location | Impact | Solution | Complexity | Dependencies |
|---|---|---|---|---|---|---|
| P2-1 | Static "Stream Health" card misleads users | `app/page.tsx` | Erodes trust | Rename to "About" or add real metrics | Medium | Backend health API |
| P2-2 | Velocity chart X-axis shows index, not time/inning | `velocity-chart.tsx` | Hard to read temporally | Add inning to data points + axis labels | Low | None |
| P2-3 | Skeleton components exist but unused | UI everywhere | Jarring empty states | Add skeletons to PitchTable/VelocityChart | Low | None |
| P2-4 | No pitcher filter on velocity/strike-zone pages | All pages | Can't analyze individual pitcher | Add filter dropdown reading from live context | Medium | None |
| P2-5 | Velocity page chart section has no title | `app/velocity/page.tsx` | Inconsistent UX | Add eyebrow + heading above chart | Low | None |
| P2-6 | No deployment in CI/CD | `ci.yml` | Zero automation beyond build | Add staging deploy to Fly.io or Render | Medium | Deployment target choice |
| P2-7 | No log aggregation | Infrastructure | Can't debug production | Add log driver to docker-compose (Loki or CloudWatch) | Medium | Deployment target |
| P2-8 | No resource limits in docker-compose | `docker-compose.yml` | Unbounded resource usage | Add `deploy.resources.limits` per service | Low | None |
| P2-9 | `select("*")` in warm start | `sink.py:57` | Unnecessary bandwidth on restart | Explicit column list | Low | None |
| P2-10 | DLQ has no monitoring | Consumer/infra | Schema drift goes undetected | DLQ depth alert or dashboard widget | Medium | None |
| P2-11 | Double-border on pitch table (card inside card) | `pitch-table.tsx`, pages | Minor visual regression | Remove inner border from PitchTable | Low | None |
| P2-12 | Simulator mode has no indicator in UI | UI | Users see "game data" that is synthetic | Add "DEMO" badge when `game_id=999999` | Low | None |

### P3 — Low (nice-to-have)

| # | Issue | Location | Impact | Solution | Complexity | Dependencies |
|---|---|---|---|---|---|---|
| P3-1 | No favicon or og:image | `app/layout.tsx` | Poor sharing/tab appearance | Add SVG favicon + og:image | Low | None |
| P3-2 | Producer in-memory dedup lost on restart | `producer.py` | Kafka gets duplicates (safe but wasteful) | Document behavior or warm-start from Supabase | Medium | None |
| P3-3 | Alert window (25) may be small for high-alert sessions | `alerts.ts` | Recent alerts disappear | Make window configurable or increase to 50 | Low | None |
| P3-4 | No `max.poll.interval.ms` margin for heavy retry load | `kafka.py` | Rebalance under extreme Supabase latency | Increase to 30 min or add consumer heartbeat | Low | None |
| P3-5 | No E2E tests | Testing | Manual verification required | Add Playwright smoke test | High | Deployment target |
| P3-6 | Redpanda version pinned to v23.3 (2024) | `docker-compose.yml` | Missing security patches | Evaluate upgrade to v24.x | Medium | None |
| P3-7 | Historical game browser | Product | Zero off-game value | Past games stored in DB; add browse page | High | P2-6 |
| P3-8 | Pitcher alert notifications (email/push) | Product | Alerts aren't actionable remotely | Supabase Edge Function + Resend | High | P2-6 |

---

## 9. Proposed CI/CD Pipeline Architecture

The goal: every push to a feature branch runs quality gates, every merge to `main` deploys to staging, and production promotes from staging with a manual approval.

```
┌─────────────────────────────────────────────────────────────────┐
│  PR / feature branch push                                        │
│                                                                  │
│  ┌─────────────┐  ┌─────────────────────┐  ┌─────────────────┐  │
│  │  backend    │  │  frontend           │  │  security       │  │
│  │  ─────────  │  │  ─────────────────  │  │  ─────────────  │  │
│  │  ruff lint  │  │  eslint             │  │  pip-audit      │  │
│  │  ruff fmt   │  │  tsc --noEmit       │  │  npm audit      │  │
│  │  pytest     │  │  prettier --check   │  │  trufflehog     │  │
│  │  --cov-min  │  │  vitest --coverage  │  │  bandit         │  │
│  │  75%        │  │  --reporter=lcov    │  │                 │  │
│  └──────┬──────┘  └──────────┬──────────┘  └────────┬────────┘  │
│         └──────────────────── ▼ ───────────────────┘             │
│                        ┌──────────────┐                          │
│                        │ Docker build │ (backend + frontend)      │
│                        │ push: false  │                          │
│                        └──────────────┘                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  main branch merge                                               │
│                                                                  │
│  All PR checks passed →                                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Build + push Docker images to registry (GHCR)          │    │
│  │  Tag: sha-{git_sha}                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Deploy to staging (Fly.io or Render)                   │    │
│  │  • Frontend: fly deploy --image mlb-frontend:sha-...    │    │
│  │  • Consumer: fly deploy --image mlb-pipeline:sha-...    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Post-deploy health check (curl /api/health or verify   │    │
│  │  Supabase Realtime connection)                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Manual approval gate (GitHub environment protection)   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Deploy to production (same image, prod secrets)        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Recommended deployment target:** Fly.io
- Supports Docker images natively, persistent volumes for Redpanda, internal networking between services
- Cheap for a small app (~$10-20/month for all services)
- Rollback is `fly deploy --image mlb-pipeline:previous-sha`
- Alternative: Render (simpler setup but less control over networking), Railway, or DigitalOcean App Platform

**Key additions to `ci.yml`:**

```yaml
# In the backend job:
- run: pytest --cov --cov-fail-under=75

# New security job:
security:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with: { fetch-depth: 0 }
    - run: pip install pip-audit && pip-audit -r backend/requirements.txt
    - run: cd frontend && npm audit --audit-level=high
    - uses: trufflesecurity/trufflehog@main
      with: { path: ".", base: main }

# New staging deploy job (after images):
deploy-staging:
  needs: [images]
  if: github.ref == 'refs/heads/main'
  environment: staging
  steps:
    - uses: superfly/flyctl-actions/setup-flyctl@master
    - run: fly deploy --image ghcr.io/${{ github.repository }}/mlb-frontend:${{ github.sha }}
      env: { FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }} }
```

---

## 10. Proposed Implementation Sequence

### Milestone 1: Quality & Correctness (1-2 days) — no new features, all P0/P1 fixes
1. Remove non-functional search bar and user button (F-1, F-2)
2. Add Content-Security-Policy header (F-11)
3. Fix `font-display` typography (F-9)
4. Fix strike zone dark background (F-8)
5. Rename "Result" column to "Zone" (F-7)
6. Remove `helperText` dead prop (F-3)
7. Expose team abbreviation via `NEXT_PUBLIC_TEAM_ABBREVIATION` (F-6)
8. Log validation errors in `warm_start` (B-5)
9. Add `--cov-fail-under=75` to CI backend job (P1-8)

### Milestone 2: CI/CD Foundation (2-3 days)
1. Add `pip-audit` + `npm audit` to CI security job
2. Add `trufflehog` secret scanning
3. Add frontend Vitest coverage reporting (`--reporter=lcov`)
4. Add Docker image push to GitHub Container Registry
5. Choose deployment target (Fly.io recommended) and deploy staging
6. Add post-deploy health check
7. Add `deploy-production` job with environment protection

### Milestone 3: Product Polish (2-3 days)
1. Add pitcher filter dropdown on velocity and strike-zone pages
2. Add inning markers to velocity chart
3. Use Skeleton components for loading states
4. Replace static "Stream Health" card with actual last-message timestamp
5. Add "DEMO" badge when simulator data is detected
6. Fix velocity page missing chart section heading
7. Add CSP header

### Milestone 4: Operational Maturity (3-5 days)
1. Add Docker resource limits to `docker-compose.yml`
2. Add log aggregation (Loki stack or CloudWatch)
3. Add DLQ depth monitoring
4. Explicit column list in `warm_start` Supabase query
5. Consider Playwright E2E smoke test

### Milestone 5: Product Expansion (1-2 weeks, after milestone 2+3)
1. Historical game browser
2. Multi-team support
3. Alert notifications (Supabase Edge Function + Resend email)
4. Pitcher detail page (per-pitcher charts, velocity trends per pitch type)

---

## 11. Summary Assessment

**Current state:** This is a well-architected, technically solid project that is **not yet production-ready** due to a mix of broken UI elements, missing security hardening, and a CI pipeline that stops at "build" rather than "deploy."

The core realtime architecture (provider pattern, channel management, idempotent backend) is production-quality and should not be changed. The bugs are fixable in days.

**The biggest gap is the CI/CD pipeline** — the project has all the right tests but no deployment automation. Closing this gap (Milestone 2) is the highest-leverage work.

**The second-biggest gap is product clarity** — the non-functional search bar and user button, the misleading "Stream Health" card, and the broken `font-display` utility all create an impression of incompleteness that undercuts the genuinely good work in the realtime engine.

**Recommended first action:** Complete Milestone 1 (the small code fixes, 1-2 days), then proceed to Milestone 2 (CI/CD deployment, 2-3 days). The project will be production-deployable after those two milestones.
