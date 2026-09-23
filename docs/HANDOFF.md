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

The immediate engineering problem is the tested site where stock mse-inject.js prevents video playback. Removing the injector restores playback but exposes many fragment-like entries and partial downloads, so permanently disabling MSE interception is not acceptable.

A separate direct-download test currently fails with HTTP 404.

## Next actions

1. Refactor XHR observation in extension/src/mse-inject.ts to preserve native constructor and event-property semantics; prefer minimal open/send observation over replacing window.XMLHttpRequest.
2. Build and have the user re-test the problematic site with the MSE injector enabled. Required first result: playback works.
3. Inspect how fragment URLs are grouped and validate or rework MSE reconstruction so a full stream is downloaded rather than one segment.
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

Manual browser playback/download verification still requires the user's local site test.

## Do not repeat as a fix

Do not permanently remove the MAIN-world MSE script just because playback returns. That was a diagnostic A/B test and it loses the information needed to group or reconstruct MSE media.
