import type { BookmarkCategory, BookmarkItem, BookmarkSource } from '../types/bookmark';
import { getFaviconUrl } from './favicon';
import { normalizeUrl } from './storage';

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function createCategoryId(name: string) {
  const id = slugify(name);
  return id ? `user-${id}` : `user-${Date.now()}`;
}

export function createBookmarkId(source: BookmarkSource, url: string, name = '') {
  const id = slugify(`${name}-${url}`);
  return `${source}-${id || Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function normalizeBookmark(
  item: Partial<BookmarkItem>,
  categoryName: string,
  source: BookmarkSource,
  index = 0,
): BookmarkItem {
  const url = normalizeUrl(String(item.url || ''));
  const now = new Date().toISOString();

  return {
    id: String(item.id || createBookmarkId(source, url, String(item.name || ''))),
    name: String(item.name || url || '未命名网站'),
    url,
    category: item.category || categoryName,
    description: String(item.description || ''),
    icon: String(item.icon || getFaviconUrl(url)),
    tags: Array.isArray(item.tags) ? item.tags.map(String).filter(Boolean) : [],
    sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : index,
    source,
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt,
    path: Array.isArray(item.path) ? item.path.map(String) : [],
  };
}

export function normalizeCategories(
  categories: BookmarkCategory[],
  source: BookmarkSource,
): BookmarkCategory[] {
  return categories.map((category) => ({
    id: String(category.id),
    name: String(category.name),
    description: String(category.description || ''),
    items: Array.isArray(category.items)
      ? category.items.map((item, index) => normalizeBookmark(item, category.name, source, index))
      : [],
  }));
}
