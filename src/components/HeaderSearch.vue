<script setup lang="ts">
const model = defineModel<string>({ required: true });
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

    <label class="search-box" aria-label="搜索书签">
      <span class="search-icon">⌕</span>
      <input
        v-model="model"
        type="search"
        placeholder="搜索网站名称、描述或标签"
        autocomplete="off"
      />
    </label>
  </header>
</template>
