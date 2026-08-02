/**
 * MV3 service worker: context menus, side-panel toggle, bookmark search action popup, sync alarm.
 *
 * Runtime message protocol (with sidepanel/main.ts + search/main.ts):
 * - `side-panel-opened` / `side-panel-closed` + windowId → track open panels
 * - `close-side-panel` (SW → panel) → panel calls window.close()
 * - `locale-changed` + locale → rebuild localized menu titles
 * - port name `search-popup` (search action popup → SW) → clear action popup on disconnect
 *
 * Also listens to chrome.storage for group/locale changes (menu rebuild)
 * and sync config changes (alarm schedule).
 */
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

const SEARCH_COMMAND = 'open-bookmark-search'
const SEARCH_POPUP_PATH = 'src/search/index.html'
const SEARCH_POPUP_PORT = 'search-popup'

/** Connected while the search Action Popup is open. */
let searchPopupPort: chrome.runtime.Port | null = null

/**
 * Serialize menu rebuilds — removeAll + create is racy if overlapped.
 * Signature + locale cache skip no-op rebuilds when storage fires repeatedly.
 */
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

/** Ensure toolbar icon opens the side panel, not a leftover search popup. */
void chrome.action.setPopup({ popup: '' }).catch(() => {})

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

/** Stable fingerprint of group id/name/order — used to skip redundant menu rebuilds. */
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

/** Enqueue a rebuild so concurrent storage events never interleave create/remove. */
function scheduleRebuildContextMenus(locale?: AppLocale) {
  menuRebuildChain = menuRebuildChain
    .then(() => rebuildContextMenus(locale))
    .catch((err: unknown) => console.error(err))
}

/** Rebuild only when group list or locale actually changed. */
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

/**
 * Keep chrome.alarms in sync with pullIntervalMinutes.
 * Interval ≤ 0 (including manual -1) clears the alarm; > 0 recreates it.
 */
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

async function clearSearchActionPopup() {
  try {
    await chrome.action.setPopup({ popup: '' })
  } catch (err) {
    console.error(err)
  }
}

function closeSearchActionPopup() {
  const port = searchPopupPort
  if (!port) return false
  try {
    port.postMessage({ type: 'close-search' })
    return true
  } catch {
    searchPopupPort = null
    return false
  }
}

function isBenignOpenPopupError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  // Chrome rejects openPopup when the action popup is already showing.
  return /failed to open popup|no active browser window|already/i.test(message)
}

async function openBookmarkSearchPopup() {
  // Second shortcut press: toggle close instead of failing loudly.
  if (searchPopupPort) {
    closeSearchActionPopup()
    return
  }

  if (typeof chrome.action.openPopup !== 'function') {
    const loc = await readStoredLocale()
    await notify(translate(loc, 'search.openFailed'))
    return
  }

  try {
    await chrome.action.setPopup({ popup: SEARCH_POPUP_PATH })
    await chrome.action.openPopup()
  } catch (err) {
    console.error(err)
    // Race: popup connected between check and openPopup — toggle close.
    if (searchPopupPort && closeSearchActionPopup()) return
    // Chrome rejects when the popup is already open (often before port connects).
    if (isBenignOpenPopupError(err)) return
    await clearSearchActionPopup()
    const loc = await readStoredLocale()
    await notify(translate(loc, 'search.openFailed'))
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== SEARCH_POPUP_PORT) return
  searchPopupPort = port
  port.onDisconnect.addListener(() => {
    if (searchPopupPort === port) searchPopupPort = null
    void clearSearchActionPopup()
  })
})

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'toggle-side-panel') {
    toggleSidePanel(resolveWindowId(tab))
    return
  }
  if (command === SEARCH_COMMAND) {
    void openBookmarkSearchPopup()
  }
})
