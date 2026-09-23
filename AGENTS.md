# MediaGrabber — Agent Operating Instructions

This repository is the long-term source of truth for the MediaGrabber project. Do not rely on chat history alone for project state, decisions, or handoff context.

## Session start

At the start of a new chat or work session, do not ask the user to re-explain the project. Restore context from the repository in this order:

1. AGENTS.md
2. docs/WORKING_STYLE.md
3. docs/PROJECT.md
4. docs/CURRENT_STATE.md
5. docs/HANDOFF.md

Then read additional documents as needed:

- system structure and runtime flow: docs/ARCHITECTURE.md
- important decisions and rationale: docs/DECISIONS.md
- plan and priorities: docs/ROADMAP.md
- experiments and compatibility findings: docs/EXPERIMENTS.md
- inherited Video DownloadHelper research/reference material: docs/README.md and the lowercase docs it indexes

The uppercase project documents are the current MediaGrabber project source of truth. Existing lowercase documents under docs are inherited research/reference material unless a current project document explicitly says otherwise.

## Before important work

Before a non-trivial implementation, investigation, or design change, inspect the relevant scope instead of assuming prior chat context is current:

- default branch, working branch, open PRs, and upstream relationship;
- actual source code and configuration;
- relevant tests or build verification;
- related architecture and decision records;
- latest handoff;
- external dependencies and runtime assumptions that affect the work.

If code and documentation conflict, investigate the actual repository state and update stale documentation. Mark unverified ideas as Open question, Candidate, or Unknown. Do not turn guesses into project facts.

## After important work

Do not finish substantial work with code changes alone. Review and update when affected:

- always: docs/CURRENT_STATE.md and docs/HANDOFF.md;
- design or methodology decisions: docs/DECISIONS.md;
- architecture changes: docs/ARCHITECTURE.md;
- priorities or sequencing: docs/ROADMAP.md;
- experiments or manual compatibility results: docs/EXPERIMENTS.md;
- persistent collaboration preferences: docs/WORKING_STYLE.md.

Record a decision once it is sufficiently settled for future sessions. Keep brainstorming separate from accepted decisions.

## Repository and build facts

MediaGrabber is an npm-workspaces monorepo with two packages:

- extension/: Chrome/Edge Manifest V3 extension, TypeScript plus esbuild.
- coapp/: Node.js native messaging companion, TypeScript/CommonJS, FFmpeg/ffprobe and yt-dlp integration.

Primary verification commands on Windows PowerShell:

    npm ci
    npm run build
    npm run package:extension

Load the development extension from extension/, not extension/dist/.

Current development-tool limitations are tracked in docs/CURRENT_STATE.md. At bootstrap time there is no automated test suite or lint task, and npm run dev:extension points to a missing extension watch script.

## GitHub workflow

Unless the repository adopts a different documented workflow, use:

default branch latest state
→ working branch
→ changes
→ verification
→ documentation update
→ self-review the diff
→ PR
→ CI/status review
→ merge when successful
→ verify latest default branch

Do not ignore a failing check without resolving or documenting the reason. For docs-only changes where no CI applies, review the complete diff before merge.

Do not perform destructive or hard-to-reverse operations without explicit user approval. Never commit secrets, credentials, tokens, browser cookies, captured authorization headers, or other authentication material.

## Project-specific invariants

These constraints take precedence over convenience:

1. Playback preservation: stream observation and instrumentation must not break the site's player. MAIN-world hooks should preserve native browser API semantics as much as possible.
2. No fake universality: do not claim that every website or every stream type is supported. Distinguish direct media, HLS, DASH, MSE/blob transport, signed or authenticated URLs, and DRM-protected media.
3. DRM boundary: the project may detect that protected media exists, but DRM circumvention is out of scope.
4. Native host identity: the Chrome/Edge native messaging host name is com.mediagrabber.coapp. Changes require coordinated extension, installer, and registration updates.
5. Release integrity: runtime binaries downloaded by the installer must remain HTTPS-fetched and checksum-verified. Do not weaken SHA-256 verification to work around installation issues.
6. Browser request context is sensitive: headers, cookies, and authentication state used for compatibility must be handled minimally and must never be logged or committed as credentials.

## Documentation responsibility map

- docs/PROJECT.md: what the project is and is not.
- docs/ARCHITECTURE.md: how the current system is composed.
- docs/CURRENT_STATE.md: what is actually implemented and known now.
- docs/ROADMAP.md: what is planned next.
- docs/DECISIONS.md: why important choices were made.
- docs/EXPERIMENTS.md: observed compatibility tests, hypotheses, and outcomes.
- docs/HANDOFF.md: short continuation note for the next session.
- docs/WORKING_STYLE.md: durable user/agent collaboration rules.

Avoid copying the same content into multiple files; link to the document that owns the fact.
