import { createId } from './ids'
import { DEFAULT_GROUP_ICON } from './icons'
import { DEFAULT_LOCALE } from './i18n/locales'
import { translate } from './i18n/messages'
import type { StorageRoot, SyncLocalConfig } from './types'

export const STORAGE_VERSION = 2

export function createDefaultRoot(): StorageRoot {
  return {
    version: STORAGE_VERSION,
    groups: [
      {
        id: createId(),
        name: translate(DEFAULT_LOCALE, 'defaultGroupName'),
        icon: DEFAULT_GROUP_ICON,
        order: 0,
        isDefault: true,
      },
    ],
    bookmarks: [],
    settings: {
      openInNewTab: true,
      indexBarMode: 'icon',
      themeMode: 'system',
      backgroundId: 'neutral',
      locale: DEFAULT_LOCALE,
    },
    meta: {
      updatedAt: Date.now(),
    },
  }
}

export function createDefaultSyncConfig(): SyncLocalConfig {
  return {
    mode: 'off',
    git: {
      provider: null,
      connected: false,
      owner: '',
      repo: '',
      branch: '',
      filePath: 'data/favorites.json',
    },
    pullIntervalMinutes: 0,
  }
}
