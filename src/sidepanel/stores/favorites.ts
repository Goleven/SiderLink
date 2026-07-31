import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getBrowser } from '@/shared/browser'
import { createDefaultRoot, createDefaultSyncConfig } from '@/shared/defaults'
import {
  addBookmark as domainAddBookmark,
  addGroup as domainAddGroup,
  deleteBookmark as domainDeleteBookmark,
  deleteGroup as domainDeleteGroup,
  moveBookmark as domainMoveBookmark,
  patchSettings as domainPatchSettings,
  reorderGroups as domainReorderGroups,
  updateBookmark as domainUpdateBookmark,
  updateGroup as domainUpdateGroup,
} from '@/shared/domain'
import { createRepository } from '@/shared/storage/repository'
import { createSyncConfigRepository } from '@/shared/storage/syncConfig'
import type { Settings, StorageRoot, SyncLocalConfig } from '@/shared/types'
import { scheduleAutoPush } from '@/shared/sync/scheduler'

export const useFavoritesStore = defineStore('favorites', () => {
  const root = ref<StorageRoot | null>(null)
  const syncConfig = ref<SyncLocalConfig>(createDefaultSyncConfig())
  const storageError = ref<string | null>(null)
  const loading = ref(false)

  const browser = getBrowser()
  const repo = createRepository(browser.storage)
  const syncRepo = createSyncConfigRepository(browser.storage)

  const groups = computed(() => root.value?.groups ?? [])
  const bookmarks = computed(() => root.value?.bookmarks ?? [])
  const settings = computed(
    () =>
      root.value?.settings ?? {
        openInNewTab: true,
        indexBarMode: 'icon' as const,
        themeMode: 'system' as const,
        backgroundId: 'neutral',
        locale: 'zh-CN' as const,
      },
  )

  async function load() {
    loading.value = true
    try {
      root.value = await repo.load()
      syncConfig.value = await syncRepo.load()
      storageError.value = null
    } catch {
      storageError.value = 'storage.readFailed'
      if (!root.value) {
        root.value = createDefaultRoot()
      }
    } finally {
      loading.value = false
    }
  }

  async function retryLoad() {
    await load()
  }

  async function persist(next: StorageRoot, opts?: { touch?: boolean }) {
    const prev = root.value
    const toSave =
      opts?.touch === false
        ? next
        : {
            ...next,
            meta: { updatedAt: Date.now() },
          }
    root.value = toSave
    try {
      await repo.save(toSave)
      storageError.value = null
      if (opts?.touch !== false) {
        scheduleAutoPush()
      }
    } catch {
      root.value = prev
      storageError.value = 'storage.saveFailed'
      throw new Error('save failed')
    }
  }

  async function replaceRoot(next: StorageRoot) {
    await persist(next, { touch: false })
  }

  function applyRootLocal(next: StorageRoot) {
    root.value = next
  }

  async function saveSyncConfig(next: SyncLocalConfig) {
    syncConfig.value = next
    await syncRepo.save(next)
  }

  function applySyncConfigLocal(next: SyncLocalConfig) {
    syncConfig.value = next
  }

  function requireRoot(): StorageRoot {
    if (!root.value) throw new Error('storage.notLoaded')
    return root.value
  }

  async function addBookmark(input: {
    title: string
    url: string
    faviconUrl?: string
    groupId: string
  }) {
    await persist(domainAddBookmark(requireRoot(), input))
  }

  async function updateBookmark(
    id: string,
    patch: {
      title?: string
      url?: string
      faviconUrl?: string | null
      groupId?: string
    },
  ) {
    await persist(domainUpdateBookmark(requireRoot(), id, patch))
  }

  async function deleteBookmark(id: string) {
    await persist(domainDeleteBookmark(requireRoot(), id))
  }

  async function addGroup(input: { name: string; icon: string }) {
    const prev = new Set(requireRoot().groups.map((g) => g.id))
    await persist(domainAddGroup(requireRoot(), input))
    return requireRoot().groups.find((g) => !prev.has(g.id))?.id
  }

  async function updateGroup(
    id: string,
    patch: { name?: string; icon?: string },
  ) {
    await persist(domainUpdateGroup(requireRoot(), id, patch))
  }

  async function deleteGroup(id: string) {
    await persist(domainDeleteGroup(requireRoot(), id))
  }

  async function reorderGroups(orderedIds: string[]) {
    await persist(domainReorderGroups(requireRoot(), orderedIds))
  }

  async function moveBookmark(
    bookmarkId: string,
    toGroupId: string,
    toIndex: number,
  ) {
    await persist(
      domainMoveBookmark(requireRoot(), bookmarkId, toGroupId, toIndex),
    )
  }

  async function patchSettings(patch: Partial<Settings>) {
    await persist(domainPatchSettings(requireRoot(), patch))
  }

  async function openBookmark(id: string) {
    const item = requireRoot().bookmarks.find((b) => b.id === id)
    if (!item) return
    await browser.openUrl(item.url, {
      newTab: requireRoot().settings.openInNewTab,
    })
  }

  async function fetchActiveTab() {
    return browser.getActiveTab()
  }

  return {
    root,
    syncConfig,
    storageError,
    loading,
    groups,
    bookmarks,
    settings,
    load,
    retryLoad,
    replaceRoot,
    applyRootLocal,
    saveSyncConfig,
    applySyncConfigLocal,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    addGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
    moveBookmark,
    patchSettings,
    openBookmark,
    fetchActiveTab,
  }
})
