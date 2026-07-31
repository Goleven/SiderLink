import { isRestrictedTabUrl } from '@/shared/browser/types'
import { addBookmark, sortGroups } from '@/shared/domain'
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from '@/shared/i18n/locales'
import { translate } from '@/shared/i18n/messages'
import { STORAGE_KEY, SYNC_ALARM_NAME, SYNC_CONFIG_KEY } from '@/shared/storage/keys'
import { createRepository } from '@/shared/storage/repository'
import { parseSyncConfig } from '@/shared/storage/syncConfig'
import { createDefaultSyncEngine } from '@/shared/sync/service'
import type { Group, StorageRoot } from '@/shared/types'

const ROOT_MENU_ID = 'sider-link-root'
const TOGGLE_MENU_ID = 'toggle-side-panel'
const SEP_MENU_ID = 'sider-link-sep'
const ADD_PAGE_MENU_ID = 'add-current-page'
const ADD_PAGE_CHILD_PREFIX = `${ADD_PAGE_MENU_ID}:`

/** Windows where the side panel is currently open (synced from the panel page). */
const openSidePanels = new Set<number>()

let menuRebuildChain: Promise<void> = Promise.resolve()
let lastGroupsSignature = ''
let lastMenuLocale: AppLocale | null = null

const storageArea = {
  async get(keys: string | string[]) {
    const result = await chrome.storage.local.get(keys)
    return result as Record<string, unknown>
  },
  async set(items: Record<string, unknown>) {
    await chrome.storage.local.set(items)
  },
}

const favoritesRepo = createRepository(storageArea)

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err: unknown) => console.error(err))

async function readStoredLocale(): Promise<AppLocale> {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY)
    const root = data[STORAGE_KEY] as StorageRoot | undefined
    const locale = root?.settings?.locale
    return isAppLocale(locale) ? locale : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

function groupsSignature(groups: Group[]): string {
  return sortGroups(groups)
    .map((g) => `${g.id}\0${g.name}\0${g.order}`)
    .join('\n')
}

function createMenu(
  createProperties: chrome.contextMenus.CreateProperties,
): Promise<void> {
  return new Promise((resolve) => {
    chrome.contextMenus.create(createProperties, () => {
      void chrome.runtime.lastError
      resolve()
    })
  })
}

function removeAllMenus(): Promise<void> {
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => {
      void chrome.runtime.lastError
      resolve()
    })
  })
}

async function rebuildContextMenus(locale?: AppLocale) {
  const loc = locale ?? (await readStoredLocale())
  let groups: Group[] = []
  try {
    const root = await favoritesRepo.load()
    groups = sortGroups(root.groups)
  } catch (err) {
    console.error(err)
  }

  await removeAllMenus()

  // Fixed order: toggle → separator → groups (sortGroups order)
  await createMenu({
    id: ROOT_MENU_ID,
    title: translate(loc, 'contextMenu.root'),
    contexts: ['all'],
  })

  await createMenu({
    id: TOGGLE_MENU_ID,
    parentId: ROOT_MENU_ID,
    title: translate(loc, 'contextMenu.toggleSidePanel'),
    contexts: ['all'],
  })

  await createMenu({
    id: SEP_MENU_ID,
    parentId: ROOT_MENU_ID,
    type: 'separator',
    contexts: ['all'],
  })

  for (const group of groups) {
    await createMenu({
      id: `${ADD_PAGE_CHILD_PREFIX}${group.id}`,
      parentId: ROOT_MENU_ID,
      title: `+ ${group.name}`,
      contexts: ['all'],
    })
  }

  lastGroupsSignature = groupsSignature(groups)
  lastMenuLocale = loc
}

function scheduleRebuildContextMenus(locale?: AppLocale) {
  menuRebuildChain = menuRebuildChain
    .then(() => rebuildContextMenus(locale))
    .catch((err: unknown) => console.error(err))
}

function scheduleRebuildIfGroupsOrLocaleChanged(root: StorageRoot | undefined) {
  if (!root) {
    scheduleRebuildContextMenus()
    return
  }
  const locale = isAppLocale(root.settings?.locale)
    ? root.settings.locale
    : undefined
  const sig = groupsSignature(root.groups)
  const loc = locale ?? lastMenuLocale
  if (sig === lastGroupsSignature && loc === lastMenuLocale) return
  scheduleRebuildContextMenus(locale)
}

async function notify(message: string) {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'Sider Link',
      message,
    })
  } catch (err) {
    console.error(err)
  }
}

async function addCurrentPage(tab: chrome.tabs.Tab | undefined, groupId: string) {
  const loc = await readStoredLocale()
  const url = tab?.url
  if (!url || isRestrictedTabUrl(url)) {
    await notify(translate(loc, 'contextMenu.addRestricted'))
    return
  }

  try {
    const root = await favoritesRepo.load()
    const next = addBookmark(root, {
      title: tab?.title || url,
      url,
      faviconUrl: tab?.favIconUrl,
      groupId,
    })
    await favoritesRepo.save({
      ...next,
      meta: { updatedAt: Date.now() },
    })
    await notify(translate(loc, 'toast.added'))
  } catch (err) {
    console.error(err)
    await notify(translate(loc, 'contextMenu.addFailed'))
  }
}

async function refreshSyncAlarm() {
  try {
    const data = await chrome.storage.local.get(SYNC_CONFIG_KEY)
    const config = parseSyncConfig(data[SYNC_CONFIG_KEY])
    await chrome.alarms.clear(SYNC_ALARM_NAME)
    if (
      config.mode === 'git' &&
      config.git.connected &&
      config.pullIntervalMinutes > 0
    ) {
      await chrome.alarms.create(SYNC_ALARM_NAME, {
        periodInMinutes: config.pullIntervalMinutes,
      })
    }
  } catch (err) {
    console.error(err)
  }
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleRebuildContextMenus()
  void refreshSyncAlarm()
})

scheduleRebuildContextMenus()
void refreshSyncAlarm()

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== SYNC_ALARM_NAME) return
  void createDefaultSyncEngine()
    .pull()
    .catch((err: unknown) => console.error(err))
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes[SYNC_CONFIG_KEY]) {
    void refreshSyncAlarm()
  }
  if (changes[STORAGE_KEY]) {
    const root = changes[STORAGE_KEY].newValue as StorageRoot | undefined
    scheduleRebuildIfGroupsOrLocaleChanged(root)
  }
})

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'locale-changed' && isAppLocale(message.locale)) {
    scheduleRebuildContextMenus(message.locale)
    return
  }

  const windowId =
    typeof message?.windowId === 'number'
      ? message.windowId
      : sender.tab?.windowId

  if (message?.type === 'side-panel-opened' && typeof windowId === 'number') {
    openSidePanels.add(windowId)
    return
  }

  if (message?.type === 'side-panel-closed' && typeof windowId === 'number') {
    openSidePanels.delete(windowId)
  }
})

function resolveWindowId(tab?: chrome.tabs.Tab): number {
  if (tab?.windowId != null) return tab.windowId
  return chrome.windows.WINDOW_ID_CURRENT
}

async function closeSidePanel(windowId: number) {
  openSidePanels.delete(windowId)
  if (chrome.sidePanel.close) {
    try {
      await chrome.sidePanel.close({ windowId })
      return
    } catch (err) {
      console.error(err)
    }
  }
  await chrome.runtime
    .sendMessage({ type: 'close-side-panel' })
    .catch(() => {})
}

/**
 * Toggle must call sidePanel.open synchronously on the user-gesture stack.
 * Never await before open — Chrome drops the gesture after a microtask.
 */
function toggleSidePanel(windowId: number) {
  const isCurrent = windowId === chrome.windows.WINDOW_ID_CURRENT
  const isOpen = isCurrent
    ? openSidePanels.size > 0
    : openSidePanels.has(windowId)

  if (isOpen) {
    if (isCurrent) {
      const ids = [...openSidePanels]
      if (ids.length === 0) {
        void chrome.runtime
          .sendMessage({ type: 'close-side-panel' })
          .catch(() => {})
        return
      }
      for (const id of ids) void closeSidePanel(id)
      return
    }
    void closeSidePanel(windowId)
    return
  }

  if (!isCurrent) openSidePanels.add(windowId)
  try {
    const maybePromise = chrome.sidePanel.open({ windowId })
    if (maybePromise && typeof maybePromise.then === 'function') {
      void maybePromise.catch((err: unknown) => {
        if (!isCurrent) openSidePanels.delete(windowId)
        console.error(err)
      })
    }
  } catch (err) {
    if (!isCurrent) openSidePanels.delete(windowId)
    console.error(err)
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const menuId = String(info.menuItemId)
  if (menuId === TOGGLE_MENU_ID) {
    toggleSidePanel(resolveWindowId(tab))
    return
  }
  if (!menuId.startsWith(ADD_PAGE_CHILD_PREFIX)) return
  const groupId = menuId.slice(ADD_PAGE_CHILD_PREFIX.length)
  if (groupId) void addCurrentPage(tab, groupId)
})

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'toggle-side-panel') return
  toggleSidePanel(resolveWindowId(tab))
})
