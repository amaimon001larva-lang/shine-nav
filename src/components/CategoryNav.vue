<script setup lang="ts">
import type { BookmarkCategory } from '../types/bookmark';

defineProps<{
  categories: BookmarkCategory[];
  activeCategoryId: string;
}>();

const emit = defineEmits<{
  select: [id: string];
  add: [];
  rename: [id: string];
  delete: [id: string];
}>();
</script>

<template>
  <nav class="category-nav" aria-label="书签分类">
    <div
      v-for="category in categories"
      :key="category.id"
      class="category-nav__row"
      :class="{ 'is-active': activeCategoryId === category.id }"
    >
      <button class="category-nav__item" type="button" @click="emit('select', category.id)">
        <span>{{ category.name }}</span>
        <small>{{ category.items.length }}</small>
      </button>
      <div class="category-nav__tools">
        <button type="button" title="改名" @click="emit('rename', category.id)">改</button>
        <button type="button" title="删除" @click="emit('delete', category.id)">删</button>
      </div>
    </div>
    <button class="category-nav__add" type="button" @click="emit('add')">+ 新增分类</button>
  </nav>
</template>
