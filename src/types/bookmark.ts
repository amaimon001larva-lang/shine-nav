export type BookmarkSource = 'default' | 'manual' | 'chrome-import';

export interface BookmarkItem {
  id: string;
  name: string;
  url: string;
  category?: string;
  description?: string;
  icon?: string;
  tags: string[];
  sortOrder?: number;
  source?: BookmarkSource;
  createdAt?: string;
  updatedAt?: string;
  path?: string[];
}

export interface BookmarkCategory {
  id: string;
  name: string;
  description: string;
  items: BookmarkItem[];
}

export interface UserBookmarkInput {
  name: string;
  url: string;
  categoryId: string;
  categoryName: string;
  description: string;
  tags: string[];
  icon: string;
}

export interface ChromeImportBookmark extends BookmarkItem {
  categoryId: string;
  categoryName: string;
  source: 'chrome-import';
}

export interface ChromeImportPreview {
  bookmarks: ChromeImportBookmark[];
  duplicateUrls: Set<string>;
  categoryCount: number;
}
