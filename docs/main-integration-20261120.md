# main integration — 2026-11-20

Dedicated worktree: C:/Users/kouse/stagelink-message-port-20261117
Branch: port/message-improvements-20261117
Integrated main: f3abe363f24811c2a1ed7c2eddb1b73841b5a764 (origin fetched 2026-11-20).
Preserved previous HEAD: 5595f88; backup/message-port-before-main-20261120.
Working tree was clean before integration. Existing backup worktree was not modified.

## Resolution and scope

Four textual conflicts in Participant.html were resolved locally, without replacing the file:
- Keep main's mp-inbox layout and its single dashboard-inbox. Add dashboard-sent inside that section.
- Keep main's buildInboxItem return value and shared pending/all-request rendering; attach decline reason there. Render outgoing reasons in renderMyPage before existing LINE card rendering.
- Combine chat cache/UI clearing with main's stopNotificationPolling on logout.
- Preserve session/revision checks on read completion and main's updateBadges.

Main's performance summaries, guide tracking, notification toast logic, authentication, LINE linking, notification transport and deep links are retained. No duplicate inbox or notification implementation was added. Main's per-performance outgoing statistics stay intact; the outgoing reasons list covers all requests rather than a performance reporting window. No unresolved product-specification conflict was identified.

An additional integration regression exposed an old notification poll initializing the next login's notification baseline. pollNotifications now captures the message session/user and discards that continuation after a login change (three added lines).

## Verification

node --test --test-reporter=spec tests/search.test.cjs tests/messages.test.cjs
35 passed, 0 failed, 0 skipped: existing 30 plus 5 integration cases.
Added cases: unique dashboard targets/main sections; read badges and logout cleanup; shared paginated fetch between chat and notification polling; stale poll after login switch; unchanged main performance/guide functions.
Notification/authentication/deep-link preservation comparisons now use the integrated main SHA above.
JavaScript/inline-handler syntax and offline preview isolation are included. git diff --check passed with core.whitespace=cr-at-eol.
No real Supabase/GAS/LINE request or migration was executed. Browser visual/keyboard testing remains unverified.

## Push / PR gate — BLOCKED

No repository workflow or Vercel/Netlify deployment configuration was found in main. That does not establish absence of external integrations.
GitHub CLI is unauthenticated: Pages and hooks queries could not run.
The connected GitHub app reports push permission but admin=false and maintain=false; its available fetch tool excludes Pages/hooks administration endpoints.
Therefore Pages source, webhooks, installed deployment integrations and PR preview triggers are unverified. Per user instruction, no push or PR creation was attempted.
git ls-remote --heads origin port/message-improvements-20261117 returned no matching branch at inspection time. Re-fetch and recheck remote history before any future normal push.
Intended remote: origin, https://github.com/yagukou/stagelink-2026.com.git
Intended head: port/message-improvements-20261117; base: main; draft only.

## Required PR disclosure / remaining risks

DB migration supabase/migrations/20261117_request_decline_reason.sql is NOT applied. Decline persistence will fail without the column. Actual schema/constraint duplication, RLS, historical rows and staging migration behavior remain unverified.
Real LINE delivery, linking and notification deep links, GAS behavior, multi-device operation and browser layout/focus are unverified. Tests validate mocked calls and code preservation, not delivery.
Existing direct-password/localStorage authentication remains unchanged; participant query filtering is not authorization.
Full participant history polling retains its existing load and concurrent-pagination limitations. Main's request-fetch lifecycle has not been redesigned.
No direct main push, force push, PR merge, production DB change or deployment was performed.
