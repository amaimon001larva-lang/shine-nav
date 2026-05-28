<script setup lang="ts">
import type { BookmarkCategory } from '../types/bookmark';
import BookmarkCard from './BookmarkCard.vue';

defineProps<{
  category: BookmarkCategory;
  showSortActions: boolean;
  canDeleteCategory: boolean;
}>();

const emit = defineEmits<{
  delete: [id: string];
  deleteCategory: [categoryId: string];
  moveUp: [categoryId: string, id: string];
  moveDown: [categoryId: string, id: string];
}>();
</script>

<template>
  <section :id="category.id" class="bookmark-section">
    <div class="section-heading">
      <div>
        <h2>{{ category.name }}</h2>
        <p>{{ category.description }}</p>
      </div>
      <div class="section-actions">
        <span>{{ category.items.length }} 个站点</span>
        <button
          v-if="canDeleteCategory"
          class="delete-link"
          type="button"
          @click="emit('deleteCategory', category.id)"
        >
          删除分类
        </button>
      </div>
    </div>

    <div class="bookmark-grid">
      <BookmarkCard
        v-for="(bookmark, index) in category.items"
        :key="bookmark.id"
        :bookmark="bookmark"
        :show-sort-actions="showSortActions"
        :can-move-up="index > 0"
        :can-move-down="index < category.items.length - 1"
        @delete="emit('delete', $event)"
        @move-up="emit('moveUp', category.id, $event)"
        @move-down="emit('moveDown', category.id, $event)"
      />
    </div>
  </section>
</template>
