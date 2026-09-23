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

## 2026-09-23 — Suppress MSE-owned raw fragment entries

Purpose: determine whether the roughly 14 popup entries are duplicate raw network detections of fragment URLs already used by MSE.

Repository observation:

- background webRequest detection treats HTTP(S) URLs ending in .mp4 or .webm as standalone media candidates;
- the MAIN-world MSE hook separately observes segment URLs;
- before this change, there was no explicit ownership link that told background that a raw MP4/WebM URL was an MSE fragment.

Change on branch `fix/group-mse-fragments`:

- content.ts sends a lightweight `MSE_SEGMENT_URL` message only after an actual MSE SourceBuffer has been observed;
- segment URLs seen before SourceBuffer creation are retained and reported once the SourceBuffer appears;
- background.ts stores MSE-owned segment URLs per tab;
- matching raw `mp4`, `webm`, or `direct` entries are removed if already present and ignored if detected later;
- tab reset clears the ownership set.

This deliberately avoids broad filename-based suppression: a URL is hidden only when the MSE instrumentation on that page claims it as a segment.

Verification performed by the agent:

- full clone/build attempt remained blocked because the execution environment could not resolve github.com;
- the added grouping helper logic passed a standalone TypeScript 5.8 strict check.

Status: implementation complete on the branch, real-site popup-count validation pending.

## Candidate reconstruction issue

content.ts currently represents an MSE "All Segments" option by emitting FFmpeg arguments with an init segment and many segment URLs as separate -i inputs, followed by -c copy.

Status: Candidate defect.

Why it needs an experiment: multiple FFmpeg inputs are not automatically equivalent to temporal concatenation of fragmented MP4 pieces. Confirm the actual segment format and expected FFmpeg invocation before changing this path.
