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
## Candidate reconstruction issue

content.ts currently represents an MSE "All Segments" option by emitting FFmpeg arguments with an init segment and many segment URLs as separate -i inputs, followed by -c copy.

Status: Candidate defect.

Why it needs an experiment: multiple FFmpeg inputs are not automatically equivalent to temporal concatenation of fragmented MP4 pieces. Confirm the actual segment format and expected FFmpeg invocation before changing this path.
