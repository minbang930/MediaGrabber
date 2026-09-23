# Handoff

Last updated: 2026-09-24

## Just completed

- Workspace bootstrap merged through PR #1. Bootstrap merge commit: 0c58e0f7b891af62e1bb63ed946001f4ca0a0dfc.

- Initialized the fork as a long-term ChatGPT/Codex workspace.
- Replaced stale top-level agent guidance with repository-first operating instructions.
- Added current project, state, architecture, decision, roadmap, experiment, and working-style documents.
- Preserved inherited Video DownloadHelper research docs as reference rather than treating them as current implementation docs.
- Recorded the two current real-world compatibility failures without inventing site details.

## Current focus

PR #3 fixed the player regression. PR #6 merged as `2bfc0884d8380fd31f9ed97310da3de39f5f0b45` and reduced the popup from 14 entries to 1. PR #8 removes the prior terminal `invalid-data` but still produces no stream. Closed PR #9 identified ordinary HLS v6 media structure with AES-128/identity and 1118 nonstandard-extension segments. Branch `diag/hls-browser-responses` now compares browser-observed segment/key response metadata.

A separate direct-download test currently fails with HTTP 404.

## Next actions

1. Build/load `diag/hls-browser-responses` (it includes PR #8), reload the page, and play from the beginning for several seconds.
2. Retry the single HLS entry.
3. Report only the appended `Browser HLS responses:` line; do not share signed URLs, cookies, authorization headers, or key data.
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
