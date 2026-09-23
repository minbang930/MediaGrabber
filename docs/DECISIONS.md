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
