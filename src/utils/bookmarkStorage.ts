import type { BookmarkCategory, BookmarkItem, UserBookmarkInput } from '../types/bookmark';

const STORAGE_KEY = 'shine-nav:user-bookmarks';

function createId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function createCategoryId(name: string) {
  const id = createId(name);
  return id ? `user-${id}` : `user-${Date.now()}`;
}

export function normalizeUrl(url: string) {
  const value = url.trim();
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function getFaviconUrl(url: string) {
  try {
    const hostname = new URL(normalizeUrl(url)).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return '';
  }
}

export function readUserCategories(): BookmarkCategory[] {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue) as BookmarkCategory[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((category) => ({
      ...category,
      items: Array.isArray(category.items)
        ? category.items.map((item) => ({ ...item, source: 'user' }))
        : [],
    }));
  } catch {
    return [];
  }
}

export function saveUserCategories(categories: BookmarkCategory[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
}

export function buildUserBookmark(input: UserBookmarkInput): BookmarkItem {
  const url = normalizeUrl(input.url);
  const idSeed = `${input.name}-${url}-${Date.now()}`;

  return {
    id: `user-${createId(idSeed) || Date.now()}`,
    name: input.name.trim(),
    url,
    description: input.description.trim(),
    icon: input.icon.trim() || getFaviconUrl(url),
    tags: input.tags,
    source: 'user',
  };
}

export function mergeCategories(
  defaultCategories: BookmarkCategory[],
  userCategories: BookmarkCategory[],
) {
  const merged: BookmarkCategory[] = defaultCategories.map((category) => ({
    ...category,
    items: category.items.map((item) => ({ ...item, source: 'default' as const })),
  }));

  userCategories.forEach((userCategory) => {
    const existing = merged.find((category) => category.id === userCategory.id);
    const userItems = userCategory.items.map((item) => ({ ...item, source: 'user' as const }));

    if (existing) {
      existing.items = [...existing.items, ...userItems];
      return;
    }

    merged.push({
      id: userCategory.id,
      name: userCategory.name,
      description: userCategory.description || '你手动添加的个人书签分类',
      items: userItems,
    });
  });

  return merged;
}

export function addUserBookmark(
  categories: BookmarkCategory[],
  categoryId: string,
  categoryName: string,
  bookmark: BookmarkItem,
) {
  const next = categories.map((category) => ({
    ...category,
    items: [...category.items],
  }));
  const existing = next.find((category) => category.id === categoryId);

  if (existing) {
    existing.items.push(bookmark);
  } else {
    next.push({
      id: categoryId,
      name: categoryName,
      description: '你手动添加的个人书签分类',
      items: [bookmark],
    });
  }

  return next;
}

export function removeUserBookmark(categories: BookmarkCategory[], bookmarkId: string) {
  return categories
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
      description: String(category.description || '你手动添加的个人书签分类'),
      items: category.items.map((item) => ({
        id: String(item.id || `user-${Date.now()}`),
        name: String(item.name || ''),
        url: normalizeUrl(String(item.url || '')),
        description: String(item.description || ''),
        icon: String(item.icon || getFaviconUrl(String(item.url || ''))),
        tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
        source: 'user' as const,
      })),
    };
  });
}
