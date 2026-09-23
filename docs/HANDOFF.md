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

PR #15 surfaced the real MSE candidate while preserving playback. Diagnostics #16-#21 then showed that this player transforms opaque XHR data into separate clear audio/video fMP4 SourceBuffers, with no reliable URL replay path and no observed EME/CENC protection. Draft PR #22 (`fix/mse-append-capture`) implements an explicit user-triggered reload/capture/native-spool/mux workflow. First real-site validation confirmed the one-time reload but did not finalize an output; it also exposed a cross-tab popup broadcast bug. User validation confirmed tab scoping. Lifecycle instrumentation then showed the capture stalled at `reload`, before `frame-ready`. The cause was stale pre-reload iframe identity. PR #22 now treats post-reload frames in the selected tab as temporary candidates and locks capture to the first frame that actually emits an MSE media fragment. After fixing the native sparse-array spool bug, user validation succeeded end-to-end: reload, manual playback, fragment capture, mux, and final file creation all worked. The remaining UX limitation is that complete capture depends on the player appending the whole timeline. PR #23 playback-rate acceleration passed real-site validation and has been merged into PR #22's branch: 8× playback engaged during capture, download completed, and the final video was normal. Chronological playback-rate acceleration is now the preferred UX improvement over seek-based acceleration for this transport.

A separate direct-download test currently fails with HTTP 404.

## Next actions

1. Validate temporary-file cleanup after cancel/error/success using only filesystem presence/count checks; do not inspect or log media contents.
2. Add deterministic coverage for native fragment ordering/completeness, session validation, and capture-state helpers, then add a basic PR build workflow.
3. After those checks, review the full PR #22 diff/status and merge to main if clean.
4. Return to the separate direct-download HTTP 404 and determine the minimal safe request context required.

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
