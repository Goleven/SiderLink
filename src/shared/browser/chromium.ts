import type { StorageAreaLike } from './types'
import type { ActiveTabInfo, BrowserAdapter } from './types'
import { isRestrictedTabUrl } from './types'

function createStorageArea(): StorageAreaLike {
  return {
    async get(keys) {
      const result = await chrome.storage.local.get(keys)
      return result as Record<string, unknown>
    },
    async set(items) {
      await chrome.storage.local.set(items)
    },
  }
}

/** Last-focused normal browser window (never an extension popup). */
async function resolveHostWindowId(): Promise<number | undefined> {
  try {
    const win = await chrome.windows.getLastFocused({
      windowTypes: ['normal'],
    })
    if (win?.id != null) return win.id
  } catch {
    /* ignore */
  }
  try {
    const all = await chrome.windows.getAll({ windowTypes: ['normal'] })
    return all[0]?.id
  } catch {
    return undefined
  }
}

export function createChromiumAdapter(): BrowserAdapter {
  return {
    storage: createStorageArea(),

    async getActiveTab() {
      const windowId = await resolveHostWindowId()
      const tabs = await chrome.tabs.query({
        active: true,
        ...(windowId != null ? { windowId } : { currentWindow: true }),
      })
      const tab = tabs[0]
      if (!tab || isRestrictedTabUrl(tab.url)) return null
      const info: ActiveTabInfo = {
        title: tab.title || tab.url || 'Untitled',
        url: tab.url!,
      }
      if (tab.favIconUrl) info.favIconUrl = tab.favIconUrl
      return info
    },

    async openUrl(url, opts) {
      const windowId = await resolveHostWindowId()
      if (opts.newTab) {
        await chrome.tabs.create({
          url,
          ...(windowId != null ? { windowId } : {}),
        })
        return
      }
      const tabs = await chrome.tabs.query({
        active: true,
        ...(windowId != null ? { windowId } : { currentWindow: true }),
      })
      const tab = tabs[0]
      if (tab?.id != null) {
        await chrome.tabs.update(tab.id, { url })
        if (windowId != null) {
          await chrome.windows.update(windowId, { focused: true }).catch(() => {})
        }
      } else {
        await chrome.tabs.create({
          url,
          ...(windowId != null ? { windowId } : {}),
        })
      }
    },
  }
}
