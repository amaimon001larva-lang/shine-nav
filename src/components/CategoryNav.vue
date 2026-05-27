<script setup lang="ts">
import type { BookmarkCategory } from '../types/bookmark';

defineProps<{
  categories: BookmarkCategory[];
  activeCategoryId: string;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();
</script>

<template>
  <nav class="category-nav" aria-label="书签分类">
    <button
      v-for="category in categories"
      :key="category.id"
      class="category-nav__item"
      :class="{ 'is-active': activeCategoryId === category.id }"
      type="button"
      @click="emit('select', category.id)"
    >
      <span>{{ category.name }}</span>
      <small>{{ category.items.length }}</small>
    </button>
  </nav>
</template>
