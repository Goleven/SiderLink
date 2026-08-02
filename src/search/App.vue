<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getBrowser } from '@/shared/browser'
import {
  filterBookmarksOrdered,
  listBookmarksSideOrder,
} from '@/shared/searchBookmarks'
import { STORAGE_KEY } from '@/shared/storage/keys'
import { migrate } from '@/shared/storage/migrate'
import type { BookmarkItem, Group, Settings, StorageRoot } from '@/shared/types'
import { useReducedMotion } from '../sidepanel/composables/useReducedMotion'
import { useTheme } from '../sidepanel/composables/useTheme'
import AppIcon from '../sidepanel/components/AppIcon.vue'

const { t, locale } = useI18n()
const { reduced } = useReducedMotion()

watch(
  locale,
  (value) => {
    document.documentElement.lang = value
    document.title = t('search.windowTitle')
  },
  { immediate: true },
)

const root = ref<StorageRoot | null>(null)
const query = ref('')
const highlightIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const brokenIds = ref(new Set<string>())
const ready = ref(false)

const settings = computed<Settings | null>(() => root.value?.settings ?? null)
const groups = computed<Group[]>(() => root.value?.groups ?? [])
const bookmarks = computed<BookmarkItem[]>(() => root.value?.bookmarks ?? [])

const groupById = computed(() => {
  const map = new Map<string, Group>()
  for (const g of groups.value) map.set(g.id, g)
  return map
})

const ordered = computed(() =>
  listBookmarksSideOrder(groups.value, bookmarks.value),
)

const results = computed(() =>
  filterBookmarksOrdered(query.value, ordered.value),
)

const trimmedQuery = computed(() => query.value.trim())

useTheme(
  () => settings.value?.themeMode ?? 'system',
  () => settings.value?.backgroundId ?? 'neutral',
)

async function loadRoot() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY)
    const { root: next } = migrate(data[STORAGE_KEY])
    root.value = next
  } catch {
    root.value = null
  } finally {
    ready.value = true
  }
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function markBroken(id: string) {
  const next = new Set(brokenIds.value)
  next.add(id)
  brokenIds.value = next
}

function isBroken(id: string): boolean {
  return brokenIds.value.has(id)
}

function groupIcon(groupId: string): string {
  return groupById.value.get(groupId)?.icon ?? 'folder'
}

async function select(id: string) {
  const item = bookmarks.value.find((b) => b.id === id)
  if (!item || !settings.value) return
  await getBrowser().openUrl(item.url, {
    newTab: settings.value.openInNewTab,
  })
  window.close()
}

function resetAndFocus() {
  query.value = ''
  highlightIndex.value = 0
  brokenIds.value = new Set()
  void nextTick(() => inputRef.value?.focus())
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    window.close()
    return
  }

  const list = results.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!list.length) return
    highlightIndex.value = Math.min(highlightIndex.value + 1, list.length - 1)
    scrollHighlightIntoView()
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!list.length) return
    highlightIndex.value = Math.max(highlightIndex.value - 1, 0)
    scrollHighlightIntoView()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const item = list[highlightIndex.value]
    if (item) void select(item.id)
  }
}

function scrollHighlightIntoView() {
  void nextTick(() => {
    const el = listRef.value?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function onStorageChanged(
  changes: { [key: string]: chrome.storage.StorageChange },
  area: string,
) {
  if (area !== 'local' || changes[STORAGE_KEY]?.newValue == null) return
  const { root: next } = migrate(changes[STORAGE_KEY].newValue)
  root.value = next
}

watch(results, (list) => {
  if (list.length === 0) {
    highlightIndex.value = 0
    return
  }
  if (highlightIndex.value > list.length - 1) {
    highlightIndex.value = list.length - 1
  }
})

watch(query, () => {
  highlightIndex.value = 0
})

onMounted(() => {
  void loadRoot().then(() => resetAndFocus())
  chrome.storage.onChanged.addListener(onStorageChanged)
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(onStorageChanged)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="page" :class="{ reduced }">
    <header class="chrome">
      <div class="search-wrap">
        <AppIcon name="search" :size="24" class="search-icon" />
        <input
          ref="inputRef"
          v-model="query"
          type="search"
          class="input"
          :placeholder="t('search.placeholder')"
          :aria-label="t('a11y.globalSearch')"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
    </header>

    <div ref="listRef" class="body content-scroll">
      <p v-if="!ready" class="hint">{{ t('storage.notLoaded') }}</p>
      <p v-else-if="ordered.length === 0" class="hint">
        {{ t('search.noBookmarks') }}
      </p>
      <p v-else-if="trimmedQuery && results.length === 0" class="hint">
        {{ t('search.noResults') }}
      </p>
      <ul v-else class="results" role="listbox">
        <li v-for="(item, i) in results" :key="item.id">
          <button
            type="button"
            class="row pressable"
            role="option"
            :data-active="i === highlightIndex ? 'true' : undefined"
            :class="{ active: i === highlightIndex }"
            :aria-selected="i === highlightIndex"
            @click="select(item.id)"
            @pointerenter="highlightIndex = i"
          >
            <span class="favicon" aria-hidden="true">
              <img
                v-if="item.faviconUrl && !isBroken(item.id)"
                class="favicon-img"
                :src="item.faviconUrl"
                alt=""
                @error="markBroken(item.id)"
              />
              <AppIcon
                v-else
                name="earth"
                :size="24"
                :stroke-width="1.5"
              />
            </span>
            <span class="meta">
              <span class="title">{{ item.title }}</span>
              <span class="domain">{{ hostname(item.url) }}</span>
            </span>
            <span class="group-badge" aria-hidden="true">
              <AppIcon :name="groupIcon(item.groupId)" :size="12" />
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
  animation: page-in 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.page.reduced {
  animation: page-fade 160ms ease;
}

@keyframes page-in {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes page-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.chrome {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 12px 12px 10px;
  background: var(--header-bg);
  backdrop-filter: blur(20px) saturate(180%);
  box-shadow: 0 1px 0 transparent;
}

.chrome::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -12px;
  height: 12px;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--app-bg) 70%, transparent),
    transparent
  );
}

.search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--hairline);
  border-radius: 12px;
  padding: 0 12px;
  background: var(--elevated);
  backdrop-filter: blur(16px) saturate(160%);
  box-shadow: var(--shadow-soft);
}

.search-icon {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  padding: 12px 0;
  font-size: 15px;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 4px 10px 14px;
}

.hint {
  margin: 0;
  padding: 16px 8px;
  font-size: 13px;
  color: var(--text-secondary);
  letter-spacing: -0.01em;
}

.results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.row {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  border-radius: var(--radius-row);
  padding: 10px 28px 10px 10px;
  background: var(--row-bg);
  color: inherit;
  cursor: pointer;
  text-align: left;
  box-shadow: var(--shadow-soft);
}

.row.active {
  background: color-mix(in srgb, var(--accent) 14%, var(--row-bg));
}

.favicon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--app-bg) 55%, transparent);
  color: var(--text-secondary);
  overflow: hidden;
}

.favicon-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  display: block;
}

.meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.title {
  font-size: 14px;
  font-weight: 560;
  letter-spacing: -0.015em;
  line-height: 1.25;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.domain {
  font-size: 11px;
  letter-spacing: 0.01em;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background: var(--elevated);
  color: var(--text-secondary);
  border: 1px solid var(--hairline);
  pointer-events: none;
}

@media (prefers-reduced-transparency: reduce) {
  .chrome,
  .search-wrap,
  .row,
  .group-badge {
    backdrop-filter: none;
  }
}
</style>
