<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { animate } from 'motion'
import type { Group } from '@/shared/types'
import { useErrorMessage } from '../composables/useErrorMessage'
import { useReducedMotion } from '../composables/useReducedMotion'
import { useFavoritesStore } from '../stores/favorites'
import AppSelect from './AppSelect.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    groups: Group[]
    preferredGroupId?: string | null
  }>(),
  { preferredGroupId: null },
)

const emit = defineEmits<{
  close: []
  added: []
}>()

const { t } = useI18n()
const errorMessage = useErrorMessage()
const store = useFavoritesStore()
const { reduced } = useReducedMotion()

const title = ref('')
const url = ref('')
const faviconUrl = ref<string | undefined>()
const groupId = ref('')
const error = ref('')
const tabUnavailable = ref(false)
const panelRef = ref<HTMLElement | null>(null)

const defaultGroupId = computed(
  () => props.groups.find((g) => g.isDefault)?.id ?? props.groups[0]?.id ?? '',
)

function resolveInitialGroupId() {
  const preferred = props.preferredGroupId
  if (preferred && props.groups.some((g) => g.id === preferred)) {
    return preferred
  }
  return defaultGroupId.value
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    error.value = ''
    groupId.value = resolveInitialGroupId()
    title.value = ''
    url.value = ''
    faviconUrl.value = undefined
    tabUnavailable.value = false
    const tab = await store.fetchActiveTab()
    if (tab) {
      title.value = tab.title
      url.value = tab.url
      faviconUrl.value = tab.favIconUrl
    } else {
      tabUnavailable.value = true
    }
  },
)

onMounted(() => {
  /* sheet enter handled by watch open + nextTick animate in watchEffect below */
})

watch(
  () => [props.open, panelRef.value] as const,
  async ([open, el]) => {
    if (!el) return
    if (reduced.value) {
      el.style.opacity = open ? '1' : '0'
      el.style.transform = 'none'
      return
    }
    if (open) {
      el.style.opacity = '0'
      el.style.transform = 'scale(0.96) translateY(-8px)'
      await animate(
        el,
        { opacity: 1, transform: 'scale(1) translateY(0px)' },
        { type: 'spring', bounce: 0, duration: 0.35 },
      )
    }
  },
)

async function fillFromCurrent() {
  const tab = await store.fetchActiveTab()
  if (!tab) {
    tabUnavailable.value = true
    return
  }
  tabUnavailable.value = false
  title.value = tab.title
  url.value = tab.url
  faviconUrl.value = tab.favIconUrl
}

async function submit() {
  error.value = ''
  try {
    await store.addBookmark({
      title: title.value,
      url: url.value,
      faviconUrl: faviconUrl.value,
      groupId: groupId.value || defaultGroupId.value,
    })
    emit('added')
    emit('close')
  } catch (e) {
    error.value = errorMessage(e, 'add.failed')
  }
}
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div
      ref="panelRef"
      class="sheet"
      role="dialog"
      :aria-label="t('a11y.addBookmark')"
    >
      <h2>{{ t('add.title') }}</h2>
      <p v-if="tabUnavailable" class="hint">{{ t('add.tabUnavailable') }}</p>
      <label>
        {{ t('add.titleLabel') }}
        <input v-model="title" type="text" />
      </label>
      <label>
        {{ t('add.urlLabel') }}
        <input v-model="url" type="url" placeholder="https://" />
      </label>
      <div class="field">
        {{ t('add.groupLabel') }}
        <AppSelect
          v-model="groupId"
          :options="groups.map((g) => ({ value: g.id, label: g.name }))"
          :aria-label="t('add.groupLabel')"
        />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button
          type="button"
          class="secondary pressable"
          :disabled="tabUnavailable"
          @click="fillFromCurrent"
        >
          {{ t('add.saveCurrent') }}
        </button>
        <button type="button" class="primary pressable" @click="submit">
          {{ t('add.submit') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  z-index: 30;
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  /* Sit near the left IndexBar add control */
  padding: 48px 12px 12px 36px;
}

.sheet {
  width: 100%;
  border-radius: 16px;
  background: var(--elevated);
  backdrop-filter: blur(20px) saturate(180%);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transform-origin: top left;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
}

h2 {
  margin: 0;
  font-size: 17px;
  letter-spacing: -0.015em;
}

label,
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

input {
  border: 1px solid var(--hairline);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--row-bg);
}

.hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.error {
  margin: 0;
  color: #ff3b30;
  font-size: 12px;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.primary,
.secondary {
  flex: 1;
  border: none;
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 600;
}

.primary {
  background: var(--accent);
  color: #fff;
}

.secondary {
  background: var(--row-bg);
}

.secondary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
