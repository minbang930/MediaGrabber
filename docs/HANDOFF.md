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

The merged MSE workflow is functional, but one UX gap remains under experiment: on the tested player, switching the capture tab into the background can stop fragment production. Branch `exp/mse-detached-capture-window` moves the existing capture tab into its own active non-minimized browser window, reloads/plays there, then returns focus to the user's original window after the first fragment. It deliberately does not spoof Page Visibility. Real-site validation is pending.

The separate direct-download candidate on another tested site still returns HTTP 404. Its exact cause remains unproven and stays next after this focused MSE UX experiment.

## Next actions

1. Build/load `exp/mse-detached-capture-window` and test one MSE download: press Download, let the video move/reload in the dedicated capture window, press Play once, and confirm focus returns to the original window after capture starts.
2. Stay in the original window and use other tabs while leaving the dedicated capture window open and non-minimized. Confirm accelerated capture still completes and the output is normal.
3. Test Cancel once and confirm the tab returns to the original window with normal playback/rate behavior.
4. If detached-window capture fails, record whether playback itself pauses when the capture window loses focus; do not jump to visibility spoofing without that evidence.
5. Then return to the direct-download HTTP 404 investigation.

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
