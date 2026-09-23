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

PR #3 merged and user validation confirmed normal playback on the previously broken site. Follow-up diagnostics traced the 14 popup entries to 12 top-frame extensionless HTTPS `<source>` descendants, 1 subframe blob currentSrc, and 1 HLS response. Diagnostic PRs #4 and #5 were closed without merge. PR #6 merged as `2bfc0884d8380fd31f9ed97310da3de39f5f0b45`; user validation confirmed the popup dropped from 14 entries to 1. Branch `diag/hls-ffmpeg-open` now classifies the remaining HLS FFmpeg failure without exposing media URLs or credentials.

A separate direct-download test currently fails with HTTP 404.

## Next actions

1. Build/load `diag/hls-ffmpeg-open` and retry the single remaining HLS entry.
2. Record only the appended `HLS diagnostic:` line; no URL or browser request data is needed.
3. Use the diagnostic to distinguish playlist/segment access from relay-rewrite failure before changing download logic.
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
