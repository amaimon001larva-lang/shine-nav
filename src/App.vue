<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import HeaderSearch from './components/HeaderSearch.vue';
import CategoryNav from './components/CategoryNav.vue';
import BookmarkSection from './components/BookmarkSection.vue';
import AddBookmarkDialog from './components/AddBookmarkDialog.vue';
import BookmarkImportPreview from './components/BookmarkImportPreview.vue';
import TagFilter from './components/TagFilter.vue';
import bookmarkData from './data/bookmarks.json';
import type { BookmarkCategory, BookmarkItem, ChromeImportBookmark, UserBookmarkInput } from './types/bookmark';
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
  moveUserBookmarkToCategory,
  renameUserCategory,
  saveSettings,
  saveSortOrders,
  saveUserCategories,
  updateUserBookmark,
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
  bookmarkCategoryOverrides: {},
  layoutMode: 'default',
});
const searchText = ref('');
const activeCategoryId = ref(defaultCategories[0]?.id ?? '');
const editMode = ref(false);
const draggedBookmark = ref<{ categoryId: string; id: string } | null>(null);
const isAddDialogOpen = ref(false);
const dialogMode = ref<'add' | 'edit'>('add');
const editingBookmark = ref<BookmarkItem | null>(null);
const importInput = ref<HTMLInputElement | null>(null);
const chromeImportInput = ref<HTMLInputElement | null>(null);
const isImportPreviewOpen = ref(false);
const chromePreviewBookmarks = ref<ChromeImportBookmark[]>([]);
const duplicateChromeUrls = ref<Set<string>>(new Set());
const selectedTags = ref<string[]>([]);
const featuredTags = [
  '灵感',
  '文档',
  'Vue',
  '地图',
  '视觉',
  '素材',
  '图片',
  '效率',
  '协作',
  '前端',
  '设计工具',
  '中文',
  '组件',
  'AI',
  'GIS',
  '3D',
  '笔记',
  '参考',
];

const normalizedSearch = computed(() => searchText.value.trim().toLowerCase());
const categories = computed(() => {
  return mergeCategories(
    defaultCategories,
    userCategories.value,
    sortOrders.value,
    settings.value.bookmarkCategoryOverrides,
  )
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
    .map(([tag]) => tag)
    .reduce((result, tag) => {
      if (!result.includes(tag)) result.push(tag);
      return result;
    }, [...featuredTags])
    .slice(0, 32);
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
  if (dialogMode.value === 'edit' && editingBookmark.value) {
    const nextCategories = updateUserBookmark(userCategories.value, editingBookmark.value.id, input);
    persistUserCategories(nextCategories);
    isAddDialogOpen.value = false;
    activeCategoryId.value = input.categoryId;
    editingBookmark.value = null;
    requestAnimationFrame(() => scrollToCategory(input.categoryId));
    return;
  }

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

function openAddDialog() {
  dialogMode.value = 'add';
  editingBookmark.value = null;
  isAddDialogOpen.value = true;
}

function handleEditBookmark(bookmark: BookmarkItem) {
  const existsInUser = userCategories.value.some((category) =>
    category.items.some((item) => item.id === bookmark.id),
  );

  if (!existsInUser) {
    window.alert('默认 JSON 中的书签暂不直接编辑。你可以先手动添加一条本地书签，再进行编辑。');
    return;
  }

  dialogMode.value = 'edit';
  editingBookmark.value = bookmark;
  isAddDialogOpen.value = true;
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

function writeDraggedBookmarkTarget(
  sourceCategoryId: string,
  targetCategoryId: string,
  targetBookmarkId?: string,
) {
  const dragged = draggedBookmark.value;
  draggedBookmark.value = null;
  if (!dragged || dragged.id === targetBookmarkId) return;

  const sourceCategory = categories.value.find((category) => category.id === sourceCategoryId);
  const targetCategory = categories.value.find((category) => category.id === targetCategoryId);
  const draggedItem = sourceCategory?.items.find((bookmark) => bookmark.id === dragged.id);
  if (!draggedItem || !targetCategory) return;

  const existsInUser = userCategories.value.some((category) =>
    category.items.some((bookmark) => bookmark.id === dragged.id),
  );
  if (existsInUser && sourceCategoryId !== targetCategoryId) {
    persistUserCategories(
      moveUserBookmarkToCategory(
        userCategories.value,
        dragged.id,
        targetCategoryId,
        targetCategory.name,
      ),
    );
  }

  if (!existsInUser && sourceCategoryId !== targetCategoryId) {
    persistSettings({
      ...settings.value,
      bookmarkCategoryOverrides: {
        ...settings.value.bookmarkCategoryOverrides,
        [dragged.id]: targetCategoryId,
      },
    });
  }

  const targetIds = targetCategory.items
    .map((bookmark) => bookmark.id)
    .filter((id) => id !== dragged.id);
  const insertIndex = targetBookmarkId ? targetIds.indexOf(targetBookmarkId) : targetIds.length;
  if (insertIndex >= 0) {
    targetIds.splice(insertIndex, 0, dragged.id);
  } else {
    targetIds.push(dragged.id);
  }

  const nextSortOrders = { ...sortOrders.value, [targetCategoryId]: targetIds };
  if (sourceCategoryId !== targetCategoryId) {
    const sourceCategory = categories.value.find((category) => category.id === sourceCategoryId);
    if (sourceCategory) {
      nextSortOrders[sourceCategoryId] = sourceCategory.items
        .map((bookmark) => bookmark.id)
        .filter((id) => id !== dragged.id);
    }
  }
  persistSortOrders(nextSortOrders);
}

function handleDropBookmark(categoryId: string, targetBookmarkId: string) {
  writeDraggedBookmarkTarget(draggedBookmark.value?.categoryId || categoryId, categoryId, targetBookmarkId);
}

function handleDropToCategoryEnd(categoryId: string) {
  if (!draggedBookmark.value) return;
  writeDraggedBookmarkTarget(draggedBookmark.value.categoryId, categoryId);
}

function handleDragStart(categoryId: string, id: string) {
  draggedBookmark.value = { categoryId, id };
}

function handleToggleLayout() {
  editMode.value = !editMode.value;
  persistSettings({
    ...settings.value,
    layoutMode: editMode.value ? 'compact' : 'default',
  });
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
  editMode.value = settings.value.layoutMode === 'compact';
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
  <div class="app-shell" :class="{ 'is-edit-mode': editMode }">
    <HeaderSearch
      v-model="searchText"
      :user-bookmark-count="userBookmarkCount"
      :edit-mode="editMode"
      @add="openAddDialog"
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
      <div class="layout">
        <aside class="sidebar">
          <CategoryNav
            :categories="categories"
            :active-category-id="activeCategoryId"
            @select="scrollToCategory"
            @add="handleAddCategory"
            @rename="handleRenameCategory"
            @delete="handleDeleteCategory"
          />
        </aside>

        <div class="content-flow">
          <section class="hero-panel">
            <p class="eyebrow">Quiet Workspace</p>
            <h2>VeilIndex</h2>
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

          <template v-if="filteredCategories.length">
            <BookmarkSection
              v-for="category in filteredCategories"
              :key="category.id"
              :category="category"
              :edit-mode="editMode"
              :can-delete-category="true"
              @delete="handleDeleteBookmark"
              @edit="handleEditBookmark"
              @delete-category="handleDeleteCategory"
              @drag-start="handleDragStart"
              @drop="handleDropBookmark"
              @drop-to-end="handleDropToCategoryEnd"
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
      :mode="dialogMode"
      :categories="categories"
      :available-tags="allTags"
      :bookmark="editingBookmark"
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
