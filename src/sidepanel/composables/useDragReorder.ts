import type { Ref } from 'vue'

export interface DragReorderApi {
  onBookmarkPointerDown: (
    event: PointerEvent,
    bookmarkId: string,
    groupId: string,
  ) => void
  onGroupPointerDown: (event: PointerEvent, groupId: string) => void
}

type BookmarkDrag = {
  kind: 'bookmark'
  id: string
  sourceGroupId: string
  startY: number
  grabOffset: number
  el: HTMLElement
  moved: boolean
  rowHeight: number
  previewGroupId: string
  previewIndex: number
  shifted: HTMLElement[]
}

type GroupDrag = {
  kind: 'group'
  id: string
  startY: number
  grabOffset: number
  el: HTMLElement
  list: HTMLElement
  moved: boolean
  rowHeight: number
  previewIndex: number
  shifted: HTMLElement[]
}

/**
 * Lightweight drag reorder using pointer capture.
 * Bookmark / settings-group drag: lifts row out of flow, shifts peers to show insert slot, commits on release.
 */
export function useDragReorder(opts: {
  enabled: Ref<boolean>
  onMoveBookmark: (
    bookmarkId: string,
    toGroupId: string,
    toIndex: number,
  ) => Promise<void> | void
  onReorderGroups: (orderedIds: string[]) => Promise<void> | void
}): DragReorderApi {
  let dragging: BookmarkDrag | GroupDrag | null = null

  function clearSiblingShifts(state: { shifted: HTMLElement[] }) {
    for (const el of state.shifted) {
      el.style.transform = ''
      el.style.transition = ''
    }
    state.shifted = []
  }

  function cleanupLiftedRow(el: HTMLElement) {
    el.classList.remove('dragging')
    el.style.transform = ''
    el.style.zIndex = ''
    el.style.touchAction = ''
    el.style.pointerEvents = ''
    el.style.position = ''
    el.style.left = ''
    el.style.top = ''
    el.style.width = ''
    el.style.margin = ''
    el.style.boxSizing = ''
  }

  function cleanupBookmark(state: BookmarkDrag) {
    clearSiblingShifts(state)
    cleanupLiftedRow(state.el)
  }

  function cleanupGroup(state: GroupDrag) {
    clearSiblingShifts(state)
    cleanupLiftedRow(state.el)
  }

  function cleanup() {
    if (!dragging) return
    if (dragging.kind === 'bookmark') cleanupBookmark(dragging)
    else cleanupGroup(dragging)
    dragging = null
  }

  function suppressNextClick(el: HTMLElement) {
    const suppress = (ev: Event) => {
      ev.preventDefault()
      ev.stopPropagation()
      removeSuppress()
    }
    const timer = window.setTimeout(removeSuppress, 400)
    function removeSuppress() {
      window.clearTimeout(timer)
      el.removeEventListener('click', suppress, true)
    }
    el.addEventListener('click', suppress, true)
  }

  function peerRows(section: HTMLElement, bookmarkId: string): HTMLElement[] {
    return [
      ...section.querySelectorAll<HTMLElement>('[data-bookmark-id]'),
    ].filter((r) => r.dataset.bookmarkId !== bookmarkId)
  }

  function settingsGroupPeers(
    list: HTMLElement,
    groupId: string,
  ): HTMLElement[] {
    return [
      ...list.querySelectorAll<HTMLElement>('[data-settings-group-id]'),
    ].filter((r) => r.dataset.settingsGroupId !== groupId)
  }

  /** Insert index among peers: first peer whose midY is below pointer. */
  function insertIndexAtY(peers: HTMLElement[], clientY: number): number {
    for (let i = 0; i < peers.length; i++) {
      const rect = peers[i]!.getBoundingClientRect()
      const mid = rect.top + rect.height / 2
      if (clientY < mid) return i
    }
    return peers.length
  }

  function sectionAtPoint(clientX: number, clientY: number): HTMLElement | null {
    const point = document.elementFromPoint(clientX, clientY)
    const section = point?.closest('[data-group-id]') as HTMLElement | null
    if (section) return section

    // Fallback: nearest section by vertical overlap with pointer
    const sections = [
      ...document.querySelectorAll<HTMLElement>('[data-group-id]'),
    ]
    let best: HTMLElement | null = null
    let bestDist = Infinity
    for (const s of sections) {
      const r = s.getBoundingClientRect()
      if (clientY >= r.top && clientY <= r.bottom) return s
      const dist =
        clientY < r.top ? r.top - clientY : clientY - r.bottom
      if (dist < bestDist) {
        bestDist = dist
        best = s
      }
    }
    return best
  }

  function applyPeerShifts(
    state: { rowHeight: number; previewIndex: number; shifted: HTMLElement[] },
    peers: HTMLElement[],
  ) {
    clearSiblingShifts(state)
    const h = state.rowHeight
    for (let i = 0; i < peers.length; i++) {
      const peer = peers[i]!
      if (i >= state.previewIndex) {
        peer.style.transition = 'transform 120ms ease-out'
        peer.style.transform = `translateY(${h}px)`
        state.shifted.push(peer)
      }
    }
  }

  function updateBookmarkPreview(
    state: BookmarkDrag,
    clientX: number,
    clientY: number,
  ) {
    const section = sectionAtPoint(clientX, clientY)
    if (!section?.dataset.groupId) return

    const peers = peerRows(section, state.id)
    const index = insertIndexAtY(peers, clientY)
    const groupId = section.dataset.groupId
    if (state.previewGroupId === groupId && state.previewIndex === index) {
      return
    }
    state.previewGroupId = groupId
    state.previewIndex = index
    applyPeerShifts(state, peers)
  }

  function applyGroupPeerShifts(state: GroupDrag, peers: HTMLElement[]) {
    clearSiblingShifts(state)
    const h = state.rowHeight
    for (let i = 0; i < peers.length; i++) {
      const peer = peers[i]!
      if (i >= state.previewIndex) {
        peer.style.transition = 'transform 120ms ease-out'
        peer.style.transform = `translateY(${h}px)`
        state.shifted.push(peer)
      }
    }
    // Lifted row leaves flow; keep trailing "create" row from collapsing into the last group.
    const createRow = state.list.querySelector<HTMLElement>(
      '[data-settings-group-create]',
    )
    if (createRow) {
      createRow.style.transition = 'transform 120ms ease-out'
      createRow.style.transform = `translateY(${h}px)`
      state.shifted.push(createRow)
    }
  }

  function updateGroupPreview(state: GroupDrag, clientY: number) {
    const peers = settingsGroupPeers(state.list, state.id)
    const index = insertIndexAtY(peers, clientY)
    if (state.previewIndex === index) return
    state.previewIndex = index
    applyGroupPeerShifts(state, peers)
  }

  function activateLift(
    state: BookmarkDrag | GroupDrag,
    e: PointerEvent,
    gapPx: number,
  ) {
    const el = state.el
    const rect = el.getBoundingClientRect()
    state.rowHeight = rect.height + gapPx
    state.grabOffset = e.clientY - rect.top

    el.classList.add('dragging')
    el.style.pointerEvents = 'none'
    el.style.position = 'fixed'
    el.style.left = `${rect.left}px`
    el.style.width = `${rect.width}px`
    el.style.top = `${rect.top}px`
    el.style.zIndex = '20'
    el.style.margin = '0'
    el.style.boxSizing = 'border-box'
    el.style.transform = ''
  }

  function onBookmarkPointerDown(
    event: PointerEvent,
    bookmarkId: string,
    groupId: string,
  ) {
    if (!opts.enabled.value) return
    if (event.button !== 0) return

    const el =
      (event.currentTarget as HTMLElement | null) ??
      document.querySelector<HTMLElement>(
        `[data-bookmark-id="${bookmarkId}"]`,
      )
    if (!el) return

    el.setPointerCapture(event.pointerId)
    dragging = {
      kind: 'bookmark',
      id: bookmarkId,
      sourceGroupId: groupId,
      startY: event.clientY,
      grabOffset: 0,
      el,
      moved: false,
      rowHeight: el.getBoundingClientRect().height,
      previewGroupId: groupId,
      previewIndex: -1,
      shifted: [],
    }
    el.style.touchAction = 'none'

    const onMove = (e: PointerEvent) => {
      if (!dragging || dragging.kind !== 'bookmark' || dragging.id !== bookmarkId)
        return
      const dy = e.clientY - dragging.startY
      if (!dragging.moved && Math.abs(dy) > 10) {
        dragging.moved = true
        activateLift(dragging, e, 6)
      }
      if (!dragging.moved) return

      const top = e.clientY - dragging.grabOffset
      dragging.el.style.top = `${top}px`
      updateBookmarkPreview(dragging, e.clientX, e.clientY)
    }

    const onUp = async (e: PointerEvent) => {
      el.releasePointerCapture(e.pointerId)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)

      const state = dragging
      if (!state || state.kind !== 'bookmark' || state.id !== bookmarkId) {
        cleanup()
        return
      }

      if (!state.moved) {
        cleanup()
        return
      }

      updateBookmarkPreview(state, e.clientX, e.clientY)
      const toGroupId = state.previewGroupId
      const toIndex = state.previewIndex
      suppressNextClick(el)

      try {
        await opts.onMoveBookmark(bookmarkId, toGroupId, toIndex)
      } finally {
        cleanup()
      }
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }

  function onGroupPointerDown(event: PointerEvent, groupId: string) {
    if (!opts.enabled.value) return
    if (event.button !== 0) return

    const el = event.currentTarget as HTMLElement
    const list = el.closest('.group-list') as HTMLElement | null
    if (!list) return

    el.setPointerCapture(event.pointerId)
    dragging = {
      kind: 'group',
      id: groupId,
      startY: event.clientY,
      grabOffset: 0,
      el,
      list,
      moved: false,
      rowHeight: el.getBoundingClientRect().height,
      previewIndex: -1,
      shifted: [],
    }
    el.style.touchAction = 'none'

    const onMove = (e: PointerEvent) => {
      if (!dragging || dragging.kind !== 'group' || dragging.id !== groupId)
        return
      const dy = e.clientY - dragging.startY
      if (!dragging.moved && Math.abs(dy) > 10) {
        dragging.moved = true
        activateLift(dragging, e, 6)
        updateGroupPreview(dragging, e.clientY)
      }
      if (!dragging.moved) return

      const top = e.clientY - dragging.grabOffset
      dragging.el.style.top = `${top}px`
      updateGroupPreview(dragging, e.clientY)
    }

    const onUp = async (e: PointerEvent) => {
      el.releasePointerCapture(e.pointerId)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)

      const state = dragging
      if (!state || state.kind !== 'group' || state.id !== groupId) {
        cleanup()
        return
      }

      if (!state.moved) {
        cleanup()
        return
      }

      updateGroupPreview(state, e.clientY)
      const peers = settingsGroupPeers(state.list, groupId)
      const peerIds = peers
        .map((p) => p.dataset.settingsGroupId)
        .filter((id): id is string => Boolean(id))
      const next = [...peerIds]
      const insertAt = Math.max(0, Math.min(state.previewIndex, next.length))
      next.splice(insertAt, 0, groupId)

      const current = [
        ...state.list.querySelectorAll<HTMLElement>('[data-settings-group-id]'),
      ]
        .map((r) => r.dataset.settingsGroupId)
        .filter((id): id is string => Boolean(id))

      suppressNextClick(el)

      if (
        next.length !== current.length ||
        next.every((id, i) => id === current[i])
      ) {
        cleanup()
        return
      }

      try {
        await opts.onReorderGroups(next)
      } finally {
        cleanup()
      }
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }

  return { onBookmarkPointerDown, onGroupPointerDown }
}
