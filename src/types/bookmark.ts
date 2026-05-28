export interface BookmarkItem {
  id: string;
  name: string;
  url: string;
  description: string;
  icon: string;
  tags: string[];
  source?: 'default' | 'user';
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
