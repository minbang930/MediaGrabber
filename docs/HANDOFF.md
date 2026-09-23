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

PR #3 fixed the player regression and PR #6 reduced the popup from 14 entries to 1. PR #8 removes the prior terminal `invalid-data` but still produces no usable output. PRs #9-#12 ruled down protected-media and request-context explanations. Closed PR #13 showed the decrypted child segment is probed as `image2`. Draft PR #14 (`diag/hls-candidate-role`) now checks whether the visible HLS is an image playlist and whether another real media candidate is hidden by the duration-first filter.

A separate direct-download test currently fails with HTTP 404.

## Next actions

1. Build/load `diag/hls-candidate-role` (it includes PR #8), reload the page, and play for several seconds.
2. Open the popup; no download attempt is required.
3. Report only the status line shaped like `1 visible / N total · hidden ... · hlsSegments ...`.
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
