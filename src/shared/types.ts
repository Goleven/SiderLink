import type { AppLocale } from './i18n/locales'

export type ThemeMode = 'light' | 'dark' | 'system'
export type IndexBarMode = 'icon' | 'text'
export type { AppLocale }

export interface BookmarkItem {
  id: string
  title: string
  url: string
  faviconUrl?: string
  groupId: string
  order: number
  createdAt: number
  updatedAt: number
}

export interface Group {
  id: string
  name: string
  icon: string
  order: number
  isDefault: boolean
}

export interface Settings {
  openInNewTab: boolean
  indexBarMode: IndexBarMode
  themeMode: ThemeMode
  backgroundId: string
  locale: AppLocale
}

export interface StorageMeta {
  updatedAt: number
}

export interface StorageRoot {
  version: number
  groups: Group[]
  bookmarks: BookmarkItem[]
  settings: Settings
  meta: StorageMeta
}

export type SyncMode = 'off' | 'manual' | 'git'
export type GitProviderId = 'github' | 'gitee' | 'gitlab'
export type PullIntervalMinutes = 0 | 15 | 30 | 60

export interface GitSyncSettings {
  provider: GitProviderId | null
  connected: boolean
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: number
  owner: string
  repo: string
  branch: string
  filePath: string
}

export interface SyncLocalConfig {
  mode: SyncMode
  git: GitSyncSettings
  pullIntervalMinutes: PullIntervalMinutes
  lastPullAt?: number
  lastPushAt?: number
  lastError?: string
}
