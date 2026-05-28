<script setup lang="ts">
import type { BookmarkItem } from '../types/bookmark';

defineProps<{
  bookmark: BookmarkItem;
  editMode: boolean;
}>();

const emit = defineEmits<{
  delete: [id: string];
  edit: [bookmark: BookmarkItem];
  dragStart: [id: string];
  drop: [id: string];
}>();
</script>

<template>
  <article
    class="bookmark-card"
    :class="{ 'is-editing': editMode }"
    :draggable="editMode"
    @dragstart="emit('dragStart', bookmark.id)"
    @dragover.prevent
    @drop.stop.prevent="emit('drop', bookmark.id)"
  >
    <div class="bookmark-card__top">
      <img class="bookmark-card__icon" :src="bookmark.icon" :alt="`${bookmark.name} 图标`" />
      <div class="bookmark-card__title">
        <h3>{{ bookmark.name }}</h3>
        <p>{{ bookmark.description }}</p>
      </div>
      <div v-if="editMode" class="drag-handle">拖拽</div>
    </div>

    <div class="bookmark-card__footer">
      <div class="tag-list" aria-label="标签">
        <span v-for="tag in bookmark.tags" :key="tag" class="tag">{{ tag }}</span>
      </div>
      <div class="card-actions">
        <button class="edit-link" type="button" @click="emit('edit', bookmark)">
          编辑
        </button>
        <button class="delete-link" type="button" @click="emit('delete', bookmark.id)">
          删除
        </button>
        <a
          v-if="!editMode"
          class="visit-link"
          :href="bookmark.url"
          target="_blank"
          rel="noreferrer"
        >
          访问
        </a>
      </div>
    </div>
  </article>
</template>
