<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { filterBookmarks } from '@/shared/searchBookmarks'
import type { BookmarkItem } from '@/shared/types'
import { useReducedMotion } from '../composables/useReducedMotion'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  open: boolean
  bookmarks: BookmarkItem[]
}>()

const emit = defineEmits<{
  close: []
  open: [id: string]
}>()

const { t } = useI18n()
const { reduced } = useReducedMotion()

const query = ref('')
const highlightIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const brokenIds = ref(new Set<string>())

const results = computed(() => filterBookmarks(query.value, props.bookmarks))

const trimmedQuery = computed(() => query.value.trim())

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    query.value = ''
    highlightIndex.value = 0
    brokenIds.value = new Set()
    await nextTick()
    inputRef.value?.focus()
  },
)

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

function select(id: string) {
  emit('open', id)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
    return
  }

  const list = results.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (!list.length) return
    highlightIndex.value = Math.min(highlightIndex.value + 1, list.length - 1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (!list.length) return
    highlightIndex.value = Math.max(highlightIndex.value - 1, 0)
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const item = list[highlightIndex.value]
    if (item) select(item.id)
  }
}
</script>

<template>
  <div
    v-if="open"
    class="overlay"
    :class="{ reduced }"
    @click.self="emit('close')"
    @keydown="onKeydown"
  >
    <div
      class="panel"
      role="dialog"
      :aria-label="t('a11y.search')"
    >
      <div class="search-wrap">
        <AppIcon name="search" :size="16" class="search-icon" />
        <input
          ref="inputRef"
          v-model="query"
          type="search"
          class="input"
          :placeholder="t('search.placeholder')"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <p v-if="!trimmedQuery" class="hint">{{ t('search.emptyHint') }}</p>
      <p v-else-if="results.length === 0" class="hint">
        {{ t('search.noResults') }}
      </p>

      <ul v-else class="results" role="listbox">
        <li v-for="(item, i) in results" :key="item.id">
          <button
            type="button"
            class="row pressable"
            role="option"
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
                :size="18"
                :stroke-width="1.5"
              />
            </span>
            <span class="meta">
              <span class="title">{{ item.title }}</span>
              <span class="domain">{{ hostname(item.url) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 32;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 56px 16px 16px;
  background: rgba(0, 0, 0, 0.28);
}

.panel {
  width: min(100%, 360px);
  border-radius: 16px;
  background: var(--elevated);
  backdrop-filter: blur(20px) saturate(180%);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: search-in 220ms ease-out;
}

.overlay.reduced .panel {
  animation: search-fade 160ms ease;
}

@keyframes search-in {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes search-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--hairline);
  border-radius: 12px;
  padding: 0 12px;
  background: var(--row-bg);
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
  padding: 11px 0;
  font-size: 15px;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.hint {
  margin: 0;
  padding: 4px 4px 2px;
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
  gap: 2px;
}

.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  border-radius: 12px;
  padding: 8px 10px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.row.active {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.favicon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: var(--row-bg);
  color: var(--text-secondary);
  overflow: hidden;
}

.favicon-img {
  width: 18px;
  height: 18px;
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
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.domain {
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
