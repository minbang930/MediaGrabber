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

PR #15 surfaced the real MSE candidate while preserving playback. Diagnostics #16-#21 then showed that this player transforms opaque XHR data into separate clear audio/video fMP4 SourceBuffers, with no reliable URL replay path and no observed EME/CENC protection. Draft PR #22 (`fix/mse-append-capture`) implements an explicit user-triggered reload/capture/native-spool/mux workflow. First real-site validation confirmed the one-time reload but did not finalize an output; it also exposed a cross-tab popup broadcast bug. Follow-up fixes for tab scoping, captured-MediaSource finalization, cross-world byte views, and capture progress are now on the PR and need a second manual validation.

A separate direct-download test currently fails with HTTP 404.

## Next actions

1. Pull/rebuild the latest `fix/mse-append-capture` extension. The CoApp capture RPC did not change in the follow-up, so reinstalling the branch CoApp is unnecessary if the previous PR #22 CoApp binary is already installed.
2. Reload the extension and confirm the popup no longer cycles through media from other tabs.
3. Select the MSE item and press Download. The tab should reload once; manual playback after reload is expected. Start from the beginning and let it run until the media/source ends.
4. Watch the popup status: it should show `Capturing… <size> · <fragments> fragments`, then `Capture complete — finalizing MP4…`. Report the last visible phase if it stops progressing.
5. Verify that the Downloads output is a complete playable file with both video and audio. If it fails, report only the visible MediaGrabber error/status; do not expose request credentials or source URLs.
4. Reproduce the direct-download 404 with request-context diagnostics and decide what safe Referer/Origin/header support should be propagated to CoApp.
5. Add at least a basic PR build workflow and unit coverage for deterministic parsing and argument-building logic once compatibility work stabilizes.

## Start here

Read:

- extension/src/mse-inject.ts
- extension/src/content.ts
- extension/src/background.ts around startDownload(), HLS rewriting, and direct download
- coapp/src/mse-capture.ts
- coapp/src/converter.ts
- docs/EXPERIMENTS.md

Verification baseline:

    npm ci
    npm run build

Manual browser playback/download verification still requires the user's local site test. The agent environment could not clone from GitHub for a full build because outbound DNS was unavailable; the changed XHR hook itself passed a standalone TypeScript DOM type-check.

## Do not repeat as a fix

Do not permanently remove the MAIN-world MSE script just because playback returns. That was a diagnostic A/B test and it loses the information needed to group or reconstruct MSE media.
