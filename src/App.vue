<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import HeaderSearch from './components/HeaderSearch.vue';
import CategoryNav from './components/CategoryNav.vue';
import BookmarkSection from './components/BookmarkSection.vue';
import AddBookmarkDialog from './components/AddBookmarkDialog.vue';
import BookmarkImportPreview from './components/BookmarkImportPreview.vue';
import TagFilter from './components/TagFilter.vue';
import bookmarkData from './data/bookmarks.json';
import type { BookmarkCategory, ChromeImportBookmark, UserBookmarkInput } from './types/bookmark';
import { normalizeCategories } from './utils/bookmarkNormalize';
import { parseChromeBookmarksHtml } from './utils/bookmarkParser';
import {
  addImportedBookmarks,
  addUserBookmark,
  buildUserBookmark,
  mergeCategories,
  parseImportedCategories,
  readSettings,
  readSortOrders,
  readUserCategories,
  removeUserBookmark,
  removeUserCategory,
  removeUserTag,
  renameUserCategory,
  saveSettings,
  saveSortOrders,
  saveUserCategories,
  type BookmarkSettings,
  type SortOrders,
} from './utils/bookmarkStorage';

const defaultCategories = normalizeCategories(bookmarkData as BookmarkCategory[], 'default');
const userCategories = ref<BookmarkCategory[]>([]);
const sortOrders = ref<SortOrders>({});
const settings = ref<BookmarkSettings>({
  deletedBookmarkIds: [],
  hiddenCategoryIds: [],
  categoryNameOverrides: {},
});
const searchText = ref('');
const activeCategoryId = ref(defaultCategories[0]?.id ?? '');
const editMode = ref(false);
const draggedBookmark = ref<{ categoryId: string; id: string } | null>(null);
const isAddDialogOpen = ref(false);
const importInput = ref<HTMLInputElement | null>(null);
const chromeImportInput = ref<HTMLInputElement | null>(null);
const isImportPreviewOpen = ref(false);
const chromePreviewBookmarks = ref<ChromeImportBookmark[]>([]);
const duplicateChromeUrls = ref<Set<string>>(new Set());
const selectedTags = ref<string[]>([]);

const normalizedSearch = computed(() => searchText.value.trim().toLowerCase());
const categories = computed(() => {
  return mergeCategories(defaultCategories, userCategories.value, sortOrders.value)
    .filter((category) => !settings.value.hiddenCategoryIds.includes(category.id))
    .map((category) => ({
      ...category,
      name: settings.value.categoryNameOverrides[category.id] || category.name,
      items: category.items
        .filter((bookmark) => !settings.value.deletedBookmarkIds.includes(bookmark.id))
        .map((bookmark) => ({
          ...bookmark,
          category: settings.value.categoryNameOverrides[category.id] || bookmark.category,
        })),
    }));
});
const userBookmarkCount = computed(() =>
  userCategories.value.reduce((total, category) => total + category.items.length, 0),
);
const allTags = computed(() => {
  const counts = new Map<string, number>();
  categories.value.forEach((category) => {
    category.items.forEach((bookmark) => {
      bookmark.tags?.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
    .slice(0, 28)
    .map(([tag]) => tag);
});
const userCategoryIds = computed(() => new Set(userCategories.value.map((category) => category.id)));
const userTags = computed(() => {
  const tags = new Set<string>();
  userCategories.value.forEach((category) => {
    category.items.forEach((bookmark) => {
      bookmark.tags?.forEach((tag) => tags.add(tag));
    });
  });
  return Array.from(tags);
});

const filteredCategories = computed(() => {
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

        const matchesSearch =
          !normalizedSearch.value || searchableText.includes(normalizedSearch.value);
        const matchesTags = selectedTags.value.every((tag) => bookmark.tags?.includes(tag));
        return matchesSearch && matchesTags;
      });

      return { ...category, items };
    })
    .filter((category) => {
      if (normalizedSearch.value || selectedTags.value.length) {
        return category.items.length > 0;
      }
      return true;
    });
});

const visibleBookmarkCount = computed(() =>
  filteredCategories.value.reduce((total, category) => total + category.items.length, 0),
);

function persistUserCategories(nextCategories: BookmarkCategory[]) {
  userCategories.value = nextCategories;
  saveUserCategories(nextCategories);
}

function persistSortOrders(nextSortOrders: SortOrders) {
  sortOrders.value = nextSortOrders;
  saveSortOrders(nextSortOrders);
}

function persistSettings(nextSettings: BookmarkSettings) {
  settings.value = nextSettings;
  saveSettings(nextSettings);
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
  const existsInUser = userCategories.value.some((category) =>
    category.items.some((bookmark) => bookmark.id === id),
  );

  if (existsInUser) {
    persistUserCategories(removeUserBookmark(userCategories.value, id));
    return;
  }

  persistSettings({
    ...settings.value,
    deletedBookmarkIds: Array.from(new Set([...settings.value.deletedBookmarkIds, id])),
  });
}

function handleDeleteCategory(categoryId: string) {
  const category = categories.value.find((item) => item.id === categoryId);
  if (!category) return;
  const confirmed = window.confirm(`删除「${category.name}」分类？其中的本地书签会移除，默认分类会在当前浏览器隐藏。`);
  if (!confirmed) return;

  if (userCategoryIds.value.has(categoryId)) {
    persistUserCategories(removeUserCategory(userCategories.value, categoryId));
  } else {
    persistSettings({
      ...settings.value,
      hiddenCategoryIds: Array.from(new Set([...settings.value.hiddenCategoryIds, categoryId])),
    });
  }

  const { [categoryId]: _removed, ...restSortOrders } = sortOrders.value;
  persistSortOrders(restSortOrders);
  if (activeCategoryId.value === categoryId) {
    activeCategoryId.value = categories.value[0]?.id ?? '';
  }
}

function handleAddCategory() {
  const name = window.prompt('请输入新分类名称');
  const trimmedName = name?.trim();
  if (!trimmedName) return;

  const id = `user-${Date.now()}`;
  persistUserCategories([
    ...userCategories.value,
    {
      id,
      name: trimmedName,
      description: '你手动新增的个人书签分类',
      items: [],
    },
  ]);
  activeCategoryId.value = id;
  requestAnimationFrame(() => scrollToCategory(id));
}

function handleRenameCategory(categoryId: string) {
  const category = categories.value.find((item) => item.id === categoryId);
  if (!category) return;

  const name = window.prompt('请输入新的分类名称', category.name);
  const trimmedName = name?.trim();
  if (!trimmedName || trimmedName === category.name) return;

  if (userCategoryIds.value.has(categoryId)) {
    persistUserCategories(renameUserCategory(userCategories.value, categoryId, trimmedName));
  } else {
    persistSettings({
      ...settings.value,
      categoryNameOverrides: {
        ...settings.value.categoryNameOverrides,
        [categoryId]: trimmedName,
      },
    });
  }
}

function handleDeleteTag(tag: string) {
  const confirmed = window.confirm(`从所有本地书签中删除「${tag}」标签？`);
  if (!confirmed) return;

  persistUserCategories(removeUserTag(userCategories.value, tag));
  selectedTags.value = selectedTags.value.filter((item) => item !== tag);
}

function handleDropBookmark(categoryId: string, targetBookmarkId: string) {
  const dragged = draggedBookmark.value;
  draggedBookmark.value = null;
  if (!dragged || dragged.categoryId !== categoryId || dragged.id === targetBookmarkId) return;

  const category = categories.value.find((item) => item.id === categoryId);
  if (!category) return;

  const ids = category.items.map((bookmark) => bookmark.id);
  const currentIndex = ids.indexOf(dragged.id);
  const targetIndex = ids.indexOf(targetBookmarkId);
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ids.length) return;

  const nextIds = [...ids];
  const [movedId] = nextIds.splice(currentIndex, 1);
  nextIds.splice(targetIndex, 0, movedId);
  persistSortOrders({
    ...sortOrders.value,
    [categoryId]: nextIds,
  });
}

function handleDragStart(categoryId: string, id: string) {
  draggedBookmark.value = { categoryId, id };
}

function handleToggleLayout() {
  editMode.value = !editMode.value;
  if (!editMode.value) {
    draggedBookmark.value = null;
  }
}

function toggleTag(tag: string) {
  selectedTags.value = selectedTags.value.includes(tag)
    ? selectedTags.value.filter((item) => item !== tag)
    : [...selectedTags.value, tag];
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

function openChromeImportDialog() {
  chromeImportInput.value?.click();
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

function handleChromeImportFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = parseChromeBookmarksHtml(String(reader.result || ''));
      const existingUrls = new Set(
        categories.value.flatMap((category) => category.items.map((bookmark) => bookmark.url)),
      );
      chromePreviewBookmarks.value = parsed.bookmarks;
      duplicateChromeUrls.value = new Set(
        parsed.bookmarks
          .filter((bookmark) => existingUrls.has(bookmark.url))
          .map((bookmark) => bookmark.url),
      );
      isImportPreviewOpen.value = true;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '导入失败，请检查 HTML 文件');
    } finally {
      input.value = '';
    }
  };
  reader.readAsText(file);
}

function handleConfirmChromeImport(bookmarks: ChromeImportBookmark[]) {
  persistUserCategories(addImportedBookmarks(userCategories.value, bookmarks));
  isImportPreviewOpen.value = false;
  chromePreviewBookmarks.value = [];
  duplicateChromeUrls.value = new Set();
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
  sortOrders.value = readSortOrders();
  settings.value = readSettings();
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
      :edit-mode="editMode"
      @add="isAddDialogOpen = true"
      @export="exportUserBookmarks"
      @import="openImportDialog"
      @import-chrome="openChromeImportDialog"
      @toggle-layout="handleToggleLayout"
    />
    <input
      ref="importInput"
      class="visually-hidden"
      type="file"
      accept="application/json,.json"
      @change="handleImport"
    />
    <input
      ref="chromeImportInput"
      class="visually-hidden"
      type="file"
      accept=".html,text/html"
      @change="handleChromeImportFile"
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

      <TagFilter
        :tags="allTags"
        :selected-tags="selectedTags"
        :deletable-tags="userTags"
        @toggle="toggleTag"
        @delete="handleDeleteTag"
        @clear="selectedTags = []"
      />

      <div class="layout">
        <aside class="sidebar">
          <CategoryNav
            :categories="filteredCategories"
            :active-category-id="activeCategoryId"
            @select="scrollToCategory"
            @add="handleAddCategory"
            @rename="handleRenameCategory"
            @delete="handleDeleteCategory"
          />
        </aside>

        <div class="content-flow">
          <template v-if="filteredCategories.length">
            <BookmarkSection
              v-for="category in filteredCategories"
              :key="category.id"
              :category="category"
              :edit-mode="editMode"
              :can-delete-category="true"
              @delete="handleDeleteBookmark"
              @delete-category="handleDeleteCategory"
              @drag-start="handleDragStart"
              @drop="handleDropBookmark"
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
    <BookmarkImportPreview
      :open="isImportPreviewOpen"
      :bookmarks="chromePreviewBookmarks"
      :duplicate-urls="duplicateChromeUrls"
      @close="isImportPreviewOpen = false"
      @import="handleConfirmChromeImport"
    />
  </div>
</template>
