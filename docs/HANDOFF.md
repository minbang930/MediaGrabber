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

The immediate engineering problem is the tested site where stock mse-inject.js prevents video playback. PR #3 merged as `f1b73b9181fb40add46e7f12c10a844972f9c9d9`. User manual validation confirmed normal playback on the previously broken site. Draft PR #4 (`fix/group-mse-fragments`) now adds explicit MSE segment ownership so matching raw MP4/WebM/direct detections can be suppressed. Removing the injector entirely remains diagnostic only because that exposes many fragment-like entries and partial downloads.

A separate direct-download test currently fails with HTTP 404.

## Next actions

1. Build/load `fix/group-mse-fragments` and re-test the same site.
2. Record the popup entry count after several seconds of playback; expected result is that MSE-owned raw fragment entries disappear.
3. If grouping succeeds, inspect the remaining MSE entry and fix full-stream reconstruction/download rather than individual-segment saving.
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
