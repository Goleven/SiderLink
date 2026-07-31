import { getBrowser } from '../browser'
import { createRepository } from '../storage/repository'
import {
  createSyncConfigRepository,
  type SyncConfigRepository,
} from '../storage/syncConfig'
import type { FavoritesRepository } from '../storage/repository'
import type { StorageRoot, SyncLocalConfig } from '../types'
import { parseRootJson, serializeRoot } from './exportImport'
import { chooseLwwWinner } from './lww'
import { getGitProvider } from './providers/registry'
import type { GitRepoRef } from './providers/types'
import './providers/registry'

export type SyncResult =
  | { ok: true; action: 'pulled' | 'pushed' | 'noop' | 'connected' | 'tested' | 'saved' }
  | { ok: false; error: string }

function withError(
  config: SyncLocalConfig,
  error: string,
): SyncLocalConfig {
  return { ...config, lastError: error }
}

function clearError(config: SyncLocalConfig): SyncLocalConfig {
  const next = { ...config }
  delete next.lastError
  return next
}

function requireGitReady(config: SyncLocalConfig): {
  token: string
  ref: GitRepoRef
  providerId: NonNullable<SyncLocalConfig['git']['provider']>
} {
  const { git } = config
  if (!git.connected || !git.provider || !git.accessToken) {
    throw new Error('sync.notConnected')
  }
  if (!git.owner.trim() || !git.repo.trim()) {
    throw new Error('sync.repoRequired')
  }
  return {
    token: git.accessToken,
    providerId: git.provider,
    ref: {
      owner: git.owner.trim(),
      repo: git.repo.trim(),
      branch: git.branch.trim() || undefined,
      path: git.filePath.trim() || 'data/favorites.json',
    },
  }
}

async function validateRepoAccess(
  config: SyncLocalConfig,
  accessToken: string,
): Promise<void> {
  if (!config.git.provider) throw new Error('sync.providerRequired')
  if (!config.git.owner.trim() || !config.git.repo.trim()) {
    throw new Error('sync.repoRequired')
  }
  const provider = getGitProvider(config.git.provider)
  const auth = { accessToken }
  const owner = config.git.owner.trim()
  const repo = config.git.repo.trim()
  if (provider.getDefaultBranch) {
    await provider.getDefaultBranch(auth, { owner, repo })
  } else {
    await provider.getFile(auth, {
      owner,
      repo,
      path: config.git.filePath.trim() || 'data/favorites.json',
      branch: config.git.branch.trim() || undefined,
    })
  }
}

export interface SyncEngineDeps {
  rootRepo: FavoritesRepository
  syncRepo: SyncConfigRepository
  onRootReplaced?: (root: StorageRoot) => void | Promise<void>
  onConfigUpdated?: (config: SyncLocalConfig) => void | Promise<void>
}

export function createSyncEngine(deps: SyncEngineDeps) {
  async function loadConfig(): Promise<SyncLocalConfig> {
    return deps.syncRepo.load()
  }

  async function saveConfig(config: SyncLocalConfig): Promise<void> {
    await deps.syncRepo.save(config)
    await deps.onConfigUpdated?.(config)
  }

  async function loadRoot(): Promise<StorageRoot> {
    return deps.rootRepo.load()
  }

  async function saveRoot(
    root: StorageRoot,
    source: 'local' | 'remote',
  ): Promise<void> {
    await deps.rootRepo.save(root)
    if (source === 'remote') {
      await deps.onRootReplaced?.(root)
    }
  }

  /** Validate token + repo without persisting. */
  async function test(accessToken?: string): Promise<SyncResult> {
    let config = await loadConfig()
    try {
      const token = (accessToken?.trim() || config.git.accessToken || '').trim()
      if (!token) throw new Error('sync.tokenRequired')
      await validateRepoAccess(config, token)
      config = clearError(config)
      await saveConfig(config)
      return { ok: true, action: 'tested' }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'sync.connectFailed'
      await saveConfig(withError(config, message))
      return { ok: false, error: message }
    }
  }

  /** Persist git settings + optional new PAT; does not sync. */
  async function save(accessToken?: string): Promise<SyncResult> {
    let config = await loadConfig()
    try {
      const incoming = accessToken?.trim() || ''
      const token = incoming || config.git.accessToken || ''
      if (!token) throw new Error('sync.tokenRequired')
      if (!config.git.provider) throw new Error('sync.providerRequired')
      if (!config.git.owner.trim() || !config.git.repo.trim()) {
        throw new Error('sync.repoRequired')
      }

      const git = {
        ...config.git,
        connected: true,
        accessToken: token,
      }
      delete git.refreshToken
      delete git.tokenExpiresAt
      config = clearError({
        ...config,
        mode: 'git',
        git,
      })
      await saveConfig(config)
      return { ok: true, action: 'saved' }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'sync.connectFailed'
      await saveConfig(withError(config, message))
      return { ok: false, error: message }
    }
  }

  async function disconnect(): Promise<SyncResult> {
    const config = await loadConfig()
    const next: SyncLocalConfig = {
      ...config,
      git: {
        ...config.git,
        connected: false,
      },
    }
    delete next.git.accessToken
    delete next.git.refreshToken
    delete next.git.tokenExpiresAt
    delete next.lastError
    await saveConfig(next)
    return { ok: true, action: 'noop' }
  }

  async function pull(): Promise<SyncResult> {
    let config = await loadConfig()
    try {
      if (config.mode !== 'git') return { ok: true, action: 'noop' }
      const { token, ref, providerId } = requireGitReady(config)
      const provider = getGitProvider(providerId)
      const remoteFile = await provider.getFile({ accessToken: token }, ref)
      const local = await loadRoot()

      if (!remoteFile) {
        config = { ...clearError(config), lastPullAt: Date.now() }
        await saveConfig(config)
        return { ok: true, action: 'noop' }
      }

      const remote = parseRootJson(remoteFile.content)
      const winner = chooseLwwWinner(local, remote)
      if (winner === 'remote') {
        await saveRoot(remote, 'remote')
      }

      config = { ...clearError(config), lastPullAt: Date.now() }
      await saveConfig(config)
      return { ok: true, action: winner === 'remote' ? 'pulled' : 'noop' }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'sync.pullFailed'
      await saveConfig(withError(config, message))
      return { ok: false, error: message }
    }
  }

  async function push(): Promise<SyncResult> {
    let config = await loadConfig()
    try {
      if (config.mode !== 'git') return { ok: true, action: 'noop' }
      const { token, ref, providerId } = requireGitReady(config)
      const provider = getGitProvider(providerId)
      const local = await loadRoot()
      const remoteFile = await provider.getFile({ accessToken: token }, ref)

      let sha: string | null = null
      if (remoteFile) {
        const remote = parseRootJson(remoteFile.content)
        const winner = chooseLwwWinner(local, remote)
        if (winner === 'remote') {
          await saveRoot(remote, 'remote')
          config = { ...clearError(config), lastPullAt: Date.now() }
          await saveConfig(config)
          return { ok: true, action: 'pulled' }
        }
        sha = remoteFile.sha
      }

      try {
        await provider.putFile(
          { accessToken: token },
          ref,
          serializeRoot(local),
          sha,
          'chore: sync favorites',
        )
      } catch (e) {
        if (e instanceof Error && e.message === 'sync.conflict') {
          return syncNow()
        }
        throw e
      }

      config = { ...clearError(config), lastPushAt: Date.now() }
      await saveConfig(config)
      return { ok: true, action: 'pushed' }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'sync.pushFailed'
      await saveConfig(withError(config, message))
      return { ok: false, error: message }
    }
  }

  /** Check remote file; if missing push local; else LWW pull/push. */
  async function syncNow(): Promise<SyncResult> {
    let config = await loadConfig()
    try {
      if (config.mode !== 'git') return { ok: true, action: 'noop' }
      const { token, ref, providerId } = requireGitReady(config)
      const provider = getGitProvider(providerId)
      const local = await loadRoot()
      const remoteFile = await provider.getFile({ accessToken: token }, ref)

      if (!remoteFile) {
        await provider.putFile(
          { accessToken: token },
          ref,
          serializeRoot(local),
          null,
          'chore: sync favorites',
        )
        config = { ...clearError(config), lastPushAt: Date.now() }
        await saveConfig(config)
        return { ok: true, action: 'pushed' }
      }

      const remote = parseRootJson(remoteFile.content)
      const winner = chooseLwwWinner(local, remote)
      if (winner === 'remote') {
        await saveRoot(remote, 'remote')
        config = { ...clearError(config), lastPullAt: Date.now() }
        await saveConfig(config)
        return { ok: true, action: 'pulled' }
      }
      if (winner === 'local') {
        await provider.putFile(
          { accessToken: token },
          ref,
          serializeRoot(local),
          remoteFile.sha,
          'chore: sync favorites',
        )
        config = { ...clearError(config), lastPushAt: Date.now() }
        await saveConfig(config)
        return { ok: true, action: 'pushed' }
      }

      config = { ...clearError(config), lastPullAt: Date.now() }
      await saveConfig(config)
      return { ok: true, action: 'noop' }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'sync.pushFailed'
      await saveConfig(withError(config, message))
      return { ok: false, error: message }
    }
  }

  return {
    test,
    save,
    disconnect,
    pull,
    push,
    syncNow,
  }
}

export function createDefaultSyncEngine(hooks?: {
  onRootReplaced?: (root: StorageRoot) => void | Promise<void>
  onConfigUpdated?: (config: SyncLocalConfig) => void | Promise<void>
}) {
  const browser = getBrowser()
  return createSyncEngine({
    rootRepo: createRepository(browser.storage),
    syncRepo: createSyncConfigRepository(browser.storage),
    onRootReplaced: hooks?.onRootReplaced,
    onConfigUpdated: hooks?.onConfigUpdated,
  })
}
