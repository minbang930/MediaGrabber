# Working Style

## Communication

- Default chat language: Korean.
- Keep progress reports compact but technically specific.
- Repository documentation, code comments, branch names, PR titles, and commit messages should follow the repository's existing English convention unless the user asks otherwise.
- Prefer copy-paste-ready commands. The current user environment is Windows, so use PowerShell examples by default when commands are platform-specific.

## Autonomy vs. questions

- Investigate the repository before asking the user to restate project context.
- Ask only when a genuinely unresolved choice materially changes the implementation, when a destructive action needs approval, or when required external information cannot be derived from the repository.
- For safe, reversible work with a clear repository convention, proceed and report the result.
- Distinguish confirmed facts, observations, hypotheses, and proposed changes.

## GitHub collaboration

Default flow:

1. Inspect default branch, working branches, PRs, and relevant source.
2. Create a focused branch.
3. Implement.
4. Run the appropriate verification.
5. Update long-term docs.
6. Review the complete diff.
7. Open a PR.
8. Inspect CI/status.
9. Merge when checks are successful, or when a docs-only change has no applicable CI and the diff has been reviewed.
10. Verify the merged default branch.

Do not commit secrets, browser credentials, authentication headers, cookies, or tokens.

## Testing and verification

Current repository baseline:

- full build: `npm run build`;
- deterministic CoApp tests: `npm run test:coapp` after build;
- extension package smoke check: `npm run package:extension`;
- PR/push CI: Windows + Node 22 runs `npm ci`, full build, CoApp tests, and extension package smoke check;
- tag-triggered release CI remains separate;
- no linter is currently configured.

Browser/player compatibility requires manual integration testing. When an agent cannot perform a browser-site test directly, state that explicitly and give the user the shortest reproducible test procedure. Never report a manual site test as verified unless the user actually ran it and reported the result.

## Completion report

For substantive work, report:

- what changed;
- verification performed and its result;
- relevant PR, merge, and commit state;
- any remaining blocker or open question;
- the next concrete action if work continues.

## Documentation maintenance

After meaningful implementation or research work, always reconsider CURRENT_STATE.md and HANDOFF.md. Update the other project documents only when their responsibility actually changed; do not turn them into duplicate changelogs.
