# Experiments and Compatibility Notes

Keep observation, interpretation, and decision separate. Site identities are not recorded here because they were not provided.

## 2026-09-23 — Native host installation check

Purpose: determine why the extension reported "Specified native messaging host not found."

Conditions:

- extension initially installed without the native setup executable;
- Windows/Chromium environment.

Observation:

- extension-only installation produced the native-host-not-found error;
- after running the MediaGrabber setup executable, the error disappeared.

Interpretation: the extension requires the separately registered CoApp/native messaging host for native operations. This matches the repository architecture.

Security note: the tested installer was unsigned. VirusTotal showed a small number of generic/heuristic detections while many engines did not detect it; the file hash matched the upstream release artifact discussed during the session. Treat this as provenance and behavior evidence, not a guarantee of safety.

## 2026-09-23 — Site A direct download returns HTTP 404

Purpose: test a media entry detected by the extension.

Observation:

- the extension detected a downloadable-looking item;
- starting the download produced "Download failed with HTTP 404."

Repository fact: the direct-download path currently sends URL, output directory, and filename to CoApp. It does not currently pass the detected video.referer or other browser request headers. The CoApp downloader itself can accept caller-provided headers.

Hypotheses:

- Referer or Origin is required;
- a cookie or authorization value is required;
- the URL is short-lived/signed and expired;
- the detected URL is an intermediate or non-download resource.

Status: Open. Do not state the header hypothesis as the root cause until reproduced.

## 2026-09-23 — Site B FFmpeg failure and playback regression

Initial observation:

- a download attempt produced the MediaGrabber error corresponding to FFmpeg being unable to open the stream;
- with the stock MediaGrabber extension active, the site's video itself would not play.

A/B change: removed the dist/mse-inject.js MAIN-world content-script entry from extension/manifest.json for diagnosis.

Result:

- video playback returned after the MSE injector was removed;
- the extension then showed roughly 14 media-looking entries;
- downloading from those entries appeared to save only a partial segment rather than the full video.

Observed conclusion: the MAIN-world injector is involved in the playback regression on this site. Disabling it also removes information needed to interpret and group the stream, so disabling it is diagnostic only.

Current compatibility hypothesis: the most suspicious section is XHR instrumentation in mse-inject.ts, which:

- replaces the window.XMLHttpRequest property with a wrapped constructor;
- wraps individual XHR instances;
- redefines onload, onreadystatechange, and onloadend;
- separately replaces XMLHttpRequest.prototype.open.

A player can depend on constructor identity, property descriptors, or native event semantics. This is plausible but not yet isolated to a single line.

Next experiment:

1. Keep MSE and SourceBuffer observation enabled.
2. Stop replacing the XHR constructor and event-handler properties.
3. Observe URLs with the smallest possible open/send or event-listener hook.
4. Rebuild.
5. Verify player playback.
6. Only after playback passes, inspect stream grouping and full download.

## 2026-09-23 — Minimize XHR interception

Purpose: keep MSE/relay observation while reducing the chance that MediaGrabber changes player-visible XMLHttpRequest behavior.

Change on branch `fix/minimize-xhr-hook`:

- removed replacement of `window.XMLHttpRequest`;
- removed per-instance redefinition of `onload`, `onreadystatechange`, and `onloadend`;
- retained `XMLHttpRequest.prototype.open` only;
- after native `open` succeeds, attach a normal one-shot `loadend` listener for relay mapping;
- retained existing segment URL reporting.

Verification performed by the agent:

- attempted full clone/build, but the execution environment could not resolve github.com;
- isolated TypeScript type-check of the modified XHR hook against DOM typings passed.

Result: user manual validation confirmed that the previously broken player now plays normally with the injector enabled. The popup still shows roughly 14 media entries. Conclusion: minimizing XHR interception fixed the observed playback regression, while fragment grouping remains a separate issue to investigate next.

## 2026-09-24 — DOM provenance identified the 14-entry source

Purpose: identify exactly which detection path created the persistent 14 popup entries after playback compatibility was fixed.

Diagnostic PR #5 added source-only metadata without exposing URLs or request credentials.

Observed result:

- `direct/content:dom/https/mutation:source/top × 12`;
- `direct/content:dom/blob/media:loadedmetadata/subframe × 1`;
- `hls/webRequest:content-type/https × 1`.

Repository interpretation:

- the 12 extensionless HTTPS entries come from descendant `<source src>` nodes discovered by the top-frame MutationObserver;
- that descendant-source path previously called `handleMediaUrl()` without the `isMediaUrl()` guard, so extensionless alternatives were classified as generic `direct` entries;
- the blob entry came from media `loadedmetadata/currentSrc`; it is not an HTTP(S) URL that the native direct downloader can use;
- one HLS candidate is independently detected from response Content-Type.

Follow-up fix on `fix/filter-dom-source-noise`:

- require descendant/scanned child `<source>` URLs to pass explicit media-URL recognition before pre-registering them;
- keep selected media-element `currentSrc` observation so an extensionless HTTP(S) source can still be detected once the browser actually selects it;
- normalize DOM media URLs to absolute HTTP(S) URLs;
- reject blob/data/other non-HTTP(S) URLs from generic direct registration.

Result: user manual validation confirmed the popup dropped from 14 entries to 1. The remaining entry is the HLS candidate previously identified by response Content-Type. Downloading that entry still fails in FFmpeg with the generic "could not open stream" error. Conclusion: the DOM noise fix is successful; HLS download failure is a separate issue.

## 2026-09-24 — Image-only HLS was hiding the real MSE candidate

Diagnostic chain:

- DOM noise fix reduced the popup from 14 entries to 1 while playback stayed normal.
- The visible HLS parsed as a version-6 media playlist with 1118 segments and AES-128/identity encryption.
- Browser segment requests succeeded with HTTP 200 and used the same Referer/Origin values that MediaGrabber supplied to FFmpeg.
- FFmpeg opened the HLS and AES-128 crypto layer, then probed the decrypted child as `image2` with score 50.
- Candidate-role diagnostic reported: `1 visible / 2 total · hidden mse:1 · hlsSegments image:1118`.

Confirmed interpretation:

- the visible HLS entry is an image/thumbnail/storyboard playlist rather than the main A/V stream;
- the real media candidate is already detected as `mse`, but the popup's duration-first visibility rule allowed the image HLS to hide it;
- PR #8's HLS extension-relaxation change addressed the wrong candidate and was closed without merge.

Follow-up fix on `fix/filter-image-hls`: image-only HLS media playlists are excluded from user-facing A/V candidates when every parsed segment has an image extension. Master HLS and ordinary audio/video HLS are unaffected.

Result: user manual validation confirmed normal playback and the MSE candidate became visible. Attempting the MSE download then failed with the existing generic FFmpeg-open error, confirming MSE reconstruction is the next separate problem.

## 2026-09-24 — Transformed MSE path is clear; implement append capture

Diagnostic sequence after the real MSE candidate was surfaced:

- capture-state diagnostic: two SourceBuffers, active appends, zero URL capture;
- container diagnostic: audio/video buffers are fragmented MP4 (`ftyp` init followed by `moof` media fragments);
- timing diagnostic: XHR responses are close to appends but usually ambiguous, so nearest-XHR mapping is unsafe;
- identity diagnostic: 30 XHR ArrayBuffers produce 60 MSE appends with zero exact/backing-buffer identity matches;
- raw-source diagnostic: all 30 XHR ArrayBuffers classify as `other`, not a standard media container;
- DRM-boundary diagnostic: `eme=0`, `initData=none`, and `drm=none` for both audio/video init fragments.

Confirmed interpretation for the tested player:

- useful standard fMP4 exists only after page-side transformation;
- replaying detected URLs cannot reconstruct this transport safely;
- the observed post-transform fMP4 is clear/non-DRM within the tested EME/CENC checks.

Implementation on `fix/mse-append-capture`:

- MSE Download creates a native capture session and reloads the page once;
- the matching player frame arms a capture handshake at `document_start`;
- capture is inactive during ordinary browsing and detection;
- clear SourceBuffer fragments are copied only after the native append call returns, split into 192 KiB chunks, and sent through content/background to CoApp;
- CoApp spools each SourceBuffer to a temporary ordered track file with bounded pending state;
- source-end/media-end finalizes capture; FFmpeg stream-copies the first video/audio tracks into the requested output;
- EME events or CENC markers abort capture instead of attempting protected-media handling;
- cancellation, errors, and host exit clean temporary capture files.

Status: implementation complete on the work branch; full build and real-site playback/output validation are pending.

## 2026-09-24 — First append-capture real-site validation

Observation:

- pressing Download created the MSE capture session and reloaded the selected tab once;
- playback did not autoplay after reload; manual playback was required and worked;
- after playing to the end, no output file appeared and the popup stayed in the downloading state;
- while the capture tab was reloading/playing, the popup media list cycled through media detected in other tabs.

Confirmed defect:

- popup media refreshes were globally broadcast to every popup port even though `notifyPopups(tabId)` received a tab ID.

Follow-up changes on PR #22:

- popup ports are now bound to their selected tab and media refreshes are tab-scoped;
- media-list refreshes are suppressed while that tab has an active download so reload-time detection does not overwrite the progress UI;
- MSE completion now tracks the MediaSource that owns captured SourceBuffers rather than comparing against the single latest global blob URL;
- cross-world capture payloads use `ArrayBuffer.isView` instead of realm-sensitive `instanceof`;
- capture UI now reports captured bytes/fragments and a distinct finalizing phase.

Status: second real-site validation pending. The first run confirms capture arming/reload works, but does not yet confirm that fragment transport or final mux completes.
## 2026-09-24 — Second append-capture validation: tab isolation fixed, capture phase still opaque

Observation:

- after the popup tab-scoping fix, media from other tabs no longer appears during the capture workflow;
- Download still reloads the selected tab once;
- the popup remains in the generic armed/downloading UI after manual playback, with no visible captured-byte/fragment progress.

Interpretation:

- the cross-tab popup broadcast defect is confirmed fixed by user validation;
- the remaining blocker could be before capture-frame attachment, between the content script and MAIN-world hook, or before the first fragment reaches background;
- the previous popup restore path also overwrote stored capture-phase status with a generic `Downloading…` label, so UI alone could not distinguish those states.

Follow-up on PR #22:

- persist control-plane phases in the active download: `reload`, `frame-ready`, `hook-armed`, `first-fragment`, `capture`, and `finalizing`;
- content reports the first MAIN-world `mse-capture-started` acknowledgement to background;
- popup restore preserves and renders the stored capture phase instead of replacing it with generic download text.

Status: third focused validation pending.
## 2026-09-24 — Capture stalled before frame-ready due to stale iframe identity

Third focused validation result:

- last visible lifecycle phase: `Capture session ready — waiting for the reloaded player frame…`;
- therefore no post-reload content frame was accepted by the background capture session.

Confirmed code cause:

- the session persisted the pre-reload MSE `sourceFrameId`;
- `handleMseCaptureReady()` required the post-reload sender to match that old frame ID (or exact old frame URL);
- subframe IDs are navigation-scoped and may change across reload, so the target iframe could be rejected even though its content script was running.

Fix on PR #22:

- post-reload content frames in the selected tab may temporarily arm as capture candidates;
- the session no longer locks `activeFrameId` at READY time;
- the first frame that actually delivers an MSE media chunk becomes the locked capture frame;
- all other armed candidate frames are explicitly stopped after that first-fragment lock;
- subsequent progress/finalization remains restricted to the locked frame.

This preserves per-frame isolation without relying on stale pre-reload iframe IDs.

Status: focused revalidation pending.
## 2026-09-24 — First native spool write reached, sparse-chunk bug fixed

Focused validation after frame relock:

- reload proceeded into the native capture path far enough to surface a CoApp error:
  `The "data" argument must be of type string or an instance of Buffer, TypedArray, or DataView. Received undefined`;
- this confirms post-reload frame arming, MAIN-world capture, fragment forwarding, background validation, and native RPC delivery all occurred.

Confirmed CoApp defect:

- a pending fragment used `new Array(chunkCount)`, creating a sparse array;
- `Array.some()` skips unassigned sparse slots, so the fragment could be treated as complete after only one chunk arrived;
- `flushTrack()` then iterated the holes and passed `undefined` to `fs.appendFileSync()`.

Fix on PR #22:

- each pending fragment now tracks an explicit `receivedCount`;
- the chunk array is initialized with real `undefined` entries rather than holes;
- a fragment flushes only when `receivedCount === chunkCount`;
- flush also checks every indexed chunk and throws an explicit invariant error if completeness is violated.

Status: CoApp rebuild/replacement and focused revalidation pending.
## 2026-09-24 — Append-capture end-to-end validation passed

After the native fragment-completeness fix, user validation completed successfully:

- Download armed the capture and reloaded the selected tab once;
- manual playback after reload proceeded normally;
- MSE fragments were captured and spooled without the previous undefined-chunk error;
- capture finalized and FFmpeg mux completed;
- a playable output file was created successfully.

Confirmed limitation of the current architecture:

- MediaGrabber only receives post-transform fMP4 fragments when the page/player actually appends them to SourceBuffer;
- therefore a complete file requires the player to load the full timeline;
- on the tested player, the reliable method is playback from the beginning to the end;
- seeking ahead is not considered a safe substitute because skipped intervals may never be appended.

This is now a UX/performance limitation rather than a functional failure.
## 2026-09-24 — Candidate: accelerate complete MSE capture with playbackRate

Goal: reduce wall-clock capture time without changing fragment ordering or using timeline seeks.

Experiment on `exp/mse-playback-rate-acceleration`:

- base: validated PR #22 append-capture implementation;
- only during an explicit active MSE capture, identify the HTMLMediaElement whose blob URL belongs to the captured MediaSource;
- request `playbackRate = 8` and `defaultPlaybackRate = 8`;
- do not auto-play or auto-seek;
- report both requested and effective rates through the existing capture progress UI;
- restore the element's original playback/defaultPlaybackRate on success, cancellation, error, or navigation.

Why this is the first acceleration candidate:

- chronological playback is preserved, so fMP4 fragment ordering and timestamps are not intentionally reordered;
- the existing capture/mux pipeline remains unchanged;
- the change is limited to the explicit download session and is reversible;
- if the player rejects/resets the rate, the effective rate is observable rather than silently assumed.

Acceptance:

- ordinary playback before Download remains normal;
- after reload and one manual Play action, popup shows an effective rate above 1×, ideally 8×;
- capture bytes/fragments continue increasing without transport errors;
- wall-clock completion is materially faster than media duration;
- final output remains complete, playable, and synchronized;
- playback rate returns to its original value after capture.

If this fails, do not jump directly to arbitrary seeks. The next candidate should be coverage-aware sequential seeking, which requires fragment-time coverage tracking and likely ordered fragment indexing to avoid gaps/duplicates.
## 2026-09-24 — First playback-rate acceleration validation

Observation:

- ordinary playback before capture remained normal;
- MSE capture still worked and popup progress reached values such as `Capturing… 24.0 MB · 70 fragments`;
- playback did not accelerate;
- popup showed no requested/effective playback-rate state at all.

Interpretation:

- this does not show that the player rejected 8×;
- the acceleration code never selected a target HTMLMediaElement, because its first implementation required the media element's `currentSrc/src` to match a blob URL associated with the captured MediaSource;
- on this player, capture succeeds even though that exact DOM URL association is not exposed to the hook.

Follow-up on PR #23:

- retain exact blob matching as the preferred target;
- only after at least one real MSE fragment has been captured, allow a fallback when the capture frame contains exactly one currently playing video element;
- if no unique playing video exists, allow a unique playing media element as a secondary fallback;
- report the target mode (`blob`, `playing-video`, or `playing-media`) together with requested/effective rate;
- do not accelerate if the candidate is ambiguous.

Status: focused revalidation pending.
## 2026-09-24 — Playback-rate acceleration validation passed

Second acceleration validation passed end-to-end:

- ordinary playback before Download remained normal;
- after capture reload and manual Play, the player accelerated successfully;
- MSE capture continued while accelerated;
- download completed successfully;
- the final downloaded video was normal/playable.

Confirmed outcome:

- chronological playback-rate acceleration is a viable way to reduce wall-clock MSE capture time on the tested player;
- the unique-playing-video fallback successfully identified the target where exact captured-blob matching did not;
- arbitrary seeking is not needed for this tested transport and remains a higher-risk fallback because it can skip fragments;
- acceleration stays scoped to explicit capture sessions and is restored afterward.

Decision candidate promoted to confirmed: prefer reversible chronological playback-rate acceleration before any seek-based acceleration strategy.
## 2026-09-24 — Accelerated capture cancellation validation passed

User validation of Cancel during an active accelerated MSE capture passed:

- pressing Cancel stopped capture immediately;
- the player remained usable and continued normal playback behavior;
- playback rate returned from the capture acceleration to the original rate;
- no player regression was observed after cancellation.

This confirms the explicit cancellation path correctly restores player-visible playback state while terminating the active capture session.

Remaining manual acceptance: verify temporary native capture directories/files do not accumulate after success/cancel/error.
## 2026-09-24 — Native capture temporary-file cleanup validation passed

Manual filesystem validation after the accelerated-capture Cancel test:

- PowerShell count of `%TEMP%\mediagrabber-mse-*` directories returned `0`;
- no native MSE capture temporary directory remained after cancellation.

Together with the successful-completion cleanup path already exercised during end-to-end download validation, this closes the manual temporary-spool cleanup acceptance for the tested workflow.
## 2026-09-24 — Background MSE capture: detached window, real PiP, helper PiP

Goal: let the user work in another tab/application while the tested transformed-XHR player continues producing MSE appends.

Observed sequence:

- Draft PR #25 moved the player into a dedicated normal browser window. Capture continued while that window remained at least partially visible, but stopped when another maximized application fully covered it and resumed when it became visible again.
- Draft PR #26 used standard video Picture-in-Picture for the real captured video. User validation confirmed capture/download continued while using other tabs and while another maximized application covered the browser.
- PR #27 (closed without merge) replaced the real-video PiP target with a synthetic 320×40 black helper video. User validation again confirmed background capture continued, but the browser still presented a normal visible PiP window rather than a practically hidden/thin surface.

Interpretation:

- the detached-window failure is consistent with Chromium native-window occlusion backgrounding;
- an active PiP is sufficient to keep the tested workflow progressing, including when the helper rather than the real media owns PiP;
- standard PiP does not meet the desired UX because the browser controls the PiP window and keeps it visibly present even when its source is tiny.

Status: PiP remains a working fallback experiment, not the desired final UX.

## 2026-09-24 — Candidate: hidden tabCapture keep-alive instead of visible PiP

Goal: obtain the useful browser scheduling behavior without a visible PiP window.

Evidence motivating the experiment:

- Chromium's Windows WebContents video-capture browser tests explicitly verify that capture continues while the host window is occluded (test name: `CapturesWhenOccluded`);
- Chrome's `tabCapture` API can keep a tab capture alive across navigation, and Chrome 116+ allows a service-worker-created stream ID to be consumed by an offscreen extension document.

Experiment on `exp/mse-tab-capture-keepalive`:

- add `tabCapture` and `offscreen` extension permissions;
- before the MSE reload, create a video-only tab capture for the selected tab;
- consume and hold that stream in a hidden offscreen extension document; do not save, inspect, or forward captured pixels/audio;
- request video only so the experiment does not intentionally take over page audio;
- keep the existing clear-SourceBuffer capture, 8× playback acceleration, native spooling, DRM guards, and mux path unchanged;
- stop the tab-capture stream on success, cancellation, error, or tab close;
- expose `background keep-alive active` in the popup for diagnostic confirmation.

Acceptance:

- no PiP window opens;
- after the post-reload Play action, MSE bytes/fragments continue increasing when another maximized application completely covers the browser;
- final output remains complete/playable;
- Cancel restores playback rate and ends the tab-capture indicator/stream.

Status: implementation CI passed on Windows/Node 22 (full build, CoApp tests, extension package smoke check); real-site validation pending.

## Candidate reconstruction issue

content.ts currently represents an MSE "All Segments" option by emitting FFmpeg arguments with an init segment and many segment URLs as separate -i inputs, followed by -c copy.

Status: Candidate defect.

Why it needs an experiment: multiple FFmpeg inputs are not automatically equivalent to temporal concatenation of fragmented MP4 pieces. Confirm the actual segment format and expected FFmpeg invocation before changing this path.
