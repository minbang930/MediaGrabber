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

PR #28 (`fix: keep MSE capture active while occluded`) merged to `main` as `3ddeb514c211d869bf197bec3318f668e9f22b3c`.

The validated transformed-XHR MSE flow is now:

- explicit clear `SourceBuffer.appendBuffer()` capture after user-triggered Download/reload;
- native ordered per-track spooling and FFmpeg mux;
- chronological playback acceleration up to 8× with restoration on exit;
- video-only Chrome `tabCapture` consumed in a hidden offscreen extension document so capture continues in background tabs and while another maximized application fully occludes the browser;
- no visible MediaGrabber PiP requirement;
- success/Cancel both stop the browser capture indicator/stream; Cancel restores playback rate and leaves the player usable;
- protected EME/CENC media remains out of scope.

The superseded real-video PiP PR #26 and helper-PiP PR #27 are closed without merge.

The active compatibility problem is again the separate direct-download HTTP 404. Its exact cause remains unproven. Current direct downloads still do not propagate saved browser request context even though the CoApp supports caller-provided headers; treat request-context propagation as a hypothesis to test narrowly, not as the root cause.

## Next actions

1. Verify post-merge `main` CI for commit `3ddeb514c211d869bf197bec3318f668e9f22b3c`.
2. Investigate the direct-download HTTP 404 from current `main`: inspect candidate provenance, URL freshness/redirect behavior, and whether the detected URL is intermediate/non-download.
3. Only if needed, determine the minimum non-sensitive request context required; do not copy cookies, authorization tokens, or broad browser headers by default.
4. Preserve the validated MSE player behavior, tabCapture privacy boundary, and DRM boundary while making unrelated compatibility changes.

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
