<script setup lang="ts">
import type { BookmarkCategory } from '../types/bookmark';
import BookmarkCard from './BookmarkCard.vue';

defineProps<{
  category: BookmarkCategory;
}>();

const emit = defineEmits<{
  delete: [id: string];
}>();
</script>

<template>
  <section :id="category.id" class="bookmark-section">
    <div class="section-heading">
      <div>
        <h2>{{ category.name }}</h2>
        <p>{{ category.description }}</p>
      </div>
      <span>{{ category.items.length }} 个站点</span>
    </div>

    <div class="bookmark-grid">
      <BookmarkCard
        v-for="bookmark in category.items"
        :key="bookmark.id"
        :bookmark="bookmark"
        @delete="emit('delete', $event)"
      />
    </div>
  </section>
</template>
