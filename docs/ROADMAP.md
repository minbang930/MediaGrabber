# Roadmap

Roadmap items describe intended work, not current implementation. See CURRENT_STATE.md for facts.

## Now

- PR #22 deterministic MSE tests and Windows/Node 22 CI are green; perform final diff/status review and merge.
- Keep the validated 8× playback-rate acceleration as the preferred MSE capture UX; keep seek-based acceleration out unless a future transport cannot be accelerated chronologically.
- Diagnose the separate direct-download HTTP 404 and determine the minimal required request context.

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

## Deferred / not a goal

- DRM circumvention.
- Claiming universal download support without evidence.
- Site-specific hacks that permanently replace a general fix unless a documented compatibility exception is necessary.
