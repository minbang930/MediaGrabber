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

PR #28 has completed manual acceptance for MSE background keep-alive. The validated flow is now: explicit clear-SourceBuffer capture + up to 8× chronological playback + video-only Chrome `tabCapture` held by a hidden offscreen extension document.

Manual validation passed for:

- no MediaGrabber PiP requirement;
- capture continuing after switching to another browser tab;
- capture continuing while another maximized application fully covers the browser window;
- successful completion ending the Chrome capture/share indicator;
- Cancel ending the capture/share indicator, restoring the original playback rate, and leaving the player usable.

PR #28 also passed the Windows/Node 22 build/test/package CI before final cleanup. The test-only PR28 name/version/popup markers have been removed; final CI/merge verification is the remaining repository step.

The next compatibility problem after this merge is the separate direct-download HTTP 404. Its exact cause remains unproven; request-context propagation remains a candidate, not a conclusion.

## Next actions

1. Confirm final PR #28 CI after removal of diagnostic build markers and documentation finalization.
2. Review the final diff, mark the PR ready, merge it, and verify latest `main`.
3. Close the superseded real-video PiP draft PR #26 after PR #28 is merged.
4. Return to the direct-download HTTP 404 investigation from current `main`, testing URL freshness/provenance before adding browser request context.
5. If request context is proven necessary, propagate only the minimum non-sensitive values required; do not copy cookies, authorization tokens, or broad browser headers by default.

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
