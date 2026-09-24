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

PR #30 (`fix: make MAIN-world MSE hook capture-only`) merged to `main` as `67b8768cd093d32daa5ff5e02f178c02ba204812`.

The validated browser/MSE architecture is now:

- ordinary browsing does not receive the MAIN-world MSE hook;
- blob-backed media can still surface as an MSE candidate from the isolated content script;
- explicit MSE Download dynamically registers the minimal MAIN hook for the relevant player/page origins before reload and removes it at teardown;
- the capture hook does not replace page fetch, XHR, or History methods;
- Cloudflare human-verification, `databento.com`, and YouTube thumbnails were manually confirmed normal after this change;
- the transformed-XHR MSE path still passes candidate detection, reload/capture, 8× acceleration, background/full-window occlusion, normal output, Cancel cleanup, capture-indicator teardown, and playback-rate restoration.

The active compatibility problem is again the separate direct-download HTTP 404. Its exact cause remains unproven. Request-context propagation is still only a hypothesis and must be tested narrowly.

## Next actions

1. Investigate the direct-download HTTP 404 from current `main`: inspect candidate provenance, URL freshness/redirect behavior, and whether the detected URL is intermediate/non-download.
2. Only if needed, determine the minimum non-sensitive request context required; do not copy cookies, authorization tokens, or broad browser headers by default.
3. Preserve the capture-only MAIN-world design, tabCapture privacy boundary, player semantics, and DRM boundary while making unrelated changes.

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
