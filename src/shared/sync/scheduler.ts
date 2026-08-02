/**
 * Side-panel sync orchestration (debounced auto-push + activate pull).
 *
 * Distinct from the SW alarm path in `background/index.ts`:
 * - Alarm → periodic `engine.pull()` when `pullIntervalMinutes > 0`
 * - Here → UI-driven: local edits debounce into `push`; panel open runs `pull`
 *
 * Auto sync is disabled when `pullIntervalMinutes === -1` (manual-only mode).
 * A process-local `syncing` lock serializes overlapping push/pull; if a push
 * is requested while busy, it reschedules rather than dropping the change.
 */
import { getBrowser } from '../browser'
import {
  createSyncConfigRepository,
  isManualPullInterval,
} from '../storage/syncConfig'
import type { StorageRoot, SyncLocalConfig } from '../types'
import { createDefaultSyncEngine } from './service'

/** Coalesce rapid local edits (drag, form save) into one push. */
const PUSH_DEBOUNCE_MS = 3000

let pushTimer: ReturnType<typeof setTimeout> | null = null
/** Prevents concurrent engine calls within this JS context. */
let syncing = false

let hooks: {
  onRootReplaced?: (root: StorageRoot) => void | Promise<void>
  onConfigUpdated?: (config: SyncLocalConfig) => void | Promise<void>
} = {}

/** Wire store/UI callbacks so remote replaces update Pinia without a second write. */
export function setSyncUiHooks(next: typeof hooks): void {
  hooks = next
}

function engine() {
  return createDefaultSyncEngine(hooks)
}

async function loadConfig(): Promise<SyncLocalConfig> {
  return createSyncConfigRepository(getBrowser().storage).load()
}

/** Git connected and not in manual-only pull interval (-1). */
async function allowsAutoSync(): Promise<boolean> {
  const config = await loadConfig()
  return (
    config.mode === 'git' &&
    config.git.connected &&
    !isManualPullInterval(config.pullIntervalMinutes)
  )
}

/** Debounced push after local persist (favorites store `touch !== false`). */
export function scheduleAutoPush(): void {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void runAutoPush()
  }, PUSH_DEBOUNCE_MS)
}

async function runAutoPush(): Promise<void> {
  if (syncing) {
    // Still busy (e.g. activate pull) — try again after another debounce.
    scheduleAutoPush()
    return
  }
  if (!(await allowsAutoSync())) return
  syncing = true
  try {
    await engine().push()
  } catch (err) {
    console.error(err)
  } finally {
    syncing = false
  }
}

/** One-shot pull when the side panel becomes active; skips if already syncing. */
export async function pullOnActivate(): Promise<void> {
  if (syncing) return
  if (!(await allowsAutoSync())) return
  syncing = true
  try {
    await engine().pull()
  } catch (err) {
    console.error(err)
  } finally {
    syncing = false
  }
}

export async function runSyncNow() {
  return engine().syncNow()
}

export async function runForcePull() {
  return engine().forcePull()
}

export async function runForcePush() {
  return engine().forcePush()
}

export async function runTest(accessToken?: string) {
  return engine().test(accessToken)
}

export async function runSave(accessToken?: string) {
  return engine().save(accessToken)
}

export async function runDisconnect() {
  return engine().disconnect()
}
