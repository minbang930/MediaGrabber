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

The direct-download HTTP 404 is temporarily deprioritized because a broader browser-compatibility regression is now confirmed on current `main`.

User-reported A/B evidence:

- Cloudflare human-verification can remain stuck/loading with MediaGrabber enabled;
- `databento.com` can fail to load with the extension enabled;
- disabling MediaGrabber restores normal access;
- YouTube thumbnails can initially be missing and later reappear.

Current `main` injects `mse-inject.js` into every URL/frame at `document_start` in MAIN world, where it replaces multiple page-visible native APIs. This violates the playback/browser-preservation goal beyond media sites.

Active branch: `fix/lazy-mse-main-hook`.

Candidate implementation:

- remove static MAIN-world MSE injection;
- detect `blob:` video as an MSE candidate from the isolated content script;
- dynamically register the MAIN MSE hook only when the user starts an MSE capture, scoped to the relevant HTTP(S) player/page origins and future reload documents;
- unregister the hook at capture teardown;
- remove History/fetch/XHR wrappers from the MSE hook;
- replace same-document History wrapping with isolated-world Navigation API observation;
- preserve HTTP redirect relay learning through `webRequest.onBeforeRedirect`.

## Next actions

1. PR #30 CI passed on Windows/Node 22: install, full build, CoApp tests, and extension package smoke check.
2. Ordinary-browsing validation passed: Cloudflare challenge behavior, `databento.com`, and YouTube thumbnails are normal again with the PR #30 compatibility build.
3. Revalidate the previously working transformed-XHR MSE site: candidate visibility, Download/reload, 8× append capture, background/occlusion keep-alive, successful output, and Cancel teardown.
4. If the MSE regression test passes, remove the temporary `[compat test]` / version marker, update architecture/decision docs, run final CI, and merge.
5. Only after this compatibility issue is closed, return to the separate direct-download HTTP 404.

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
