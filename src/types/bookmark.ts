export interface BookmarkItem {
  id: string;
  name: string;
  url: string;
  description: string;
  icon: string;
  tags: string[];
}

export interface BookmarkCategory {
  id: string;
  name: string;
  description: string;
  items: BookmarkItem[];
}
