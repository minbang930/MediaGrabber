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

The merged MSE workflow is functional, but background/occluded playback remains the current UX experiment. PR #25 (detached normal window) was closed without merge because capture stopped when another maximized window fully covered it, while partial visibility resumed progress. Branch `exp/mse-pip-capture` now tests standard video Picture-in-Picture triggered by the user's post-reload Play click; it does not spoof Page Visibility or override site PiP restrictions.

The separate direct-download candidate on another tested site still returns HTTP 404 and remains next after this focused MSE UX experiment.

## Next actions

1. Investigate the direct-download HTTP 404 from current `main`: inspect candidate provenance, freshness/redirect behavior, and the minimum non-sensitive request context available to the extension/CoApp.
2. If request context is required, design the narrowest safe propagation model; do not copy cookies, authorization tokens, or broad browser headers by default.
3. Keep MSE compatibility evidence-driven and preserve the validated player behavior/DRM boundary.

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
