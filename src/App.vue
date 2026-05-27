<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import HeaderSearch from './components/HeaderSearch.vue';
import CategoryNav from './components/CategoryNav.vue';
import BookmarkSection from './components/BookmarkSection.vue';
import bookmarkData from './data/bookmarks.json';
import type { BookmarkCategory } from './types/bookmark';

const categories = bookmarkData as BookmarkCategory[];
const searchText = ref('');
const activeCategoryId = ref(categories[0]?.id ?? '');

const normalizedSearch = computed(() => searchText.value.trim().toLowerCase());

const filteredCategories = computed(() => {
  if (!normalizedSearch.value) {
    return categories;
  }

  return categories
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
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
  <div class="app-shell">
    <HeaderSearch v-model="searchText" />

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
          <span>本地 JSON 管理</span>
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
            />
          </template>
          <section v-else class="empty-state">
            <h2>没有找到相关站点</h2>
            <p>换一个关键词，或在 src/data/bookmarks.json 里新增你常用的网站。</p>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>
