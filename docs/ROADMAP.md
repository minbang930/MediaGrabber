# Roadmap

Roadmap items describe intended work, not current implementation. See CURRENT_STATE.md for facts.

## Now

- Complete request-context presence diagnosis for exact-matched browser HLS segment/key requests.
- Keep PR #8 unmerged until we know whether FFmpeg is missing browser Cookie/Authorization/Range/Referer/Origin context.
- If context differs, design the smallest credential-safe propagation model; if not, inspect decrypted segment probing/format without broadening browser credential handling.
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
