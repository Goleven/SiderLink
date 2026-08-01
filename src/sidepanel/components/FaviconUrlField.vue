<script setup lang="ts">
import { ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'

const model = defineModel<string>({ default: '' })

defineProps<{
  label: string
  placeholder?: string
}>()

const broken = ref(false)

watch(model, () => {
  broken.value = false
})
</script>

<template>
  <div class="favicon-field">
    <label class="controls">
      {{ label }}
      <input
        v-model="model"
        type="url"
        class="input"
        :placeholder="placeholder ?? 'https://'"
        autocomplete="off"
        spellcheck="false"
      />
    </label>
    <span class="preview" aria-hidden="true">
      <img
        v-if="model.trim() && !broken"
        class="preview-img"
        :src="model.trim()"
        alt=""
        @error="broken = true"
      />
      <AppIcon
        v-else
        name="earth"
        :size="22"
        :stroke-width="1.5"
      />
    </span>
  </div>
</template>

<style scoped>
.favicon-field {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  font-size: 12px;
  color: var(--text-secondary);
}

.preview {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: var(--row-bg);
  color: var(--text-secondary);
  border: 1px solid color-mix(in srgb, var(--hairline) 80%, transparent);
  overflow: hidden;
}

.preview-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  display: block;
}

.controls {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input {
  width: 100%;
  border: 1px solid var(--hairline);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--row-bg);
  color: var(--text-primary);
  font-size: 14px;
  letter-spacing: -0.01em;
  box-sizing: border-box;
}

.input::placeholder {
  color: color-mix(in srgb, var(--text-secondary) 70%, transparent);
}
</style>
