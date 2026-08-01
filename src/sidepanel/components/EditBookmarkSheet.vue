<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BookmarkItem, Group } from '@/shared/types'
import { useErrorMessage } from '../composables/useErrorMessage'
import { useFavoritesStore } from '../stores/favorites'
import AppSelect from './AppSelect.vue'
import FaviconUrlField from './FaviconUrlField.vue'

const props = defineProps<{
  open: boolean
  item: BookmarkItem | null
  groups: Group[]
}>()

const emit = defineEmits<{
  close: []
  requestDelete: [id: string]
}>()

const { t } = useI18n()
const errorMessage = useErrorMessage()
const store = useFavoritesStore()
const title = ref('')
const url = ref('')
const faviconUrl = ref('')
const groupId = ref('')
const error = ref('')

watch(
  () => [props.open, props.item] as const,
  ([open, item]) => {
    if (!open || !item) return
    title.value = item.title
    url.value = item.url
    faviconUrl.value = item.faviconUrl ?? ''
    groupId.value = item.groupId
    error.value = ''
  },
)

const canSave = computed(() => Boolean(props.item))

async function save() {
  if (!props.item) return
  error.value = ''
  try {
    const logo = faviconUrl.value.trim()
    await store.updateBookmark(props.item.id, {
      title: title.value,
      url: url.value,
      faviconUrl: logo || null,
      groupId: groupId.value,
    })
    emit('close')
  } catch (e) {
    error.value = errorMessage(e, 'editBookmark.saveFailed')
  }
}

function requestDelete() {
  if (!props.item) return
  emit('requestDelete', props.item.id)
}
</script>

<template>
  <div v-if="open && item" class="overlay" @click.self="emit('close')">
    <div class="sheet" role="dialog" :aria-label="t('a11y.editBookmark')">
      <h2>{{ t('editBookmark.title') }}</h2>
      <label>
        {{ t('editBookmark.titleLabel') }}
        <input v-model="title" type="text" />
      </label>
      <label>
        {{ t('editBookmark.urlLabel') }}
        <input v-model="url" type="url" />
      </label>
      <FaviconUrlField
        v-model="faviconUrl"
        :label="t('editBookmark.faviconLabel')"
        :placeholder="t('editBookmark.faviconPlaceholder')"
      />
      <div class="field">
        {{ t('editBookmark.groupLabel') }}
        <AppSelect
          v-model="groupId"
          :options="groups.map((g) => ({ value: g.id, label: g.name }))"
          :aria-label="t('editBookmark.groupLabel')"
        />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button type="button" class="danger pressable" @click="requestDelete">
          {{ t('editBookmark.delete') }}
        </button>
        <button
          type="button"
          class="primary pressable"
          :disabled="!canSave"
          @click="save"
        >
          {{ t('editBookmark.save') }}
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
  align-items: flex-end;
  justify-content: center;
  padding: 12px;
}
.sheet {
  width: 100%;
  border-radius: 16px;
  background: var(--elevated);
  backdrop-filter: blur(20px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
h2 {
  margin: 0;
  font-size: 17px;
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
.error {
  margin: 0;
  color: #ff3b30;
  font-size: 12px;
}
.actions {
  display: flex;
  gap: 8px;
}
.primary,
.danger {
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
.primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.danger {
  background: rgba(255, 59, 48, 0.12);
  color: #ff3b30;
}
</style>
