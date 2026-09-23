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

PR #22 merged to `main` as `19206681b33e987a1f08ef65ffa087c6264eda4f`. The tested transformed-XHR MSE path now has an explicit clear-fMP4 capture workflow: one reload, post-transform SourceBuffer capture, native ordered per-track spooling, FFmpeg muxing, up to 8× chronological playback acceleration, cancellation/rate restoration, EME/CENC guards, deterministic fragment/session tests, and PR/main CI. User validation passed end-to-end, including output correctness and temporary-file cleanup.

The active compatibility problem is now separate: a direct-download candidate on another tested site returns HTTP 404. The exact cause remains unproven. Current code does not pass saved request context on the direct-download path even though the CoApp downloader supports caller-provided headers; treat that as a hypothesis to test narrowly, not as the established root cause.

## Next actions

1. Verify the post-merge `main` CI for `19206681b33e987a1f08ef65ffa087c6264eda4f`.
2. Investigate the direct-download HTTP 404 from current `main`: inspect candidate provenance, freshness/redirect behavior, and the minimum non-sensitive request context available to the extension/CoApp.
3. If request context is required, design the narrowest safe propagation model; do not copy cookies, authorization tokens, or broad browser headers by default.
4. Keep MSE compatibility evidence-driven and preserve the validated player behavior/DRM boundary.

## Start here

Read:

- extension/src/background.ts around `startDownload()`, direct-download routing, and detected-video metadata;
- extension/src/lib/types.ts;
- coapp/src/downloads.ts;
- coapp/src/native-messaging.ts / RPC boundary;
- docs/EXPERIMENTS.md, especially the direct HTTP 404 entry;
- docs/DECISIONS.md for request-context and MSE constraints.

Verification baseline:

    npm ci
    npm run build
    npm run test:coapp
    npm run package:extension

Browser/player compatibility still requires user manual integration testing. GitHub Actions now provides the standard Windows/Node 22 build/test/package baseline.

## Do not repeat as a fix

Do not permanently remove the MAIN-world MSE script just because playback returns. That was a diagnostic A/B test and it loses the information needed to group or reconstruct MSE media.
