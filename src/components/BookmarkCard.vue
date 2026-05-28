<script setup lang="ts">
import type { BookmarkItem } from '../types/bookmark';

defineProps<{
  bookmark: BookmarkItem;
  showSortActions: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}>();

const emit = defineEmits<{
  delete: [id: string];
  moveUp: [id: string];
  moveDown: [id: string];
}>();
</script>

<template>
  <article class="bookmark-card">
    <div class="bookmark-card__top">
      <img class="bookmark-card__icon" :src="bookmark.icon" :alt="`${bookmark.name} 图标`" />
      <div class="bookmark-card__title">
        <h3>{{ bookmark.name }}</h3>
        <p>{{ bookmark.description }}</p>
      </div>
    </div>

    <div class="bookmark-card__footer">
      <div class="tag-list" aria-label="标签">
        <span v-for="tag in bookmark.tags" :key="tag" class="tag">{{ tag }}</span>
      </div>
      <div class="card-actions">
        <button
          v-if="showSortActions"
          class="move-link"
          type="button"
          :disabled="!canMoveUp"
          @click="emit('moveUp', bookmark.id)"
        >
          上移
        </button>
        <button
          v-if="showSortActions"
          class="move-link"
          type="button"
          :disabled="!canMoveDown"
          @click="emit('moveDown', bookmark.id)"
        >
          下移
        </button>
        <button
          v-if="bookmark.source === 'manual' || bookmark.source === 'chrome-import'"
          class="delete-link"
          type="button"
          @click="emit('delete', bookmark.id)"
        >
          删除
        </button>
        <a class="visit-link" :href="bookmark.url" target="_blank" rel="noreferrer">访问</a>
      </div>
    </div>
  </article>
</template>
