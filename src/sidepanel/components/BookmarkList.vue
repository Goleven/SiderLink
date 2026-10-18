<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { sortBookmarksInGroup, sortGroups } from '@/shared/domain'
import type { BookmarkItem, Group } from '@/shared/types'
import BookmarkRow from './BookmarkRow.vue'
import GroupSection from './GroupSection.vue'

const props = defineProps<{
  groups: Group[]
  bookmarks: BookmarkItem[]
  selectedGroupId: string | null
}>()

const emit = defineEmits<{
  open: [id: string]
  editBookmark: [id: string]
  requestDeleteBookmark: [id: string]
  bookmarkPointerDown: [event: PointerEvent, bookmarkId: string, groupId: string]
}>()

const { t } = useI18n()

const visibleGroups = computed(() => {
  if (!props.selectedGroupId) return []
  return sortGroups(props.groups).filter((g) => g.id === props.selectedGroupId)
})

const visibleItems = computed(() => {
  const groupId = props.selectedGroupId
  if (!groupId) return []
  return sortBookmarksInGroup(props.bookmarks, groupId)
})

const isEmpty = computed(() => visibleItems.value.length === 0)
</script>

<template>
  <div class="list">
    <p v-if="isEmpty" class="empty">{{ t('app.empty') }}</p>
    <template v-else>
      <GroupSection
        v-for="group in visibleGroups"
        :key="group.id"
        :group="group"
      >
        <BookmarkRow
          v-for="item in visibleItems"
          :key="item.id"
          :item="item"
          @open="emit('open', item.id)"
          @edit="emit('editBookmark', item.id)"
          @request-delete="emit('requestDeleteBookmark', item.id)"
          @row-pointer-down="
            emit('bookmarkPointerDown', $event, item.id, group.id)
          "
        />
      </GroupSection>
    </template>
  </div>
</template>

<style scoped>
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px 8px 24px;
}

.empty {
  margin: 48px 12px;
  color: var(--text-secondary);
  font-size: 15px;
  font-weight: 500;
  letter-spacing: -0.01em;
  text-align: center;
}
</style>
