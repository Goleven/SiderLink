import { createId } from './ids'
import { FALLBACK_GROUP_ICON, resolveGroupIconId } from './icons'
import { reindexOrders, sortByOrder } from './order'
import type { BookmarkItem, Group, Settings, StorageRoot } from './types'
import {
  normalizeGroupName,
  normalizeTitle,
  normalizeUrl,
} from './validation'

function cloneRoot(root: StorageRoot): StorageRoot {
  return {
    version: root.version,
    groups: root.groups.map((g) => ({ ...g })),
    bookmarks: root.bookmarks.map((b) => ({ ...b })),
    settings: { ...root.settings },
    meta: { ...root.meta },
  }
}

function requireDefaultGroup(groups: Group[]): Group {
  const g = groups.find((x) => x.isDefault)
  if (!g) throw new Error('error.defaultGroupMissing')
  return g
}

function otherGroupNames(groups: Group[], excludeId?: string): string[] {
  return groups.filter((g) => g.id !== excludeId).map((g) => g.name)
}

export function sortGroups(groups: Group[]): Group[] {
  return sortByOrder(groups)
}

export function sortBookmarksInGroup(
  bookmarks: BookmarkItem[],
  groupId: string,
): BookmarkItem[] {
  return sortByOrder(bookmarks.filter((b) => b.groupId === groupId))
}

export function addBookmark(
  root: StorageRoot,
  input: {
    title: string
    url: string
    faviconUrl?: string
    groupId: string
  },
): StorageRoot {
  const next = cloneRoot(root)
  const group = next.groups.find((g) => g.id === input.groupId)
  if (!group) throw new Error('error.groupMissing')

  const urlResult = normalizeUrl(input.url)
  if (!urlResult.ok) throw new Error(urlResult.error)

  let fallbackTitle = 'Untitled'
  try {
    fallbackTitle = new URL(urlResult.url).hostname || fallbackTitle
  } catch {
    /* keep fallback */
  }
  const title = normalizeTitle(input.title, fallbackTitle)
  const now = Date.now()
  const inGroup = sortBookmarksInGroup(next.bookmarks, input.groupId)
  const item: BookmarkItem = {
    id: createId(),
    title,
    url: urlResult.url,
    groupId: input.groupId,
    order: inGroup.length,
    createdAt: now,
    updatedAt: now,
  }
  if (input.faviconUrl) item.faviconUrl = input.faviconUrl
  next.bookmarks.push(item)
  return next
}

export function updateBookmark(
  root: StorageRoot,
  id: string,
  patch: {
    title?: string
    url?: string
    faviconUrl?: string | null
    groupId?: string
  },
): StorageRoot {
  const next = cloneRoot(root)
  const idx = next.bookmarks.findIndex((b) => b.id === id)
  if (idx < 0) throw new Error('error.bookmarkMissing')
  const current = next.bookmarks[idx]

  let title = current.title
  let url = current.url
  let groupId = current.groupId
  let faviconUrl = current.faviconUrl

  if (patch.url !== undefined) {
    const urlResult = normalizeUrl(patch.url)
    if (!urlResult.ok) throw new Error(urlResult.error)
    url = urlResult.url
  }
  if (patch.title !== undefined) {
    let fallback = 'Untitled'
    try {
      fallback = new URL(url).hostname || fallback
    } catch {
      /* keep */
    }
    title = normalizeTitle(patch.title, fallback)
  }
  if (patch.groupId !== undefined) {
    if (!next.groups.some((g) => g.id === patch.groupId)) {
      throw new Error('error.groupMissing')
    }
    groupId = patch.groupId
  }
  if (patch.faviconUrl === null) {
    faviconUrl = undefined
  } else if (typeof patch.faviconUrl === 'string') {
    faviconUrl = patch.faviconUrl
  }

  const updated: BookmarkItem = {
    ...current,
    title,
    url,
    groupId,
    updatedAt: Date.now(),
  }
  if (faviconUrl) updated.faviconUrl = faviconUrl
  else delete updated.faviconUrl

  next.bookmarks[idx] = updated

  if (groupId !== current.groupId) {
    const others = next.bookmarks.filter(
      (b) => b.id !== id && b.groupId === groupId,
    )
    next.bookmarks[idx].order = others.length
    const oldGroup = next.bookmarks.filter((b) => b.groupId === current.groupId)
    const reindexedOld = reindexOrders(sortByOrder(oldGroup))
    for (const b of reindexedOld) {
      const i = next.bookmarks.findIndex((x) => x.id === b.id)
      if (i >= 0) next.bookmarks[i] = b
    }
  }

  return next
}

export function deleteBookmark(root: StorageRoot, id: string): StorageRoot {
  const next = cloneRoot(root)
  const target = next.bookmarks.find((b) => b.id === id)
  if (!target) throw new Error('error.bookmarkMissing')
  next.bookmarks = next.bookmarks.filter((b) => b.id !== id)
  const remaining = sortByOrder(
    next.bookmarks.filter((b) => b.groupId === target.groupId),
  )
  const reindexed = reindexOrders(remaining)
  next.bookmarks = [
    ...next.bookmarks.filter((b) => b.groupId !== target.groupId),
    ...reindexed,
  ]
  return next
}

export function addGroup(
  root: StorageRoot,
  input: { name: string; icon: string },
): StorageRoot {
  const next = cloneRoot(root)
  const nameResult = normalizeGroupName(input.name, otherGroupNames(next.groups))
  if (!nameResult.ok) throw new Error(nameResult.error)
  const icon = resolveGroupIconId(input.icon.trim() || FALLBACK_GROUP_ICON)
  next.groups.push({
    id: createId(),
    name: nameResult.name,
    icon,
    order: next.groups.length,
    isDefault: false,
  })
  return next
}

export function updateGroup(
  root: StorageRoot,
  id: string,
  patch: { name?: string; icon?: string },
): StorageRoot {
  const next = cloneRoot(root)
  const idx = next.groups.findIndex((g) => g.id === id)
  if (idx < 0) throw new Error('error.groupMissing')
  const current = next.groups[idx]
  let name = current.name
  let icon = current.icon
  if (patch.name !== undefined) {
    const nameResult = normalizeGroupName(
      patch.name,
      otherGroupNames(next.groups, id),
    )
    if (!nameResult.ok) throw new Error(nameResult.error)
    name = nameResult.name
  }
  if (patch.icon !== undefined) {
    icon = resolveGroupIconId(patch.icon.trim() || current.icon)
  }
  next.groups[idx] = { ...current, name, icon }
  return next
}

export function deleteGroup(root: StorageRoot, id: string): StorageRoot {
  const next = cloneRoot(root)
  const group = next.groups.find((g) => g.id === id)
  if (!group) throw new Error('error.groupMissing')
  if (group.isDefault) throw new Error('error.cannotDeleteDefault')

  const defaultGroup = requireDefaultGroup(next.groups)
  const moving = sortByOrder(next.bookmarks.filter((b) => b.groupId === id))
  const stay = next.bookmarks.filter((b) => b.groupId !== id)
  const inDefault = sortByOrder(
    stay.filter((b) => b.groupId === defaultGroup.id),
  )
  const moved = moving.map((b, i) => ({
    ...b,
    groupId: defaultGroup.id,
    order: inDefault.length + i,
  }))
  const otherBookmarks = stay.filter((b) => b.groupId !== defaultGroup.id)
  next.bookmarks = [...otherBookmarks, ...inDefault, ...moved]
  next.groups = reindexOrders(
    sortByOrder(next.groups.filter((g) => g.id !== id)),
  )
  return next
}

export function reorderGroups(
  root: StorageRoot,
  orderedIds: string[],
): StorageRoot {
  const next = cloneRoot(root)
  if (orderedIds.length !== next.groups.length) {
    throw new Error('error.groupOrderInvalid')
  }
  const map = new Map(next.groups.map((g) => [g.id, g]))
  const reordered: Group[] = []
  for (const id of orderedIds) {
    const g = map.get(id)
    if (!g) throw new Error('error.groupOrderInvalid')
    reordered.push(g)
    map.delete(id)
  }
  if (map.size > 0) throw new Error('error.groupOrderInvalid')
  next.groups = reindexOrders(reordered)
  return next
}

export function moveBookmark(
  root: StorageRoot,
  bookmarkId: string,
  toGroupId: string,
  toIndex: number,
): StorageRoot {
  const next = cloneRoot(root)
  const bookmark = next.bookmarks.find((b) => b.id === bookmarkId)
  if (!bookmark) throw new Error('error.bookmarkMissing')
  if (!next.groups.some((g) => g.id === toGroupId)) {
    throw new Error('error.groupMissing')
  }

  const without = next.bookmarks.filter((b) => b.id !== bookmarkId)
  const targetList = sortByOrder(
    without.filter((b) => b.groupId === toGroupId),
  )
  const clamped = Math.max(0, Math.min(toIndex, targetList.length))
  const moved: BookmarkItem = {
    ...bookmark,
    groupId: toGroupId,
    updatedAt: Date.now(),
  }
  targetList.splice(clamped, 0, moved)
  const reindexedTarget = reindexOrders(targetList)

  const fromGroupId = bookmark.groupId
  let fromList = without.filter((b) => b.groupId === fromGroupId)
  if (fromGroupId !== toGroupId) {
    fromList = reindexOrders(sortByOrder(fromList))
  } else {
    fromList = []
  }

  const others = without.filter(
    (b) => b.groupId !== toGroupId && b.groupId !== fromGroupId,
  )

  next.bookmarks = [...others, ...fromList, ...reindexedTarget]
  return next
}

export function patchSettings(
  root: StorageRoot,
  patch: Partial<Settings>,
): StorageRoot {
  const next = cloneRoot(root)
  next.settings = { ...next.settings, ...patch }
  return next
}
