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

PR #22 remains the validated transformed-XHR MSE capture baseline: one reload, clear SourceBuffer append capture, native ordered spooling, FFmpeg muxing, up to 8× chronological playback acceleration, cancellation/rate restoration, DRM guards, and cleanup.

The current UX problem is Windows occlusion/backgrounding. PR #25 detached-window capture stalled when fully covered. PR #26 real-video PiP kept capture progressing under other tabs/apps. PR #27 (closed without merge) synthetic helper PiP also kept capture progressing, but Chrome still displayed a normal visible PiP window, so it did not satisfy the desired "keep running without a visible PiP" UX.

Draft PR #28 (`exp/mse-tab-capture-keepalive`) is the next experiment. It starts a video-only Chrome tab capture before the MSE reload and consumes it in a hidden offscreen extension document. Chromium has an explicit Windows `CapturesWhenOccluded` WebContents-capture browser test, making this a targeted experiment rather than a generic visibility spoof. The captured pixels are not used; the existing SourceBuffer/CoApp pipeline remains authoritative.

The separate direct-download HTTP 404 remains unresolved and follows this focused MSE UX experiment.

## Next actions

1. CI has passed for the code change on Windows/Node 22: install, full build, CoApp tests, and extension package smoke check.
2. Rebuild PR #28 after deleting `extension/dist`, then load the extension and verify the UI says `MediaGrabber [tabCapture test]` / `[PR28 tabCapture]`. CoApp replacement should not be needed.
3. Manual validation has passed for another-browser-tab backgrounding: the PR #28 marker was visible, Chrome showed the tab-capture/share indicator, no MediaGrabber PiP was needed, and MSE capture continued after switching tabs.
4. Full native-window occlusion has now passed: another maximized application can completely cover the browser and MSE capture still progresses.
5. Final manual acceptance: test Cancel and successful completion; confirm playback rate restores and the tab-capture state/indicator ends.
6. If tabCapture does not prevent the stall, keep PR #26 real-video PiP as the known working fallback and investigate Chromium scheduling/occlusion constraints before any invasive visibility/focus spoofing.
7. Then return to the direct-download HTTP 404 investigation.

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
