<script setup lang="ts">
import type { BookmarkCategory } from '../types/bookmark';
import BookmarkCard from './BookmarkCard.vue';

defineProps<{
  category: BookmarkCategory;
  editMode: boolean;
  canDeleteCategory: boolean;
}>();

const emit = defineEmits<{
  delete: [id: string];
  deleteCategory: [categoryId: string];
  dragStart: [categoryId: string, id: string];
  drop: [categoryId: string, id: string];
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
        v-for="bookmark in category.items"
        :key="bookmark.id"
        :bookmark="bookmark"
        :edit-mode="editMode"
        @delete="emit('delete', $event)"
        @drag-start="emit('dragStart', category.id, $event)"
        @drop="emit('drop', category.id, $event)"
      />
    </div>
  </section>
</template>
