<script setup lang="ts">
defineProps<{
  tags: string[];
  selectedTags: string[];
  deletableTags: string[];
}>();

const emit = defineEmits<{
  toggle: [tag: string];
  delete: [tag: string];
  clear: [];
}>();
</script>

<template>
  <section v-if="tags.length" class="tag-filter" aria-label="标签筛选">
    <div class="tag-filter__head">
      <span>常用标签</span>
      <button
        v-if="selectedTags.length"
        class="text-button"
        type="button"
        @click="emit('clear')"
      >
        清空筛选
      </button>
    </div>
    <div class="tag-filter__list">
      <button
        v-for="tag in tags"
        :key="tag"
        class="filter-tag"
        :class="{ 'is-active': selectedTags.includes(tag) }"
        type="button"
        @click="emit('toggle', tag)"
      >
        <span>{{ tag }}</span>
        <span
          v-if="deletableTags.includes(tag)"
          class="filter-tag__remove"
          role="button"
          tabindex="0"
          :aria-label="`删除标签 ${tag}`"
          @click.stop="emit('delete', tag)"
          @keydown.enter.stop.prevent="emit('delete', tag)"
        >
          ×
        </span>
      </button>
    </div>
  </section>
</template>
