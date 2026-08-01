<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { sortGroups } from '@/shared/domain'
import type { BookmarkItem, Group } from '@/shared/types'
import { pullOnActivate, setSyncUiHooks } from '@/shared/sync/scheduler'
import { useFavoritesStore } from './stores/favorites'
import { useTheme } from './composables/useTheme'
import { useToast } from './composables/useToast'
import { useAdjacentGroupScroll } from './composables/useAdjacentGroupScroll'
import { useDragReorder } from './composables/useDragReorder'
import { useScrollEdgeFades } from './composables/useScrollEdgeFades'
import BookmarkList from './components/BookmarkList.vue'
import IndexBar from './components/IndexBar.vue'
import AddSheet from './components/AddSheet.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import EditBookmarkSheet from './components/EditBookmarkSheet.vue'
import GroupEditorSheet from './components/GroupEditorSheet.vue'
import SearchOverlay from './components/SearchOverlay.vue'
import SettingsView from './components/SettingsView.vue'
import StorageBanner from './components/StorageBanner.vue'
import ToastHost from './components/ToastHost.vue'

const store = useFavoritesStore()
const { show } = useToast()
const { t, te } = useI18n()

const showAdd = ref(false)
const showSearch = ref(false)
const showSettings = ref(false)
const editItem = ref<BookmarkItem | null>(null)
const showEditBookmark = ref(false)
const editGroup = ref<Group | null>(null)
const groupMode = ref<'edit' | 'create'>('edit')
const showGroupEditor = ref(false)
const deleteTarget = ref<BookmarkItem | null>(null)
const showDeleteConfirm = ref(false)
const contentRef = ref<HTMLElement | null>(null)
const selectedGroupId = ref<string | null>(null)

function defaultGroupId(groups: Group[]) {
  return groups.find((g) => g.isDefault)?.id ?? groups[0]?.id ?? null
}

watch(
  () => store.groups,
  (groups) => {
    if (!groups.length) {
      selectedGroupId.value = null
      return
    }
    const stillValid =
      selectedGroupId.value != null &&
      groups.some((g) => g.id === selectedGroupId.value)
    if (!stillValid) {
      selectedGroupId.value = defaultGroupId(groups)
    }
  },
  { immediate: true },
)

useTheme(
  () => store.settings.themeMode,
  () => store.settings.backgroundId,
)

const { showTopFade, showBottomFade } = useScrollEdgeFades(contentRef, [
  computed(() => store.bookmarks.length),
  computed(() => store.groups.length),
  showSettings,
  selectedGroupId,
])

const orderedGroupIds = computed(() =>
  sortGroups(store.groups).map((g) => g.id),
)

useAdjacentGroupScroll({
  scrollEl: contentRef,
  orderedGroupIds,
  selectedGroupId,
  enabled: computed(() => !showSettings.value),
})

const dragEnabled = computed(() => !showSettings.value)
const { onBookmarkPointerDown } = useDragReorder({
  enabled: dragEnabled,
  onMoveBookmark: (id, groupId, index) => store.moveBookmark(id, groupId, index),
  onReorderGroups: (ids) => store.reorderGroups(ids),
})

const storageBannerMessage = computed(() => {
  const key = store.storageError
  if (!key) return ''
  return te(key) ? t(key) : key
})

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function onSearchHotkey(e: KeyboardEvent) {
  if (showSearch.value) return
  if (showSettings.value) return
  if (isEditableTarget(e.target)) return

  const isSlash = e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey
  const isModK =
    (e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey) && !e.altKey

  if (!isSlash && !isModK) return
  e.preventDefault()
  showSearch.value = true
}

async function onSearchOpen(id: string) {
  showSearch.value = false
  await store.openBookmark(id)
}

onMounted(() => {
  setSyncUiHooks({
    onRootReplaced: (root) => {
      store.applyRootLocal(root)
    },
    onConfigUpdated: (config) => {
      store.applySyncConfigLocal(config)
    },
  })
  document.addEventListener('keydown', onSearchHotkey)
  void (async () => {
    await store.load()
    await pullOnActivate()
  })()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onSearchHotkey)
})

function openEditBookmark(id: string) {
  editItem.value = store.bookmarks.find((b) => b.id === id) ?? null
  showEditBookmark.value = true
}

const deleteBookmarkTitle = computed(() =>
  t('editBookmark.deleteConfirmTitle', {
    name: deleteTarget.value?.title ?? '',
  }),
)

function requestDeleteBookmark(id: string) {
  deleteTarget.value = store.bookmarks.find((b) => b.id === id) ?? null
  showDeleteConfirm.value = Boolean(deleteTarget.value)
}

function cancelDeleteBookmark() {
  showDeleteConfirm.value = false
  deleteTarget.value = null
}

async function confirmDeleteBookmark() {
  const snapshot = deleteTarget.value
  if (!snapshot) return
  showDeleteConfirm.value = false
  deleteTarget.value = null
  showEditBookmark.value = false
  editItem.value = null
  try {
    await store.deleteBookmark(snapshot.id)
    await onDeleted(snapshot)
  } catch {
    show(t('editBookmark.deleteFailed'))
  }
}

function openCreateGroup() {
  editGroup.value = null
  groupMode.value = 'create'
  showGroupEditor.value = true
}

function openEditGroup(id: string) {
  editGroup.value = store.groups.find((g) => g.id === id) ?? null
  groupMode.value = 'edit'
  showGroupEditor.value = true
}

async function onDeleted(snapshot: BookmarkItem) {
  show(t('toast.deleted'), {
    actionLabel: t('toast.undo'),
    durationMs: 5000,
    onAction: () => {
      void store.addBookmark({
        title: snapshot.title,
        url: snapshot.url,
        faviconUrl: snapshot.faviconUrl,
        groupId: snapshot.groupId,
      })
    },
  })
}

function onAdded() {
  show(t('toast.added'))
}

function onGroupCreated(id: string) {
  selectedGroupId.value = id
}

</script>

<template>
  <div class="app">
    <StorageBanner
      v-if="store.storageError"
      :message="storageBannerMessage"
      @retry="store.retryLoad()"
    />

    <div class="content-shell">
      <div
        class="edge-fade edge-fade-top"
        :class="{ visible: showTopFade && !showSettings }"
        aria-hidden="true"
      />
      <div ref="contentRef" class="content content-scroll">
        <BookmarkList
          :groups="store.groups"
          :bookmarks="store.bookmarks"
          :selected-group-id="selectedGroupId"
          @open="store.openBookmark($event)"
          @edit-bookmark="openEditBookmark"
          @request-delete-bookmark="requestDeleteBookmark"
          @bookmark-pointer-down="onBookmarkPointerDown"
        />
        <IndexBar
          :groups="store.groups"
          :selected-id="selectedGroupId"
          @select="selectedGroupId = $event"
          @search="showSearch = true"
          @settings="showSettings = true"
          @add="showAdd = true"
        />
      </div>
      <div
        class="edge-fade edge-fade-bottom"
        :class="{ visible: showBottomFade && !showSettings }"
        aria-hidden="true"
      />
    </div>

    <SettingsView
      :open="showSettings"
      @close="showSettings = false"
      @create-group="openCreateGroup"
      @edit-group="openEditGroup"
    />

    <SearchOverlay
      :open="showSearch"
      :bookmarks="store.bookmarks"
      @close="showSearch = false"
      @open="onSearchOpen"
    />

    <AddSheet
      :open="showAdd"
      :groups="store.groups"
      :preferred-group-id="selectedGroupId"
      @close="showAdd = false"
      @added="onAdded"
    />

    <EditBookmarkSheet
      :open="showEditBookmark"
      :item="editItem"
      :groups="store.groups"
      @close="showEditBookmark = false"
      @request-delete="requestDeleteBookmark"
    />

    <ConfirmDialog
      :open="showDeleteConfirm"
      :title="deleteBookmarkTitle"
      :message="t('editBookmark.deleteConfirmMessage')"
      :confirm-label="t('editBookmark.delete')"
      :cancel-label="t('common.cancel')"
      danger
      @confirm="confirmDeleteBookmark"
      @cancel="cancelDeleteBookmark"
    />

    <GroupEditorSheet
      :open="showGroupEditor"
      :group="editGroup"
      :mode="groupMode"
      @close="showGroupEditor = false"
      @created="onGroupCreated"
    />

    <ToastHost />
  </div>
</template>

<style scoped>
.app {
  position: relative;
  min-height: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
}

.content-shell {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.content {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.edge-fade {
  position: absolute;
  left: 0;
  right: 0;
  height: 24px;
  z-index: 6;
  pointer-events: none;
  opacity: 0;
  transition: opacity 180ms ease;
}

.edge-fade.visible {
  opacity: 1;
}

.edge-fade-top {
  top: 0;
  background: linear-gradient(
    to bottom,
    var(--app-bg) 0%,
    color-mix(in srgb, var(--app-bg) 62%, transparent) 42%,
    transparent 100%
  );
}

.edge-fade-bottom {
  bottom: 0;
  background: linear-gradient(
    to top,
    var(--app-bg) 0%,
    color-mix(in srgb, var(--app-bg) 62%, transparent) 42%,
    transparent 100%
  );
}

@media (prefers-reduced-transparency: reduce) {
  .edge-fade {
    height: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .edge-fade {
    transition: opacity 120ms ease;
  }
}
</style>
