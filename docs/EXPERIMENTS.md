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

## 2026-09-24 — HLS FFmpeg invalid-data diagnostic

Observed diagnostic for the single remaining HLS entry:

- playlist type: `media`;
- variants: 0;
- segments: 1118;
- relay codec: no;
- relay mappings: 0;
- referer present: yes;
- manifest rewrite: no;
- FFmpeg failure class: `invalid-data`.

Interpretation: the extension can fetch and parse a large media playlist, and the failure is not on the relay-rewrite path. This narrows the problem to FFmpeg's handling of the remote HLS input or its child resources.

Leading compatibility hypothesis: newer FFmpeg releases tightened HLS segment-extension validation. Extensionless or otherwise nonstandard segment URLs can produce `AVERROR_INVALIDDATA` when `extension_picky` is enabled. This is a strong match to the observed failure but remains a hypothesis until the fix is validated on the real site.

Experiment on branch `fix/hls-extensionless-segments`:

- apply `-extension_picky 0` only to HLS inputs;
- for remote HLS input, constrain protocols to `http,https,tcp,tls,crypto,data`;
- for rewritten temporary local manifests, additionally allow `file` because the CoApp materializes the manifest on disk;
- do not relax the extension policy for DASH/direct/yt-dlp paths.

Status: implementation complete on the branch, real-site validation pending.

## Candidate reconstruction issue

content.ts currently represents an MSE "All Segments" option by emitting FFmpeg arguments with an init segment and many segment URLs as separate -i inputs, followed by -c copy.

Status: Candidate defect.

Why it needs an experiment: multiple FFmpeg inputs are not automatically equivalent to temporal concatenation of fragmented MP4 pieces. Confirm the actual segment format and expected FFmpeg invocation before changing this path.
