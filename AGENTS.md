# Codex Project Rules

## Deployment

- Autodeploy is forbidden. Codex must not deploy to production, run deploy scripts, upload release archives, restart production containers, or change the production `current` symlink unless the user explicitly says to deploy in that same message.
- Default workflow: Codex prepares code, runs local build/tests/checks, and reports the exact deploy command for the user to run manually.
- Production domain: `https://gamehubparty.ru`
- Production server: `201.51.12.133`
- SSH user: `deploy`
- App path on server: `/home/deploy/apps/gamehubparty/current`
- Main deploy command from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1 -KeyPath ".deploy-keys\gamehubparty_deploy"
```

Before deploying, run or let `deploy.ps1` run:

```powershell
npm.cmd run build
npm.cmd test
```

The working SSH key is already stored in this project:

```text
.deploy-keys\gamehubparty_deploy
```

Do not waste time looking for a new key when deploying from this workspace. Pass `-KeyPath ".deploy-keys\gamehubparty_deploy"` explicitly. If no key is passed, `deploy.ps1` prefers `.deploy-keys\gamehubparty_deploy`, then falls back to `%USERPROFILE%\.ssh\gamehubparty_deploy`, then to the newer `gamehubparty_deploy_20260619` variants.

If SSH/network access is blocked by the current Codex session, request network permission and then retry the same deploy command.

## Product Shape

GameHubParty should feel like a mobile web app, not a wide desktop website. On desktop, keep the experience centered in a phone-like app shell instead of expanding layouts across the full browser width.

For visual changes, verify mobile screenshots around `390px` width and check that there is no horizontal scroll.
