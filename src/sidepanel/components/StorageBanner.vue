<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ message: string }>()
const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="storage-banner" role="alert">
    <span>{{ message }}</span>
    <button type="button" class="pressable" @click="emit('retry')">
      {{ t('storage.retry') }}
    </button>
  </div>
</template>

<style scoped>
.storage-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(255, 59, 48, 0.12);
  color: var(--text-primary);
  font-size: 13px;
}
.storage-banner button {
  border: none;
  background: transparent;
  color: #ff3b30;
  font-weight: 600;
  cursor: pointer;
}
</style>
