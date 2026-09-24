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

PR #30 has passed both browser-compatibility and MSE regression acceptance.

Validated result:

- Cloudflare human-verification behaves normally with MediaGrabber enabled;
- `databento.com` loads normally;
- YouTube thumbnails load normally;
- ordinary browsing no longer receives the MAIN-world MSE hook;
- blob-backed media is still surfaced as an MSE candidate from the isolated content script;
- explicit MSE Download dynamically registers the minimal MAIN hook before reload;
- the previously validated transformed-XHR workflow still passes: candidate visibility, reload/capture, 8× acceleration, background/full-window occlusion, normal output, Cancel cleanup, capture-indicator teardown, and playback-rate restoration.

The temporary compatibility-test UI/version markers have been removed. Remaining repository work is final CI, PR #30 merge, and verification of latest `main`.

After that, return to the separate direct-download HTTP 404 investigation. Its request-context hypothesis remains unproven.

## Next actions

1. Confirm final PR #30 CI after removing diagnostic markers and finalizing architecture/decision docs.
2. Review final diff, mark PR #30 ready, merge, and verify `main`.
3. Return to the direct-download HTTP 404 investigation from the new `main`.
4. Preserve the capture-only MAIN-world design, tabCapture privacy boundary, player semantics, and DRM boundary in future changes.

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
