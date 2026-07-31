<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  filterGroupIconIds,
  GROUP_ICON_IDS,
  mergeIconSearchResults,
  resolveGroupIconId,
} from '@/shared/icons'
import { loadLucideCatalog } from '../icons/loadLucideCatalog'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  open: boolean
  selected: string
}>()

const emit = defineEmits<{
  close: []
  select: [iconId: string]
}>()

const { t } = useI18n()
const query = ref('')
const filtered = ref<string[]>([...GROUP_ICON_IDS])
const selectedId = ref(resolveGroupIconId(props.selected))
let searchToken = 0

watch(
  () => props.open,
  (open) => {
    if (open) query.value = ''
  },
)

watch(
  () => props.selected,
  (selected) => {
    selectedId.value = resolveGroupIconId(selected)
  },
  { immediate: true },
)

watch(
  [query, () => props.open],
  async ([q, open]) => {
    if (!open) return
    const token = ++searchToken
    const trimmed = q.trim()
    if (!trimmed) {
      filtered.value = [...GROUP_ICON_IDS]
      return
    }

    const curatedHits = filterGroupIconIds(trimmed)
    try {
      const catalog = await loadLucideCatalog()
      if (token !== searchToken) return
      filtered.value = mergeIconSearchResults(
        curatedHits,
        catalog.search(trimmed),
      )
    } catch {
      if (token !== searchToken) return
      filtered.value = curatedHits
    }
  },
  { immediate: true },
)

function pick(id: string) {
  emit('select', id)
  emit('close')
}
</script>

<template>
  <div v-if="open" class="picker" role="dialog" :aria-label="t('a11y.pickIcon')">
    <header class="top">
      <button
        type="button"
        class="back pressable"
        :aria-label="t('a11y.back')"
        @click="emit('close')"
      >
        <AppIcon name="chevron-left" :size="20" />
      </button>
      <h2>{{ t('iconPicker.title') }}</h2>
      <span class="spacer" />
    </header>

    <div class="search-wrap">
      <AppIcon name="search" :size="16" class="search-icon" />
      <input
        v-model="query"
        type="search"
        class="search"
        :placeholder="t('iconPicker.search')"
        autocomplete="off"
      />
    </div>

    <div class="grid" role="listbox">
      <button
        v-for="id in filtered"
        :key="id"
        type="button"
        class="cell pressable"
        :class="{ on: selectedId === id }"
        role="option"
        :aria-selected="selectedId === id"
        :aria-label="id"
        :title="id"
        @click="pick(id)"
      >
        <AppIcon :name="id" :size="22" />
      </button>
      <p v-if="filtered.length === 0" class="empty">{{ t('iconPicker.empty') }}</p>
    </div>
  </div>
</template>

<style scoped>
.picker {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
}

.top {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  padding: 12px 14px;
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--header-bg);
  backdrop-filter: blur(20px) saturate(180%);
}

.top h2 {
  margin: 0;
  text-align: center;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.back {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 999px;
  background: var(--row-bg);
  cursor: pointer;
  display: grid;
  place-items: center;
  color: var(--text-primary);
}

.spacer {
  width: 36px;
}

.search-wrap {
  position: relative;
  margin: 12px 14px 4px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-secondary);
  pointer-events: none;
}

.search {
  width: 100%;
  border: 1px solid var(--hairline);
  border-radius: 12px;
  padding: 10px 12px 10px 36px;
  background: var(--row-bg);
  outline: none;
}

.search:focus {
  border-color: var(--accent);
}

.grid {
  flex: 1;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  padding: 12px 14px 24px;
  align-content: start;
}

.cell {
  aspect-ratio: 1;
  border: 1px solid var(--hairline);
  border-radius: 12px;
  background: var(--row-bg);
  color: var(--text-primary);
  cursor: pointer;
  display: grid;
  place-items: center;
}

.cell.on {
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.empty {
  grid-column: 1 / -1;
  margin: 24px 0;
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
}

@media (prefers-reduced-transparency: reduce) {
  .top {
    backdrop-filter: none;
  }
}
</style>
