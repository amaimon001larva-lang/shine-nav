import type { ChromeImportBookmark } from '../types/bookmark';
import { createBookmarkId, createCategoryId } from './bookmarkNormalize';
import { getFaviconUrl } from './favicon';
import { normalizeUrl } from './storage';

const DEFAULT_IMPORT_CATEGORY = 'Chrome 导入';

function findChildElement(element: Element, tagName: string) {
  return Array.from(element.children).find(
    (child) => child.tagName.toLowerCase() === tagName.toLowerCase(),
  );
}

function findNextDl(element: Element) {
  let sibling = element.nextElementSibling;
  while (sibling) {
    if (sibling.tagName.toLowerCase() === 'dl') return sibling;
    sibling = sibling.nextElementSibling;
  }
  return null;
}

function parseDate(value: string | null) {
  if (!value) return new Date().toISOString();
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return new Date().toISOString();
  return new Date(numeric * 1000).toISOString();
}

function isContainerFolder(name: string, depth: number) {
  if (depth !== 0) return false;
  return ['书签栏', 'Bookmarks Bar', '其他书签', 'Other Bookmarks', '移动设备书签', 'Mobile Bookmarks']
    .map((item) => item.toLowerCase())
    .includes(name.toLowerCase());
}

function parseDl(
  dl: Element,
  path: string[],
  results: ChromeImportBookmark[],
  fallbackCategory = DEFAULT_IMPORT_CATEGORY,
) {
  Array.from(dl.children).forEach((child) => {
    if (child.tagName.toLowerCase() !== 'dt') return;

    const anchor = findChildElement(child, 'a');
    if (anchor) {
      const url = normalizeUrl(anchor.getAttribute('href') || '');
      if (!url) return;

      const categoryName = path[0] || fallbackCategory;
      const nestedPath = path.slice(1);
      const icon = anchor.getAttribute('icon') || anchor.getAttribute('icon_uri') || getFaviconUrl(url);
      const name = anchor.textContent?.trim() || url;

      results.push({
        id: createBookmarkId('chrome-import', url, name),
        name,
        url,
        category: categoryName,
        categoryId: createCategoryId(categoryName),
        categoryName,
        description: '',
        icon,
        tags: nestedPath,
        source: 'chrome-import',
        createdAt: parseDate(anchor.getAttribute('add_date')),
        path: nestedPath,
        sortOrder: Number.MAX_SAFE_INTEGER,
      });
      return;
    }

    const heading = findChildElement(child, 'h3');
    if (!heading) return;

    const folderName = heading.textContent?.trim() || fallbackCategory;
    const nestedDl = findNextDl(heading);
    if (!nestedDl) return;

    const nextPath = isContainerFolder(folderName, path.length)
      ? path
      : [...path, folderName];
    parseDl(nestedDl, nextPath, results, fallbackCategory);
  });
}

export function parseChromeBookmarksHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rootDl = doc.querySelector('dl');
  if (!rootDl) {
    throw new Error('没有识别到 Chrome 书签结构');
  }

  const bookmarks: ChromeImportBookmark[] = [];
  parseDl(rootDl, [], bookmarks);

  const categories = new Set(bookmarks.map((bookmark) => bookmark.categoryName));
  return {
    bookmarks,
    categoryCount: categories.size,
  };
}
