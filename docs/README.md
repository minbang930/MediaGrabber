# MediaGrabber Documentation

This directory contains two kinds of documentation. Use the current-project set first for ongoing work.

## Current project source of truth

| Document | Responsibility |
|---|---|
| PROJECT.md | Stable project purpose, scope, users, and success criteria |
| CURRENT_STATE.md | What the repository actually implements and what is known now |
| HANDOFF.md | Short continuation note for the next session |
| WORKING_STYLE.md | Durable user/agent collaboration rules |
| ARCHITECTURE.md | Current MediaGrabber system structure and data flow |
| DECISIONS.md | Important decisions and rationale |
| ROADMAP.md | Planned priorities, separated from current facts |
| EXPERIMENTS.md | Manual tests, observations, hypotheses, and compatibility results |

AGENTS.md at the repository root is the top-level operating instruction for AI agents and defines the required session bootstrap order.

## Inherited research and reference material

The pre-existing lowercase documents in this directory were written primarily as Video DownloadHelper research/reference material. They are preserved because they contain useful background, but they are not authoritative descriptions of this MediaGrabber fork.

- architecture.md
- coapp.md
- detection.md
- ffmpeg.md
- native-messaging.md
- quick-reference.md
- youtube.md
- changelog.md

Other release, store, and privacy documents remain reference material where applicable.

When a lowercase reference document conflicts with the current MediaGrabber source code or an uppercase current-project document, inspect the code and treat the verified current state as authoritative.
