# Current State

Last reviewed: 2026-09-24

## Repository state

- Working repository: minbang930/MediaGrabber.
- Repository type: fork of miroshArtem/MediaGrabber.
- Default branch: main.
- Baseline main at workspace bootstrap: daf968e2f9ad853b318a10196f0e21c586798db5.
- Upstream main was at the same SHA when checked on 2026-09-23.
- Package and manifest version: 1.1.1.
- No open PRs existed in the fork at bootstrap time.

## Implemented runtime

### Browser extension

- Chrome/Edge Manifest V3.
- Service worker: extension/src/background.ts.
- Isolated-world content script: extension/src/content.ts.
- MAIN-world hook: extension/src/mse-inject.ts.
- Network detection through chrome.webRequest.
- Direct URL recognition for HTTP(S) MP4/WebM.
- HLS (.m3u8) and DASH (.mpd) detection and manifest parsing.
- HLS audio/subtitle handling and DASH subtitle handling.
- DOM scanning for media/source elements.
- MSE/blob state tracking via window.postMessage.
- Popup/settings UI and download progress state.
- yt-dlp-backed format route for YouTube pages.

### Native companion

- Native messaging host: com.mediagrabber.coapp.
- Length-prefixed JSON RPC over stdin/stdout.
- Direct HTTP(S) downloader.
- FFmpeg conversion/remux path and ffprobe probing.
- yt-dlp format discovery and downloads.
- User-local installer and native messaging registration.
- Runtime lookup for FFmpeg, ffprobe, and yt-dlp.

### Release pipeline

- `.github/workflows/ci.yml` runs on pull requests and pushes to `main` using Windows/Node 22 and performs install, full build, CoApp tests, and extension package smoke verification.
- `.github/workflows/release.yml` remains tag-triggered for `v*` releases.
- Both current CI/release jobs are Windows-based and use Node 22.x.
- Windows release pins an FFmpeg 8.1.2 asset and yt-dlp 2026.07.04.
- Installer downloads runtime binaries over HTTPS and verifies configured SHA-256 hashes.

## Build and verification state

- PR #22 adds deterministic Node 22 tests for MSE capture session IDs and ordered fragment/chunk completeness using the same core writer used by the CoApp runtime.
- PR #22 adds `.github/workflows/ci.yml` for pull requests and pushes to `main`; it runs `npm ci`, full build, CoApp tests, and extension package smoke verification on Windows/Node 22.
- There is still no lint script.
- The tag-triggered Windows release workflow remains separate.
- npm run dev:extension is currently broken because extension/package.json has no watch script.
- PR #22 CI passed on Windows/Node 22: dependency install, full extension/CoApp build, deterministic CoApp tests, and extension package smoke check all succeeded.

## Known compatibility findings

Details and observations are in EXPERIMENTS.md.

1. Native host installation works after the separate setup executable is installed. Installing only the extension produced "Specified native messaging host not found"; after the setup executable ran, that error disappeared.
2. MAIN-world instrumentation can break playback on at least one tested site. With the stock mse-inject.js content script enabled, the site's video did not play. Removing that MAIN-world content-script entry restored playback. A compatibility patch on `fix/minimize-xhr-hook` removes XMLHttpRequest constructor replacement and per-instance event-property redefinition. User manual validation confirmed that the previously broken player now plays normally with the MSE injector enabled.
3. Removing the MSE injector is not a viable final fix. PR #3 restored playback by minimizing XHR instrumentation. PR #6 then removed DOM source noise, reducing the popup from 14 entries to 1. Later diagnostics showed that remaining visible entry was an image-only HLS playlist with 1118 image segments, while a real `mse` candidate already existed but was hidden by duration-first visibility. Branch `fix/filter-image-hls` excludes image-only HLS media playlists from A/V candidates. User manual validation passed: playback remained normal and the MSE candidate became visible.
4. A separate tested site returns "Download failed with HTTP 404" on direct download. The exact server-side cause is not yet proven.
5. The code currently sends no saved request headers in the direct-download call. startDownload() passes URL, directory, and filename to downloads.download; the CoApp supports custom headers, but the extension does not currently provide them on that path. This is a plausible compatibility gap for referer/origin/auth-sensitive URLs, not yet a proven cause of the observed 404.
6. The previous MSE blob/`All Segments` path is not viable for the tested transformed-XHR player. Draft PR #22 replaces it with an explicit capture session: reload once, spool clear fMP4 appends per SourceBuffer to CoApp temporary files, mux with FFmpeg, and accelerate chronological playback up to 8× during capture. User validation passed end-to-end, including accelerated capture and a normal final video.
7. Some FFmpeg compatibility errors surfaced to users are currently Russian-language strings in background.ts.

## MSE hook risk area

extension/src/mse-inject.ts currently modifies several page-global APIs, including:

- history.pushState and replaceState;
- XMLHttpRequest.prototype.open;
- window.fetch;
- URL.createObjectURL;
- MediaSource.prototype.addSourceBuffer;
- SourceBuffer.prototype.appendBuffer;
- MediaSource.prototype.duration.

The previous XHR constructor and event-property wrapping was too invasive for at least one tested player. PR #3 removed those mechanisms while retaining minimal observation, and user validation confirmed playback recovery. The later 14-entry popup problem was separately traced to DOM-source noise and then to an image-only HLS playlist hiding an MSE candidate.

## Documentation state

- Uppercase project documents are the long-term current-state documentation.
- Existing lowercase files such as docs/architecture.md, docs/detection.md, docs/coapp.md, and docs/changelog.md are inherited Video DownloadHelper research/reference documents. They are useful background but are not authoritative descriptions of the current MediaGrabber implementation.
- The previous AGENTS.md contained stale references to agent-plan/ and installer/, which are not present in the current repository tree. The workspace bootstrap removes those stale layout assumptions.

## Verification note

- Full repository build could not be executed by the agent environment because outbound GitHub DNS was unavailable during clone.
- The modified XHR hook was separately type-checked against DOM typings with TypeScript 5.8 and compiled successfully.
- User manual browser validation passed for the primary acceptance criterion: normal playback with the MSE injector enabled.
- The persistent 14-entry popup count was traced to DOM detection noise: 12 extensionless HTTPS `<source>` descendants, 1 blob currentSrc, and 1 HLS entry.
- User manual validation confirmed the DOM source-noise fix reduced the popup from 14 entries to 1.
- Closed PRs #8-#14 established that the remaining visible HLS was the wrong candidate: its 1118 segments are images, FFmpeg probed the decrypted child as `image2`, and a hidden `mse` candidate was present.
- PR #8's `extension_picky` change was closed without merge because it was tuning an image playlist rather than the main video.
- PR #15 merged the image-only HLS filter; user validation confirmed playback remained normal and the MSE candidate surfaced.
- The current append-capture branch changes both the extension and CoApp; testing it requires the branch CoApp binary, not the previously installed release binary.

## Open questions

- PR #15 validation passed: playback remains normal and the real MSE candidate is visible.
- Diagnostics #16-#20 established that the player transforms 30 opaque XHR ArrayBuffers into separate clear audio/video fMP4 appends; filename, timing, size, and object-identity URL mapping are not reliable for this transport.
- PR #21 observed no EME `encrypted` event, initData, or CENC markers on the tested path (`eme=0`, `drm=none`). This supports treating this specific path as clear/non-DRM while retaining runtime protection guards.
- Draft PR #22 replaces the broken blob/URL FFmpeg path with explicit user-triggered post-transform MSE capture: reload once, capture per-SourceBuffer fragments to native temporary files, then mux the first video/audio tracks with FFmpeg.
- First real-site validation confirmed capture arming and the one-time reload, but playback-to-end did not finalize into an output file. The same run exposed a confirmed cross-tab popup broadcast bug.
- User validation confirmed the popup tab-scoping fix: media from other tabs no longer appears during capture. The capture still remained in a generic armed/downloading state after manual playback, so the exact stall point was not observable.
- Lifecycle validation stopped at `reload`: the post-reload player frame never reached `frame-ready`. The cause was stale iframe identity—the session compared post-reload senders against the pre-reload `sourceFrameId`/exact frame URL.
- PR #22 now arms post-reload frames in the selected tab as temporary candidates and locks the session only when the first actual MSE fragment arrives; other armed frames are stopped immediately after that lock.
- Revalidation progressed into the CoApp spool and exposed a confirmed sparse-array completeness bug: an incomplete multi-chunk fragment could be flushed with `undefined` holes. The CoApp now uses explicit `receivedCount` tracking and indexed completeness checks.
- User validation after the native spool fix succeeded end-to-end: reload, manual playback, sustained capture, final mux, and creation of a playable downloaded file all completed successfully.
- Current UX limitation: this transport captures only media fragments the player actually appends, so complete capture presently requires the player to load the whole timeline—most reliably by playing from the beginning to the end.
- PR #23 playback-rate acceleration passed real-site validation and has been merged into PR #22's branch. The unique-playing-video fallback successfully selected the player when exact blob matching was unavailable.
- User validation of Cancel during accelerated capture also passed: capture stopped immediately, the player remained usable, and playback rate returned to normal.
- Manual temporary-spool cleanup validation passed: `%TEMP%\\mediagrabber-mse-*` directory count was `0` after cancellation.
- Deterministic MSE fragment/session tests and a Windows/Node 22 PR CI workflow have been added on PR #22; CI is currently pending.
- Does the direct-download 404 require Referer/Origin, cookies, another authorization header, or simply a fresher signed URL?
- Should the fork continue to track upstream releases closely or intentionally diverge after the compatibility fixes?
