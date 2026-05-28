<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import HeaderSearch from './components/HeaderSearch.vue';
import CategoryNav from './components/CategoryNav.vue';
import BookmarkSection from './components/BookmarkSection.vue';
import AddBookmarkDialog from './components/AddBookmarkDialog.vue';
import bookmarkData from './data/bookmarks.json';
import type { BookmarkCategory, UserBookmarkInput } from './types/bookmark';
import {
  addUserBookmark,
  buildUserBookmark,
  mergeCategories,
  parseImportedCategories,
  readUserCategories,
  removeUserBookmark,
  saveUserCategories,
} from './utils/bookmarkStorage';

const defaultCategories = bookmarkData as BookmarkCategory[];
const userCategories = ref<BookmarkCategory[]>([]);
const searchText = ref('');
const activeCategoryId = ref(defaultCategories[0]?.id ?? '');
const isAddDialogOpen = ref(false);
const importInput = ref<HTMLInputElement | null>(null);

const normalizedSearch = computed(() => searchText.value.trim().toLowerCase());
const categories = computed(() => mergeCategories(defaultCategories, userCategories.value));
const userBookmarkCount = computed(() =>
  userCategories.value.reduce((total, category) => total + category.items.length, 0),
);

const filteredCategories = computed(() => {
  if (!normalizedSearch.value) {
    return categories.value;
  }

  return categories.value
    .map((category) => {
      const items = category.items.filter((bookmark) => {
        const searchableText = [
          bookmark.name,
          bookmark.description,
          bookmark.url,
          ...bookmark.tags,
        ]
          .join(' ')
          .toLowerCase();

        return searchableText.includes(normalizedSearch.value);
      });

      return { ...category, items };
    })
    .filter((category) => category.items.length > 0);
});

const visibleBookmarkCount = computed(() =>
  filteredCategories.value.reduce((total, category) => total + category.items.length, 0),
);

function persistUserCategories(nextCategories: BookmarkCategory[]) {
  userCategories.value = nextCategories;
  saveUserCategories(nextCategories);
}

function handleAddBookmark(input: UserBookmarkInput) {
  const bookmark = buildUserBookmark(input);
  const nextCategories = addUserBookmark(
    userCategories.value,
    input.categoryId,
    input.categoryName,
    bookmark,
  );

  persistUserCategories(nextCategories);
  isAddDialogOpen.value = false;
  activeCategoryId.value = input.categoryId;
  requestAnimationFrame(() => scrollToCategory(input.categoryId));
}

function handleDeleteBookmark(id: string) {
  persistUserCategories(removeUserBookmark(userCategories.value, id));
}

function exportUserBookmarks() {
  const blob = new Blob([JSON.stringify(userCategories.value, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bookmarks-user.json';
  link.click();
  URL.revokeObjectURL(url);
}

function openImportDialog() {
  importInput.value?.click();
}

function handleImport(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const importedCategories = parseImportedCategories(String(reader.result || '[]'));
      persistUserCategories(importedCategories);
      activeCategoryId.value = importedCategories[0]?.id || defaultCategories[0]?.id || '';
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '导入失败，请检查 JSON 文件');
    } finally {
      input.value = '';
    }
  };
  reader.readAsText(file);
}

function scrollToCategory(id: string) {
  activeCategoryId.value = id;
  document.getElementById(id)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

function handleScroll() {
  const candidates = filteredCategories.value
    .map((category) => {
      const element = document.getElementById(category.id);
      if (!element) return null;
      return {
        id: category.id,
        top: Math.abs(element.getBoundingClientRect().top - 120),
      };
    })
    .filter(Boolean) as Array<{ id: string; top: number }>;

  const closest = candidates.sort((a, b) => a.top - b.top)[0];
  if (closest) {
    activeCategoryId.value = closest.id;
  }
}

onMounted(() => {
  userCategories.value = readUserCategories();
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
  <div class="app-shell">
    <HeaderSearch
      v-model="searchText"
      :user-bookmark-count="userBookmarkCount"
      @add="isAddDialogOpen = true"
      @export="exportUserBookmarks"
      @import="openImportDialog"
    />
    <input
      ref="importInput"
      class="visually-hidden"
      type="file"
      accept="application/json,.json"
      @change="handleImport"
    />

    <main>
      <section class="hero-panel">
        <p class="eyebrow">Personal Bookmark Hub</p>
        <h2>我的设计、AI 与开发资源导航</h2>
        <p>
          把高频网站按工作流收进一个清爽入口，搜索、分类和访问都尽量保持轻量。
        </p>
        <div class="hero-meta">
          <span>{{ categories.length }} 个分类</span>
          <span>{{ visibleBookmarkCount }} 个站点</span>
          <span>{{ userBookmarkCount }} 个本地新增</span>
        </div>
      </section>

      <div class="layout">
        <aside class="sidebar">
          <CategoryNav
            :categories="filteredCategories"
            :active-category-id="activeCategoryId"
            @select="scrollToCategory"
          />
        </aside>

        <div class="content-flow">
          <template v-if="filteredCategories.length">
            <BookmarkSection
              v-for="category in filteredCategories"
              :key="category.id"
              :category="category"
              @delete="handleDeleteBookmark"
            />
          </template>
          <section v-else class="empty-state">
            <h2>没有找到相关站点</h2>
            <p>换一个关键词，或在 src/data/bookmarks.json 里新增你常用的网站。</p>
          </section>
        </div>
      </div>
    </main>

    <AddBookmarkDialog
      :open="isAddDialogOpen"
      :categories="categories"
      @close="isAddDialogOpen = false"
      @submit="handleAddBookmark"
    />
  </div>
</template>
