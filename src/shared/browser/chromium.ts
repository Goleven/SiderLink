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

export function createChromiumAdapter(): BrowserAdapter {
  return {
    storage: createStorageArea(),

    async getActiveTab() {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
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
      if (opts.newTab) {
        await chrome.tabs.create({ url })
        return
      }
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      const tab = tabs[0]
      if (tab?.id != null) {
        await chrome.tabs.update(tab.id, { url })
      } else {
        await chrome.tabs.create({ url })
      }
    },
  }
}
