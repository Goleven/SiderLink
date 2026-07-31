import type { StorageRoot, SyncLocalConfig } from '../types'
import { createDefaultSyncEngine } from './service'

const PUSH_DEBOUNCE_MS = 3000

let pushTimer: ReturnType<typeof setTimeout> | null = null
let syncing = false

let hooks: {
  onRootReplaced?: (root: StorageRoot) => void | Promise<void>
  onConfigUpdated?: (config: SyncLocalConfig) => void | Promise<void>
} = {}

export function setSyncUiHooks(next: typeof hooks): void {
  hooks = next
}

function engine() {
  return createDefaultSyncEngine(hooks)
}

export function scheduleAutoPush(): void {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void runAutoPush()
  }, PUSH_DEBOUNCE_MS)
}

async function runAutoPush(): Promise<void> {
  if (syncing) {
    scheduleAutoPush()
    return
  }
  syncing = true
  try {
    await engine().push()
  } catch (err) {
    console.error(err)
  } finally {
    syncing = false
  }
}

export async function pullOnActivate(): Promise<void> {
  if (syncing) return
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

export async function runTest(accessToken?: string) {
  return engine().test(accessToken)
}

export async function runSave(accessToken?: string) {
  return engine().save(accessToken)
}

export async function runDisconnect() {
  return engine().disconnect()
}
