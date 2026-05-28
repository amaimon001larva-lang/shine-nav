import type { BookmarkCategory, BookmarkItem, UserBookmarkInput } from '../types/bookmark';
import {
  clearLegacyUserBookmarks,
  readJson,
  readLegacyUserBookmarks,
  SORT_ORDERS_KEY,
  USER_BOOKMARKS_KEY,
  writeJson,
} from './storage';
import { createBookmarkId, createCategoryId, normalizeBookmark } from './bookmarkNormalize';
import { getFaviconUrl } from './favicon';
import { normalizeUrl } from './storage';

export { createCategoryId, normalizeUrl, getFaviconUrl };

export type SortOrders = Record<string, string[]>;

function cloneCategories(categories: BookmarkCategory[]) {
  return categories.map((category) => ({
    ...category,
    items: category.items.map((item) => ({ ...item })),
  }));
}

function withSortedItems(category: BookmarkCategory, sortOrders: SortOrders) {
  const explicitOrder = sortOrders[category.id];
  const items = [...category.items];

  if (!explicitOrder?.length) {
    return {
      ...category,
      items: items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    };
  }

  const orderIndex = new Map(explicitOrder.map((id, index) => [id, index]));
  return {
    ...category,
    items: items.sort((a, b) => {
      const left = orderIndex.get(a.id);
      const right = orderIndex.get(b.id);
      if (left !== undefined && right !== undefined) return left - right;
      if (left !== undefined) return -1;
      if (right !== undefined) return 1;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    }),
  };
}

function migrateLegacyCategories() {
  const legacyValue = readLegacyUserBookmarks();
  if (!legacyValue || localStorage.getItem(USER_BOOKMARKS_KEY)) return;

  try {
    const parsed = JSON.parse(legacyValue) as BookmarkCategory[];
    if (!Array.isArray(parsed)) return;
    const migrated = parsed.map((category) => ({
      ...category,
      items: category.items.map((item, index) =>
        normalizeBookmark(
          { ...item, source: undefined },
          category.name,
          item.source === 'chrome-import' ? 'chrome-import' : 'manual',
          index,
        ),
      ),
    }));
    writeJson(USER_BOOKMARKS_KEY, migrated);
    clearLegacyUserBookmarks();
  } catch {
    // Keep the legacy value untouched if it cannot be parsed.
  }
}

export function readUserCategories(): BookmarkCategory[] {
  migrateLegacyCategories();
  const categories = readJson<BookmarkCategory[]>(USER_BOOKMARKS_KEY, []);
  if (!Array.isArray(categories)) return [];

  return categories.map((category) => ({
    id: String(category.id),
    name: String(category.name),
    description: String(category.description || '你保存到本地浏览器的书签分类'),
    items: Array.isArray(category.items)
      ? category.items.map((item, index) =>
          normalizeBookmark(
            item,
            category.name,
            item.source === 'chrome-import' ? 'chrome-import' : 'manual',
            index,
          ),
        )
      : [],
  }));
}

export function saveUserCategories(categories: BookmarkCategory[]) {
  writeJson(USER_BOOKMARKS_KEY, categories);
}

export function readSortOrders(): SortOrders {
  return readJson<SortOrders>(SORT_ORDERS_KEY, {});
}

export function saveSortOrders(sortOrders: SortOrders) {
  writeJson(SORT_ORDERS_KEY, sortOrders);
}

export function buildUserBookmark(input: UserBookmarkInput): BookmarkItem {
  const url = normalizeUrl(input.url);
  const now = new Date().toISOString();

  return {
    id: createBookmarkId('manual', url, input.name),
    name: input.name.trim(),
    url,
    category: input.categoryName,
    description: input.description.trim(),
    icon: input.icon.trim() || getFaviconUrl(url),
    tags: input.tags,
    sortOrder: Number.MAX_SAFE_INTEGER,
    source: 'manual',
    createdAt: now,
  };
}

export function mergeCategories(
  defaultCategories: BookmarkCategory[],
  userCategories: BookmarkCategory[],
  sortOrders: SortOrders,
) {
  const merged: BookmarkCategory[] = cloneCategories(defaultCategories);

  userCategories.forEach((userCategory) => {
    const existing = merged.find((category) => category.id === userCategory.id);
    const userItems = userCategory.items.map((item, index) => ({
      ...item,
      sortOrder: item.sortOrder ?? index,
    }));

    if (existing) {
      existing.items = [...existing.items, ...userItems];
      return;
    }

    merged.push({
      id: userCategory.id,
      name: userCategory.name,
      description: userCategory.description || '你保存到本地浏览器的书签分类',
      items: userItems,
    });
  });

  return merged.map((category) => withSortedItems(category, sortOrders));
}

export function addUserBookmark(
  categories: BookmarkCategory[],
  categoryId: string,
  categoryName: string,
  bookmark: BookmarkItem,
) {
  const next = cloneCategories(categories);
  const existing = next.find((category) => category.id === categoryId);

  if (existing) {
    existing.items.push({ ...bookmark, sortOrder: existing.items.length });
  } else {
    next.push({
      id: categoryId,
      name: categoryName,
      description: '你保存到本地浏览器的书签分类',
      items: [{ ...bookmark, sortOrder: 0 }],
    });
  }

  return next;
}

export function addImportedBookmarks(
  categories: BookmarkCategory[],
  bookmarks: Array<BookmarkItem & { categoryId: string; categoryName: string }>,
) {
  let next = cloneCategories(categories);

  bookmarks.forEach((bookmark) => {
    next = addUserBookmark(next, bookmark.categoryId, bookmark.categoryName, bookmark);
  });

  return next;
}

export function removeUserBookmark(categories: BookmarkCategory[], bookmarkId: string) {
  return cloneCategories(categories)
    .map((category) => ({
      ...category,
      items: category.items.filter((bookmark) => bookmark.id !== bookmarkId),
    }))
    .filter((category) => category.items.length > 0);
}

export function parseImportedCategories(value: string): BookmarkCategory[] {
  const parsed = JSON.parse(value) as BookmarkCategory[];
  if (!Array.isArray(parsed)) {
    throw new Error('JSON 文件格式不正确');
  }

  return parsed.map((category) => {
    if (!category.id || !category.name || !Array.isArray(category.items)) {
      throw new Error('JSON 文件缺少分类字段');
    }

    return {
      id: String(category.id),
      name: String(category.name),
      description: String(category.description || '你保存到本地浏览器的书签分类'),
      items: category.items.map((item, index) =>
        normalizeBookmark(
          item,
          category.name,
          item.source === 'chrome-import' ? 'chrome-import' : 'manual',
          index,
        ),
      ),
    };
  });
}
