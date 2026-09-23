# Roadmap

Roadmap items describe intended work, not current implementation. See CURRENT_STATE.md for facts.

## Now

- Validate hidden Chrome `tabCapture` as the next MSE background/occlusion keep-alive candidate. Real-video/helper PiP are confirmed working but visibly intrusive fallbacks.
- Diagnose the separate direct-download HTTP 404 and determine whether URL freshness/provenance or a minimal non-sensitive request context is required.
- If request context is proven necessary, design and validate the narrowest safe propagation path; do not copy cookies/auth or broad browser context by default.
- Keep the validated 8× chronological playback-rate strategy for MSE capture; keep seek-based acceleration out unless a future transport cannot be accelerated chronologically.

## Next

- Expand deterministic tests beyond the new MSE fragment/session coverage to HLS/DASH parsing, URL mapping, filename/argument construction, and stream-grouping logic.
- Replace mixed-language user-facing FFmpeg errors with consistent localized or English messages.
- Improve diagnostics so detected, downloadable, expired URL, missing request context, and DRM/protected failures are distinguishable.
- Define and implement a safe request-context model if the 404 investigation confirms it is required.

## Later

- Expand compatibility fixtures for common HLS/DASH/MSE delivery patterns.
- Evaluate macOS/Linux release packaging; source path/registration support exists but release automation is currently Windows-only.
- Revisit extension watch/dev ergonomics.
- Evaluate broader supported-site routing through yt-dlp where that is more reliable than raw sniffing.

## Completed

- Fork created from upstream and verified aligned with upstream main at bootstrap.
- Long-term repository-first agent/documentation workspace initialized.
- Current manual compatibility observations captured in EXPERIMENTS.md.
- PR #22 merged the validated transformed-XHR MSE append-capture/mux workflow, 8× chronological acceleration, cancellation cleanup, deterministic MSE fragment/session tests, and Windows/Node 22 PR/main CI.

## Deferred / not a goal

- DRM circumvention.
- Claiming universal download support without evidence.
- Site-specific hacks that permanently replace a general fix unless a documented compatibility exception is necessary.
