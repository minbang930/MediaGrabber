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

PR #15 surfaced the real MSE candidate while preserving playback. Diagnostics #16-#21 then showed that this player transforms opaque XHR data into separate clear audio/video fMP4 SourceBuffers, with no reliable URL replay path and no observed EME/CENC protection. Draft PR #22 (`fix/mse-append-capture`) implements an explicit user-triggered reload/capture/native-spool/mux workflow. It is not merged; full build and real-site validation are pending.

A separate direct-download test currently fails with HTTP 404.

## Next actions

1. Build the extension and the modified CoApp from `fix/mse-append-capture`; install the branch CoApp binary because the previously installed release CoApp does not contain the new capture RPC.
2. Load/reload the branch extension, open the tested page, and confirm ordinary playback remains normal before starting a download.
3. Select the MSE item and press Download. The tab should reload once; start playback from the beginning and let it run until the media/source ends.
4. Verify that the Downloads output is a complete playable file with both video and audio. If it fails, record only the visible MediaGrabber error; do not expose page request credentials or source URLs.
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
