<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  FALLBACK_GROUP_ICON,
  resolveGroupIconId,
} from '@/shared/icons'
import type { Group } from '@/shared/types'
import { useErrorMessage } from '../composables/useErrorMessage'
import { useFavoritesStore } from '../stores/favorites'
import AppIcon from './AppIcon.vue'
import IconPickerView from './IconPickerView.vue'

const props = defineProps<{
  open: boolean
  group: Group | null
  mode: 'edit' | 'create'
}>()

const emit = defineEmits<{
  close: []
  created: [id: string]
}>()
const { t } = useI18n()
const errorMessage = useErrorMessage()
const store = useFavoritesStore()

const name = ref('')
const icon = ref<string>(FALLBACK_GROUP_ICON)
const error = ref('')
const showPicker = ref(false)

watch(
  () => [props.open, props.group, props.mode] as const,
  ([open, group, mode]) => {
    if (!open) {
      showPicker.value = false
      return
    }
    error.value = ''
    showPicker.value = false
    if (mode === 'create') {
      name.value = ''
      icon.value = FALLBACK_GROUP_ICON
    } else if (group) {
      name.value = group.name
      icon.value = resolveGroupIconId(group.icon)
    }
  },
)

const isDefault = computed(() => Boolean(props.group?.isDefault))

function onPickIcon(id: string) {
  icon.value = id
}

async function save() {
  error.value = ''
  try {
    if (props.mode === 'create') {
      const id = await store.addGroup({ name: name.value, icon: icon.value })
      if (id) emit('created', id)
    } else if (props.group) {
      await store.updateGroup(props.group.id, {
        name: name.value,
        icon: icon.value,
      })
    }
    emit('close')
  } catch (e) {
    error.value = errorMessage(e, 'group.saveFailed')
  }
}

async function remove() {
  if (!props.group || props.group.isDefault) {
    error.value = t('group.defaultCannotDelete')
    return
  }
  error.value = ''
  try {
    await store.deleteGroup(props.group.id)
    emit('close')
  } catch (e) {
    error.value = errorMessage(e, 'group.deleteFailed')
  }
}
</script>

<template>
  <div v-if="open" class="overlay" @click.self="emit('close')">
    <div
      class="sheet"
      role="dialog"
      :aria-label="mode === 'create' ? t('a11y.createGroup') : t('a11y.editGroup')"
    >
      <h2>
        {{ mode === 'create' ? t('group.createTitle') : t('group.editTitle') }}
      </h2>
      <div class="field">
        <span class="label">{{ t('group.icon') }}</span>
        <button
          type="button"
          class="icon-btn pressable"
          :aria-label="t('group.pickIcon')"
          @click="showPicker = true"
        >
          <AppIcon :name="icon" :size="22" />
        </button>
      </div>
      <label>
        {{ t('group.name') }}
        <input v-model="name" type="text" />
      </label>
      <p v-if="isDefault" class="hint">{{ t('group.defaultHint') }}</p>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button
          v-if="mode === 'edit' && !isDefault"
          type="button"
          class="danger pressable"
          @click="remove"
        >
          {{ t('group.delete') }}
        </button>
        <button type="button" class="primary pressable" @click="save">
          {{ t('group.save') }}
        </button>
      </div>
    </div>

    <IconPickerView
      :open="showPicker"
      :selected="icon"
      @close="showPicker = false"
      @select="onPickIcon"
    />
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  z-index: 30;
  display: block;
  padding: 0;
}
.overlay:has(.picker) {
  background: transparent;
}
.sheet {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  width: auto;
  max-width: none;
  margin: 0 auto;
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
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.label {
  font-size: 12px;
  color: var(--text-secondary);
}
.icon-btn {
  width: 44px;
  height: 44px;
  border: 1px solid var(--hairline);
  border-radius: 12px;
  padding: 0;
  background: var(--row-bg);
  cursor: pointer;
  display: grid;
  place-items: center;
  color: var(--accent);
  flex-shrink: 0;
}
label {
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
.danger {
  background: rgba(255, 59, 48, 0.12);
  color: #ff3b30;
}
</style>
