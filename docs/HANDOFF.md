# Handoff

Last updated: 2026-09-23

## Just completed

- Workspace bootstrap merged through PR #1. Bootstrap merge commit: 0c58e0f7b891af62e1bb63ed946001f4ca0a0dfc.

- Initialized the fork as a long-term ChatGPT/Codex workspace.
- Replaced stale top-level agent guidance with repository-first operating instructions.
- Added current project, state, architecture, decision, roadmap, experiment, and working-style documents.
- Preserved inherited Video DownloadHelper research docs as reference rather than treating them as current implementation docs.
- Recorded the two current real-world compatibility failures without inventing site details.

## Current focus

PR #3 merged and user validation confirmed normal playback on the previously broken site. Follow-up diagnostics traced the 14 popup entries to 12 top-frame extensionless HTTPS `<source>` descendants, 1 subframe blob currentSrc, and 1 HLS response. Diagnostic PRs #4 and #5 were closed without merge. Branch `fix/filter-dom-source-noise` now applies the narrow DOM filtering correction.

A separate direct-download test currently fails with HTTP 404.

## Next actions

1. Build/load `fix/filter-dom-source-noise` and confirm playback remains normal.
2. After several seconds of playback, record the popup media count. Expected: the 12 mutation-observed extensionless `<source>` entries and the blob direct entry are gone or substantially reduced.
3. Test the remaining HLS/MSE candidate for full-video download; only then change reconstruction logic if needed.
4. Reproduce the direct-download 404 with request-context diagnostics and decide what safe Referer/Origin/header support should be propagated to CoApp.
5. Add at least a basic PR build workflow and unit coverage for deterministic parsing and argument-building logic once compatibility work stabilizes.

## Start here

Read:

- extension/src/mse-inject.ts
- extension/src/content.ts
- extension/src/background.ts around startDownload(), HLS rewriting, and direct download
- coapp/src/downloads.ts
- docs/EXPERIMENTS.md

Verification baseline:

    npm ci
    npm run build

Manual browser playback/download verification still requires the user's local site test. The agent environment could not clone from GitHub for a full build because outbound DNS was unavailable; the changed XHR hook itself passed a standalone TypeScript DOM type-check.

## Do not repeat as a fix

Do not permanently remove the MAIN-world MSE script just because playback returns. That was a diagnostic A/B test and it loses the information needed to group or reconstruct MSE media.
