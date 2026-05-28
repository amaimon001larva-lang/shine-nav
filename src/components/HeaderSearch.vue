<script setup lang="ts">
const model = defineModel<string>({ required: true });

defineProps<{
  userBookmarkCount: number;
}>();

const emit = defineEmits<{
  add: [];
  export: [];
  import: [];
  importChrome: [];
}>();
</script>

<template>
  <header class="site-header">
    <div class="brand">
      <div class="brand-mark">S</div>
      <div>
        <h1>Shine 导航</h1>
        <p>设计、AI 与开发资源的个人书签入口</p>
      </div>
    </div>

    <div class="header-actions">
      <label class="search-box" aria-label="搜索书签">
        <span class="search-icon">⌕</span>
        <input
          v-model="model"
          type="search"
          placeholder="搜索网站名称、描述或标签"
          autocomplete="off"
        />
      </label>

      <div class="toolbar-actions">
        <button class="secondary-button" type="button" @click="emit('importChrome')">
          导入 Chrome 书签
        </button>
        <button class="secondary-button" type="button" @click="emit('import')">导入 JSON</button>
        <button
          class="secondary-button"
          type="button"
          :disabled="userBookmarkCount === 0"
          @click="emit('export')"
        >
          导出 JSON
        </button>
        <button class="primary-button" type="button" @click="emit('add')">添加网站</button>
      </div>
    </div>
  </header>
</template>
