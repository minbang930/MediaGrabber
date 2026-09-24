# Architecture

This document describes the current MediaGrabber implementation in this repository. The lowercase docs/architecture.md is inherited research about Video DownloadHelper and is not the current architecture source of truth.

## Runtime overview

Browser page and player
→ isolated content script
→ optional capture-only MAIN-world MSE instrumentation
→ Manifest V3 background service worker
→ native messaging bridge
→ Node CoApp
→ HTTP downloader, FFmpeg/ffprobe, or yt-dlp
→ downloaded files

### Browser extension

#### Background service worker

extension/src/background.ts owns tab-scoped media state, request interception, manifest parsing orchestration, popup communication, download routing, and native-client coordination.

Network-facing detection includes:

- URL heuristics for .m3u8, .mpd, .mp4, and .webm;
- response Content-Type recognition for HLS and DASH;
- HLS and DASH manifest parsing;
- pathname-based manifest deduplication for redirect/CDN chains.

Download routing is type-based:

- HLS/DASH → FFmpeg through CoApp;
- MSE → explicit user-triggered post-transform capture on `fix/mse-append-capture`: clear SourceBuffer appends are chunked through the extension, spooled to temporary per-track files in CoApp, then muxed by FFmpeg;
- yt-dlp entries → yt-dlp through CoApp;
- direct media → CoApp HTTP downloader.

#### Isolated content script

extension/src/content.ts:

- scans existing and dynamically-added video/audio/source elements;
- tracks page navigation generations;
- receives MSE instrumentation messages;
- builds MSE media candidates;
- forwards media and page metadata to the background service worker.

For the new MSE capture path, it also performs the isolated-world bridge between MAIN-world append data and the background service worker. Capture is armed only after an explicit download request; ordinary detection does not retain media payload bytes.

#### MAIN-world MSE instrumentation

Ordinary browsing does not statically inject `mse-inject.ts` into the page MAIN world.

The isolated content script can recognize blob-backed media elements as MSE candidates without replacing page-owned APIs. When the user explicitly starts an MSE download, the background service worker dynamically registers `mse-inject.js` for the relevant HTTP(S) player/page origins at `document_start`, reloads the page, and removes the temporary registration when capture succeeds, is cancelled, or fails.

During that explicit capture window, the MAIN-world hook instruments only the APIs needed by the validated append-capture workflow:

- `URL.createObjectURL` for MediaSource/blob association;
- `MediaSource.prototype.addSourceBuffer`;
- `SourceBuffer.prototype.appendBuffer`;
- the `MediaSource.prototype.duration` setter;
- capture-scoped media events needed for completion, DRM guards, and playback-rate restoration.

It does not replace `window.fetch`, `XMLHttpRequest.prototype.open`, or History methods. Same-document navigation is observed from the isolated content script through the Navigation API when available, with popstate/hashchange fallbacks. Media redirect learning needed by HLS relay compatibility is handled in the background through `webRequest.onBeforeRedirect`.

This keeps page-global mutation out of unrelated browsing while retaining the explicit post-transform SourceBuffer capture path.

#### MSE background keep-alive

During an explicit MSE capture, the extension starts a video-only Chrome `tabCapture` stream for the selected tab before reload and consumes it in a hidden offscreen extension document.

Purpose:

- keep Chromium rendering/scheduling the captured tab when it is backgrounded or fully occluded by another application;
- avoid the visible PiP window required by earlier experiments.

Boundaries:

- tab-captured pixels are not used as download media, decoded for analysis, saved, or forwarded to the CoApp;
- audio is not requested by this keep-alive stream;
- the actual downloaded media still comes only from the explicit clear `SourceBuffer.appendBuffer()` capture path;
- the tab-capture stream is stopped on capture completion, cancellation, error, or tab closure;
- Chrome may show its standard tab/screen-sharing capture indicator while the keep-alive is active.

The offscreen stream-ID handoff requires Chrome 116+; the runtime checks this capability before starting the keep-alive.


## Stream parsing and relay rewriting

HLS and DASH parsers live under extension/src/lib/.

For some opaque HLS patterns, the MSE hook attempts to learn a mapping between an original media URL and a browser-visible relay URL. Before FFmpeg starts, background.ts can rewrite a captured HLS media playlist into a temporary local manifest that references learned relay URLs.

If mappings are incomplete, current code asks the user to play the media briefly and retry.

## Native messaging boundary

extension/src/lib/native-client.ts connects to native host com.mediagrabber.coapp.

The CoApp uses Chrome native messaging framing:

- 4-byte little-endian message length;
- UTF-8 JSON payload;
- bidirectional RPC request/reply conventions.

The CoApp entry point registers modules for direct downloads, file operations, FFmpeg conversion/probing, yt-dlp, and—on the append-capture branch—an MSE spool module. That module accepts bounded base64 chunks over JSON RPC, writes them immediately to temporary per-track files in fragment order, and exposes only temporary track paths back to the background for final FFmpeg muxing.

This boundary is important because the extension has browser/page context while the CoApp has filesystem/process capabilities. Compatibility fixes should deliberately choose what context crosses this boundary rather than copying browser state wholesale.

## Direct download path

coapp/src/downloads.ts uses Node HTTP/HTTPS streams, follows up to five redirects, supports caller-provided headers, and writes to disk.

Current extension behavior calls this downloader with URL, output directory, and filename only. Referer, Origin, cookie-style, and other request context are not currently propagated on the direct path.

## FFmpeg path

coapp/src/converter.ts:

- resolves FFmpeg/ffprobe from runtime/install paths or PATH;
- launches FFmpeg with progress output;
- supports temporary manifest files for rewritten HLS playlists;
- pushes progress back to the extension through RPC.

## yt-dlp path

coapp/src/ytdlp.ts:

- resolves yt-dlp from bundled/runtime paths or PATH;
- probes JSON format metadata;
- builds video/audio/subtitle choices;
- runs downloads and forwards progress.

The current browser routing treats YouTube pages specially and surfaces yt-dlp-derived formats rather than ordinary intercepted entries.

## Installation and release

coapp/src/installer.ts installs to user-local paths, embeds or copies the CoApp, downloads configured runtime binaries over HTTPS, verifies SHA-256, and registers the native messaging manifest.

The current GitHub Actions release workflow creates Windows x64 artifacts on v* tags. Source code includes path and registration logic for macOS/Linux, but the repository does not currently have equivalent release jobs.

## Persistence

There is no application database. Persistent state is primarily:

- browser extension storage for settings;
- installed local binaries and native-host manifest under the MediaGrabber user-local install directory;
- downloaded media files.

Tab detection and active-download state are runtime memory and are rebuilt as pages are observed.
