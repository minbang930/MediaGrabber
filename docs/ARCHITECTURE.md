# Architecture

This document describes the current MediaGrabber implementation in this repository. The lowercase docs/architecture.md is inherited research about Video DownloadHelper and is not the current architecture source of truth.

## Runtime overview

Browser page and player
→ isolated content script and MAIN-world MSE instrumentation
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

extension/src/mse-inject.ts runs at document_start in the page's MAIN world so it can observe APIs unavailable from the isolated extension world.

It currently instruments:

- history navigation;
- window.fetch;
- XMLHttpRequest.prototype.open, using a normal loadend event listener for relay observation;
- URL.createObjectURL;
- MediaSource and SourceBuffer APIs.

It reports MSE state and original-to-relay URL mappings to content.ts using window.postMessage. On the append-capture branch, an explicit capture session additionally copies already-clear SourceBuffer append fragments only after the native append call has been forwarded, splits them into bounded chunks, and stops on EME/CENC indicators.

This layer is currently the highest compatibility-risk component because it mutates page-global APIs. The current compatibility patch removes XMLHttpRequest constructor replacement and per-instance event-property redefinition, while retaining a minimal prototype.open observer. The project requirement is to retain observability while preserving native page semantics.

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
