# Decisions

Only decisions future sessions are likely to reconsider belong here. Minor implementation details should stay in code and Git history.

## 2026-09-23 — Use the fork repository as the long-term project source of truth

Decision: project continuity lives in minbang930/MediaGrabber, not in ChatGPT conversation history.

Context: the project is intended to continue across many separate ChatGPT sessions.

Consequences:

- session bootstrap starts from AGENTS.md and the project docs;
- meaningful work updates current state and handoff documents;
- chat-only discoveries that affect future work should be recorded in the repository.

## 2026-09-23 — Separate current project docs from inherited Video DownloadHelper research

Decision: uppercase files such as docs/ARCHITECTURE.md and docs/CURRENT_STATE.md describe this MediaGrabber fork. Existing lowercase documents remain reference and research material.

Context: the repository already contains useful but potentially confusing documents whose titles describe Video DownloadHelper rather than the implementation in this fork.

Trade-off: two architecture-like filenames remain, but their responsibility is explicit and existing research is preserved rather than destructively rewritten.

## 2026-09-23 — Preserve MSE capability; fix compatibility rather than permanently disabling the hook

Decision: the MSE MAIN-world layer remains a required capability, but its instrumentation should be redesigned to preserve native page and player semantics.

Evidence: manual A/B testing showed that removing the MSE injector restored playback on a problematic site, but detection then degraded into many fragment-like entries and partial downloads.

Alternatives considered:

- disable the MSE injector globally: restores this player's playback but loses important reconstruction information;
- add a one-off site blacklist: may be useful as a temporary escape hatch but does not address the underlying compatibility defect;
- minimize global API mutation: preferred direction.

Consequence: the next implementation should first reduce XHR/fetch/MSE hook invasiveness and validate playback before changing reconstruction logic.

## 2026-09-24 — Exclude image-only HLS from A/V candidates

Decision: an HLS media playlist whose parsed segments are all recognized image files is not presented as a downloadable audio/video candidate.

Evidence: on the tested site the visible HLS contained 1118 image segments, FFmpeg probed the decrypted child as `image2`, and the actual `mse` media candidate was already present but hidden by duration-first visibility.

Consequences:

- image/thumbnail/storyboard HLS cannot suppress a real MSE candidate;
- master HLS and ordinary audio/video HLS remain eligible;
- classification is based on parsed segment roles rather than site-specific URL matching.

## 2026-09-24 — Capture clear MSE appends only after explicit download

Decision: when a player transforms opaque network responses into clear MSE fMP4 fragments and no safe URL reconstruction exists, MediaGrabber may capture the already-clear `SourceBuffer.appendBuffer()` inputs only during an explicit user-initiated download session.

Evidence:

- filename, Resource Timing size, timing-only, and ArrayBuffer-identity diagnostics could not safely associate source URLs to the audio/video SourceBuffers;
- the tested player transformed 30 opaque XHR ArrayBuffers into 30 audio + 30 video fMP4 appends;
- the tested path emitted no EME `encrypted` events or CENC markers.

Design constraints:

- ordinary detection must not retain append payloads;
- capture begins only after the user presses Download and the page is reloaded so init fragments are included;
- native `appendBuffer()` is called before MediaGrabber copies the fragment, preserving player timing as much as practical;
- media fragments are chunked with bounded in-flight work and spooled immediately to temporary per-track CoApp files rather than accumulated in extension memory;
- protected-media indicators abort the capture; DRM circumvention remains out of scope;
- temporary capture files are cleaned after mux, cancellation, or host exit;
- no cookies, authorization headers, keys, initData bytes, or signed request URLs are added to this capture path.

Consequence: MSE download becomes a capture-and-mux workflow rather than URL replay for this transport class. Real-site compatibility must still be validated before merge.

## 2026-09-24 — Prefer chronological playback-rate acceleration over seek-based capture

Decision: for clear MSE append capture, accelerate the player chronologically with a bounded playbackRate request before considering timeline seeking.

Evidence:

- the validated append-capture path already depends on the player appending the full timeline in order;
- 8× playback-rate acceleration completed successfully on the tested player;
- capture continued normally while accelerated;
- the final downloaded video was normal/playable;
- exact blob-to-element matching was unavailable on this player, but a unique currently playing video in the locked capture frame was a safe enough fallback after the first captured fragment.

Constraints:

- acceleration is active only during an explicit capture session;
- no automatic seek is used;
- if the target media element is ambiguous, do not accelerate;
- restore the original playback/defaultPlaybackRate when capture ends or is cancelled;
- keep effective rate observable rather than assuming the player accepted the requested rate.

Consequence: seek-based acceleration remains a fallback research direction only for transports where chronological playback-rate acceleration is ineffective.

## 2026-09-24 — Use hidden tabCapture to keep explicit MSE capture active under occlusion

Decision: during an explicit MSE append-capture session, hold a video-only Chrome `tabCapture` stream in an offscreen extension document so the target tab continues rendering when backgrounded or fully occluded.

Evidence:

- a detached normal browser window stalled when another maximized application completely covered it;
- real-video PiP and synthetic helper PiP both kept capture progressing, but both required a visible browser-managed PiP window;
- hidden offscreen-consumed `tabCapture` kept the tested MSE workflow progressing both in another browser tab and while another maximized application fully covered the browser;
- successful completion and cancellation both ended the tab-capture indicator/stream, and cancellation still restored the original playback rate.

Privacy and compatibility constraints:

- request video only; do not request page audio for keep-alive;
- do not save, inspect, forward, or treat the captured pixels as download content;
- keep SourceBuffer append capture as the sole media-data path for this workflow;
- stop the tab-capture stream on success, cancellation, error, or tab close;
- do not spoof Page Visibility, focus/blur, player handlers, or DRM behavior;
- treat Chrome's visible capture/share indicator as expected browser UI.

Consequence: visible PiP is no longer required for the validated Windows/Chromium MSE background-capture workflow. Real-video PiP remains historical fallback evidence, not the preferred architecture.

## 2026-09-24 — Keep MAIN-world instrumentation capture-only

Decision: MediaGrabber must not statically inject page-world MSE instrumentation during ordinary browsing. MAIN-world instrumentation is registered only for an explicit user-triggered MSE capture, scoped to the relevant player/page HTTP(S) origins and removed at capture teardown.

Evidence:

- with the previous global `<all_urls>`, all-frame, `document_start` MAIN hook enabled, Cloudflare human-verification could stall, `databento.com` could fail to load, and YouTube thumbnails could be delayed;
- disabling MediaGrabber restored those sites;
- PR #30's compatibility build removed ordinary-browsing MAIN injection, after which all three reported browsing regressions were manually confirmed normal;
- the previously validated transformed-XHR MSE workflow also passed end-to-end under the lazy hook design, including candidate visibility, reload/capture, 8× acceleration, background/full-occlusion keep-alive, successful output, and Cancel cleanup/restoration.

Design constraints:

- ordinary browsing should leave page-owned fetch, XHR, History, MediaSource, and SourceBuffer semantics untouched by MediaGrabber;
- detect blob-backed MSE candidates from the isolated content script where possible;
- only explicit MSE Download may register the capture hook;
- the capture hook must avoid nonessential fetch/XHR/History monkey-patches;
- unregister the temporary hook on success, cancellation, error, and clean stale registrations on extension startup/install;
- preserve DRM/EME guards and the existing privacy boundaries.

Consequence: page-world observation is treated as a narrowly scoped capture capability, not a general always-on detection mechanism.

## Inherited architecture decisions

The current codebase already embodies these upstream choices:

- Manifest V3 Chromium extension;
- TypeScript for extension and CoApp;
- a native companion for filesystem/process access;
- FFmpeg/ffprobe for native media handling;
- yt-dlp for supported-site extraction and the current YouTube flow;
- Native Messaging for extension-to-CoApp communication.

These are current facts, not newly re-litigated decisions. Revisit them only with a concrete project need.

## Candidate — Propagate minimal browser request context to native downloads

Status: Candidate, not yet accepted as an implementation design.

Reason: a tested direct media download returns HTTP 404 while the page can play media, and the direct path currently sends no Referer/Origin/custom headers although the CoApp downloader can accept headers.

Before accepting this design, determine which context is actually required and define a minimal, credential-safe transfer model.
