# Roadmap

Roadmap items describe intended work, not current implementation. See CURRENT_STATE.md for facts.

## Now

- Complete remaining PR #22 acceptance: cancellation and temporary-file cleanup validation, plus deterministic coverage for chunk ordering/session validation.
- Keep the validated 8× playback-rate acceleration in PR #22 as the preferred MSE capture UX; keep seek-based acceleration out unless a future transport cannot be accelerated chronologically.
- Merge the MSE reconstruction path only after those checks.
- Diagnose the separate direct-download HTTP 404 and determine the minimal required request context.

## Next

- Add deterministic tests for HLS/DASH parsing, URL mapping, filename/argument construction, and stream-grouping logic.
- Add a PR/push CI workflow that at minimum runs install/build verification.
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
