# Git sync design (2026-07-31)

## Goals

Sync favorites (`groups`, `bookmarks`) and UI `settings` across devices without a self-hosted server.

Two modes in Settings → Sync:

1. **Import/Export** — download/upload a JSON `StorageRoot`
2. **Git** — user-owned private repo on GitHub / Gitee / GitLab, authenticated with a **Personal Access Token (PAT)**

## Storage

| Key | Contents |
|-----|----------|
| `favorites.root` | Business data (`StorageRoot` v2) including `meta.updatedAt` |
| `favorites.sync` | Local-only sync config + PAT (never pushed to Git / export) |

Remote file default path: `data/favorites.json`.

## Conflict policy

Whole-file **last-write-wins** on `meta.updatedAt`. Equal timestamps keep local.

## Git providers

Pluggable `GitSyncProvider` registry (`src/shared/sync/providers/`). Built-in: `github`, `gitee`, `gitlab`. Register additional providers via `registerGitProvider`.

### Authentication (PAT)

- User pastes a platform PAT in Settings (password field; not re-shown after save).
- On **Save & connect**, the extension validates the token by reading the configured repo (`getDefaultBranch`), then stores it in `favorites.sync.git.accessToken` and runs an initial sync.
- **Disconnect** clears the token.
- No OAuth / `chrome.identity` / Client IDs.

Suggested token scopes:

| Provider | Scopes |
|----------|--------|
| GitHub | `repo` (private repo read/write) |
| Gitee | projects / repo write |
| GitLab | `api` or `read_repository` + `write_repository` |

### Sync triggers

| Event | Behavior |
|-------|----------|
| Side panel activate | Pull once when Git connected (**skipped** if pull interval is Manual) |
| Local persist | Debounced push (~3s) (**skipped** if Manual) |
| Pull interval (15/30/60 min) | `chrome.alarms` in service worker |
| Pull interval Manual (`-1`) | No auto pull/push; Settings shows **Pull** / **Push** |
| Sync now | LWW: pull then push if local wins / remote missing (hidden in Manual) |
| Force Pull | Always overwrite local with remote (repo wins; no LWW) |
| Force Push | Always overwrite remote with local (local wins; bumps `meta.updatedAt`) |

## Extending providers

1. Implement `GitSyncProvider` in `providers/<id>.ts`
2. `registerGitProvider` in `registry.ts`
3. Add id to `GitProviderId`
4. Add host_permissions as needed
