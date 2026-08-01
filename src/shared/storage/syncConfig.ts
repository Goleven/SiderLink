import { createDefaultSyncConfig } from '../defaults'
import type { StorageAreaLike } from '../browser/types'
import type {
  GitProviderId,
  PullIntervalMinutes,
  SyncLocalConfig,
  SyncMode,
} from '../types'
import { SYNC_CONFIG_KEY } from './keys'

/** Sentinel: user-driven sync only; disables activate pull, debounce push, alarms. */
export const MANUAL_PULL_INTERVAL = -1 as const satisfies PullIntervalMinutes

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSyncMode(value: unknown): value is SyncMode {
  return value === 'off' || value === 'manual' || value === 'git'
}

function isProvider(value: unknown): value is GitProviderId {
  return value === 'github' || value === 'gitee' || value === 'gitlab'
}

function isPullInterval(value: unknown): value is PullIntervalMinutes {
  return (
    value === MANUAL_PULL_INTERVAL ||
    value === 0 ||
    value === 15 ||
    value === 30 ||
    value === 60
  )
}

export function isManualPullInterval(
  value: PullIntervalMinutes,
): boolean {
  return value === MANUAL_PULL_INTERVAL
}

export function parseSyncConfig(raw: unknown): SyncLocalConfig {
  const defaults = createDefaultSyncConfig()
  if (!isObject(raw)) return defaults

  const mode = isSyncMode(raw.mode) ? raw.mode : defaults.mode
  const pullIntervalMinutes = isPullInterval(raw.pullIntervalMinutes)
    ? raw.pullIntervalMinutes
    : defaults.pullIntervalMinutes

  const gitRaw = isObject(raw.git) ? raw.git : {}
  const git = {
    provider: isProvider(gitRaw.provider) ? gitRaw.provider : null,
    connected: typeof gitRaw.connected === 'boolean' ? gitRaw.connected : false,
    owner: typeof gitRaw.owner === 'string' ? gitRaw.owner : '',
    repo: typeof gitRaw.repo === 'string' ? gitRaw.repo : '',
    branch: typeof gitRaw.branch === 'string' ? gitRaw.branch : '',
    filePath:
      typeof gitRaw.filePath === 'string' && gitRaw.filePath
        ? gitRaw.filePath
        : defaults.git.filePath,
    ...(typeof gitRaw.accessToken === 'string'
      ? { accessToken: gitRaw.accessToken }
      : {}),
    ...(typeof gitRaw.refreshToken === 'string'
      ? { refreshToken: gitRaw.refreshToken }
      : {}),
    ...(typeof gitRaw.tokenExpiresAt === 'number'
      ? { tokenExpiresAt: gitRaw.tokenExpiresAt }
      : {}),
  }

  return {
    mode,
    git,
    pullIntervalMinutes,
    ...(typeof raw.lastPullAt === 'number' ? { lastPullAt: raw.lastPullAt } : {}),
    ...(typeof raw.lastPushAt === 'number' ? { lastPushAt: raw.lastPushAt } : {}),
    ...(typeof raw.lastError === 'string' ? { lastError: raw.lastError } : {}),
  }
}

export interface SyncConfigRepository {
  load(): Promise<SyncLocalConfig>
  save(config: SyncLocalConfig): Promise<void>
}

export function createSyncConfigRepository(
  area: StorageAreaLike,
): SyncConfigRepository {
  return {
    async load() {
      const data = await area.get([SYNC_CONFIG_KEY])
      return parseSyncConfig(data[SYNC_CONFIG_KEY])
    },
    async save(config) {
      await area.set({ [SYNC_CONFIG_KEY]: config })
    },
  }
}
