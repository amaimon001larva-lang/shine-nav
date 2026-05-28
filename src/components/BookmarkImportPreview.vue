<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ChromeImportBookmark } from '../types/bookmark';

const props = defineProps<{
  open: boolean;
  bookmarks: ChromeImportBookmark[];
  duplicateUrls: Set<string>;
}>();

const emit = defineEmits<{
  close: [];
  import: [bookmarks: ChromeImportBookmark[]];
}>();

const selectedIds = ref<Set<string>>(new Set());

const importableBookmarks = computed(() =>
  props.bookmarks.filter((bookmark) => !props.duplicateUrls.has(bookmark.url)),
);
const categoryCount = computed(
  () => new Set(props.bookmarks.map((bookmark) => bookmark.categoryName)).size,
);
const duplicateCount = computed(() => props.bookmarks.length - importableBookmarks.value.length);
const selectedBookmarks = computed(() =>
  importableBookmarks.value.filter((bookmark) => selectedIds.value.has(bookmark.id)),
);
const allSelected = computed(
  () =>
    importableBookmarks.value.length > 0 &&
    selectedIds.value.size === importableBookmarks.value.length,
);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    selectedIds.value = new Set(importableBookmarks.value.map((bookmark) => bookmark.id));
  },
);

function toggleBookmark(id: string) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedIds.value = next;
}

function toggleAll() {
  selectedIds.value = allSelected.value
    ? new Set()
    : new Set(importableBookmarks.value.map((bookmark) => bookmark.id));
}

function handleImport() {
  emit('import', selectedBookmarks.value);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" @click.self="emit('close')">
      <section class="bookmark-dialog import-dialog">
        <div class="dialog-heading">
          <div>
            <h2>导入 Chrome 书签</h2>
            <p>
              识别到 {{ bookmarks.length }} 个书签、{{ categoryCount }} 个分类，默认跳过
              {{ duplicateCount }} 个重复 URL。
            </p>
          </div>
          <button class="icon-button" type="button" aria-label="关闭" @click="emit('close')">
            ×
          </button>
        </div>

        <div class="import-summary">
          <label class="check-row">
            <input type="checkbox" :checked="allSelected" @change="toggleAll" />
            <span>选择全部可导入书签</span>
          </label>
          <span>{{ selectedBookmarks.length }} 个将导入</span>
        </div>

        <div class="import-list">
          <label
            v-for="bookmark in bookmarks"
            :key="bookmark.id"
            class="import-row"
            :class="{ 'is-disabled': duplicateUrls.has(bookmark.url) }"
          >
            <input
              type="checkbox"
              :checked="selectedIds.has(bookmark.id)"
              :disabled="duplicateUrls.has(bookmark.url)"
              @change="toggleBookmark(bookmark.id)"
            />
            <img class="bookmark-card__icon" :src="bookmark.icon" :alt="`${bookmark.name} 图标`" />
            <span>
              <strong>{{ bookmark.name }}</strong>
              <small>{{ bookmark.categoryName }}{{ bookmark.path?.length ? ` / ${bookmark.path.join(' / ')}` : '' }}</small>
            </span>
            <em v-if="duplicateUrls.has(bookmark.url)">重复</em>
          </label>
        </div>

        <div class="dialog-actions">
          <button class="secondary-button" type="button" @click="emit('close')">取消</button>
          <button
            class="primary-button"
            type="button"
            :disabled="selectedBookmarks.length === 0"
            @click="handleImport"
          >
            导入选中书签
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
