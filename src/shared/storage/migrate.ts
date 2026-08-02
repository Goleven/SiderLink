/**
 * Normalize raw chrome.storage / import JSON into a valid StorageRoot.
 *
 * Two failure modes:
 * - **Structural corruption** (wrong version, missing arrays, unparseable
 *   items/settings) → reset to `createDefaultRoot()`, set `backedUp: true`
 *   so the repository can preserve the original blob under BACKUP_KEY.
 * - **Soft repair** (missing/duplicate default group, orphan bookmarks,
 *   version bump, missing meta) → keep data, set `repaired: true` only;
 *   `backedUp` stays false (no backup write needed).
 */
import { createDefaultRoot, STORAGE_VERSION } from '../defaults'
import { createId } from '../ids'
import { DEFAULT_GROUP_ICON, resolveGroupIconId } from '../icons'
import { DEFAULT_LOCALE, isAppLocale } from '../i18n/locales'
import { translate } from '../i18n/messages'
import type {
  BookmarkItem,
  Group,
  Settings,
  StorageMeta,
  StorageRoot,
  ThemeMode,
  IndexBarMode,
} from '../types'

export interface MigrateResult {
  root: StorageRoot
  /** Soft fixes applied (default group, orphans, version/meta). */
  repaired: boolean
  /** Irrecoverable shape → reset to defaults; caller should back up raw. */
  backedUp: boolean
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function isIndexBarMode(value: unknown): value is IndexBarMode {
  return value === 'icon' || value === 'text'
}

function parseSettings(raw: unknown): Settings | null {
  if (!isObject(raw)) return null
  if (typeof raw.openInNewTab !== 'boolean') return null
  if (!isIndexBarMode(raw.indexBarMode)) return null
  if (!isThemeMode(raw.themeMode)) return null
  if (typeof raw.backgroundId !== 'string' || !raw.backgroundId) return null
  const locale = isAppLocale(raw.locale) ? raw.locale : DEFAULT_LOCALE
  // Missing flag → treat as completed so existing installs are not interrupted.
  const hasCompletedTour =
    typeof raw.hasCompletedTour === 'boolean' ? raw.hasCompletedTour : true
  return {
    openInNewTab: raw.openInNewTab,
    indexBarMode: raw.indexBarMode,
    themeMode: raw.themeMode,
    backgroundId: raw.backgroundId,
    locale,
    hasCompletedTour,
  }
}

function parseMeta(raw: unknown): StorageMeta {
  if (isObject(raw) && typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)) {
    return { updatedAt: raw.updatedAt }
  }
  return { updatedAt: Date.now() }
}

function parseGroup(raw: unknown): Group | null {
  if (!isObject(raw)) return null
  if (typeof raw.id !== 'string' || !raw.id) return null
  if (typeof raw.name !== 'string') return null
  if (typeof raw.icon !== 'string') return null
  if (typeof raw.order !== 'number' || !Number.isFinite(raw.order)) return null
  if (typeof raw.isDefault !== 'boolean') return null
  return {
    id: raw.id,
    name: raw.name,
    icon: resolveGroupIconId(raw.icon),
    order: raw.order,
    isDefault: raw.isDefault,
  }
}

function parseBookmark(raw: unknown): BookmarkItem | null {
  if (!isObject(raw)) return null
  if (typeof raw.id !== 'string' || !raw.id) return null
  if (typeof raw.title !== 'string') return null
  if (typeof raw.url !== 'string') return null
  if (typeof raw.groupId !== 'string') return null
  if (typeof raw.order !== 'number' || !Number.isFinite(raw.order)) return null
  if (typeof raw.createdAt !== 'number') return null
  if (typeof raw.updatedAt !== 'number') return null
  const item: BookmarkItem = {
    id: raw.id,
    title: raw.title,
    url: raw.url,
    groupId: raw.groupId,
    order: raw.order,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  }
  if (typeof raw.faviconUrl === 'string') {
    item.faviconUrl = raw.faviconUrl
  }
  return item
}

/** Ensure exactly one default group: create if missing, demote extras. */
function ensureDefaultGroup(groups: Group[]): { groups: Group[]; repaired: boolean } {
  let repaired = false
  const defaults = groups.filter((g) => g.isDefault)
  let next = groups.map((g) => ({ ...g }))

  if (defaults.length === 0) {
    next.push({
      id: createId(),
      name: translate(DEFAULT_LOCALE, 'defaultGroupName'),
      icon: DEFAULT_GROUP_ICON,
      order: next.length,
      isDefault: true,
    })
    repaired = true
  } else if (defaults.length > 1) {
    // Keep the first default; clear isDefault on the rest.
    let kept = false
    next = next.map((g) => {
      if (!g.isDefault) return g
      if (!kept) {
        kept = true
        return g
      }
      repaired = true
      return { ...g, isDefault: false }
    })
  }

  return { groups: next, repaired }
}

/** Re-home bookmarks whose groupId no longer exists into the default group. */
function repairBookmarks(
  bookmarks: BookmarkItem[],
  groups: Group[],
): { bookmarks: BookmarkItem[]; repaired: boolean } {
  const defaultGroup = groups.find((g) => g.isDefault)
  if (!defaultGroup) {
    return { bookmarks, repaired: false }
  }
  const ids = new Set(groups.map((g) => g.id))
  let repaired = false
  const next = bookmarks.map((b) => {
    if (!ids.has(b.groupId)) {
      repaired = true
      return { ...b, groupId: defaultGroup.id }
    }
    return b
  })
  return { bookmarks: next, repaired }
}

function isSupportedVersion(version: unknown): version is number {
  return version === 1 || version === 2 || version === 3
}

export function migrate(raw: unknown): MigrateResult {
  // First install / empty storage — defaults, no repair flag.
  if (raw == null) {
    return { root: createDefaultRoot(), repaired: false, backedUp: false }
  }

  // Hard failures below: reset + ask repository to back up the raw blob.
  if (!isObject(raw) || !isSupportedVersion(raw.version)) {
    return { root: createDefaultRoot(), repaired: true, backedUp: true }
  }

  if (!Array.isArray(raw.groups) || !Array.isArray(raw.bookmarks)) {
    return { root: createDefaultRoot(), repaired: true, backedUp: true }
  }

  const settings = parseSettings(raw.settings)
  if (!settings) {
    return { root: createDefaultRoot(), repaired: true, backedUp: true }
  }

  const groups: Group[] = []
  for (const g of raw.groups) {
    const parsed = parseGroup(g)
    if (!parsed) {
      return { root: createDefaultRoot(), repaired: true, backedUp: true }
    }
    groups.push(parsed)
  }

  const bookmarks: BookmarkItem[] = []
  for (const b of raw.bookmarks) {
    const parsed = parseBookmark(b)
    if (!parsed) {
      return { root: createDefaultRoot(), repaired: true, backedUp: true }
    }
    bookmarks.push(parsed)
  }

  // Soft repairs: keep parsed data, write-back only if something changed.
  let repaired = raw.version !== STORAGE_VERSION
  const ensured = ensureDefaultGroup(groups)
  repaired = repaired || ensured.repaired
  const fixedBookmarks = repairBookmarks(bookmarks, ensured.groups)
  repaired = repaired || fixedBookmarks.repaired

  const hadMeta =
    isObject(raw.meta) &&
    typeof raw.meta.updatedAt === 'number' &&
    Number.isFinite(raw.meta.updatedAt)
  if (!hadMeta) repaired = true

  return {
    root: {
      version: STORAGE_VERSION,
      groups: ensured.groups,
      bookmarks: fixedBookmarks.bookmarks,
      settings,
      meta: parseMeta(raw.meta),
    },
    repaired,
    backedUp: false,
  }
}
