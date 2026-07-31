<script setup lang="ts">
import type { Group } from '@/shared/types'

defineProps<{ group: Group }>()
</script>

<template>
  <section class="section" :data-group-id="group.id">
    <div class="body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
