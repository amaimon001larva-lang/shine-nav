<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { BookmarkCategory, UserBookmarkInput } from '../types/bookmark';
import { createCategoryId, normalizeUrl } from '../utils/bookmarkStorage';
import { fetchWebsiteInfo, getFaviconUrl, getHostname } from '../utils/favicon';

const props = defineProps<{
  open: boolean;
  categories: BookmarkCategory[];
}>();

const emit = defineEmits<{
  close: [];
  submit: [bookmark: UserBookmarkInput];
}>();

const form = reactive({
  name: '',
  url: '',
  categoryMode: 'existing',
  categoryId: '',
  newCategoryName: '',
  description: '',
  tags: '',
  icon: '',
  fetchStatus: '',
  isFetching: false,
});

const categoryOptions = computed(() => props.categories);
const canSubmit = computed(() => {
  const hasCategory =
    form.categoryMode === 'new' ? form.newCategoryName.trim() : form.categoryId.trim();
  return form.name.trim() && form.url.trim() && hasCategory;
});

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    form.name = '';
    form.url = '';
    form.categoryMode = 'existing';
    form.categoryId = props.categories[0]?.id ?? '';
    form.newCategoryName = '';
    form.description = '';
    form.tags = '';
    form.icon = '';
    form.fetchStatus = '';
    form.isFetching = false;
  },
);

watch(
  () => form.url,
  (url) => {
    const hostname = getHostname(url);
    if (!hostname) return;
    if (!form.name.trim()) form.name = hostname.replace(/^www\./, '');
    if (!form.icon.trim()) form.icon = getFaviconUrl(url);
  },
);

function splitTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function handleSubmit() {
  if (!canSubmit.value) return;

  const selectedCategory = categoryOptions.value.find(
    (category) => category.id === form.categoryId,
  );
  const categoryName =
    form.categoryMode === 'new'
      ? form.newCategoryName.trim()
      : selectedCategory?.name || form.categoryId;
  const categoryId =
    form.categoryMode === 'new' ? createCategoryId(categoryName) : form.categoryId;

  emit('submit', {
    name: form.name,
    url: normalizeUrl(form.url),
    categoryId,
    categoryName,
    description: form.description,
    tags: splitTags(form.tags),
    icon: form.icon,
  });
}

async function handleFetchInfo() {
  if (!form.url.trim() || form.isFetching) return;

  form.isFetching = true;
  form.fetchStatus = '';

  const result = await fetchWebsiteInfo(form.url);
  if (!form.name.trim() && result.title) form.name = result.title;
  if (!form.description.trim() && result.description) form.description = result.description;
  if (!form.icon.trim() && result.icon) form.icon = result.icon;

  form.fetchStatus =
    result.status === 'success' ? '已自动填充可读取的信息' : '无法自动获取，可手动填写';
  form.isFetching = false;
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" @click.self="emit('close')">
      <form class="bookmark-dialog" @submit.prevent="handleSubmit">
        <div class="dialog-heading">
          <div>
            <h2>添加网站</h2>
            <p>保存到当前浏览器的本地书签，不会写入默认 JSON。</p>
          </div>
          <button class="icon-button" type="button" aria-label="关闭" @click="emit('close')">
            ×
          </button>
        </div>

        <div class="form-grid">
          <label class="field">
            <span>网站名称 *</span>
            <input v-model="form.name" type="text" placeholder="例如 Figma" required />
          </label>

          <label class="field">
            <span>网站地址 *</span>
            <div class="url-field">
              <input
                v-model="form.url"
                type="text"
                inputmode="url"
                placeholder="https://www.example.com"
                required
              />
              <button
                class="secondary-button"
                type="button"
                :disabled="!form.url.trim() || form.isFetching"
                @click="handleFetchInfo"
              >
                {{ form.isFetching ? '获取中' : '自动获取信息' }}
              </button>
            </div>
            <small v-if="form.fetchStatus" class="field-hint">{{ form.fetchStatus }}</small>
          </label>

          <div class="field field--full">
            <span>分类 *</span>
            <div class="segmented">
              <label>
                <input v-model="form.categoryMode" type="radio" value="existing" />
                现有分类
              </label>
              <label>
                <input v-model="form.categoryMode" type="radio" value="new" />
                新建分类
              </label>
            </div>
            <select v-if="form.categoryMode === 'existing'" v-model="form.categoryId">
              <option v-for="category in categoryOptions" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
            <input
              v-else
              v-model="form.newCategoryName"
              type="text"
              placeholder="例如 研究资料"
              required
            />
          </div>

          <label class="field field--full">
            <span>描述</span>
            <textarea v-model="form.description" rows="3" placeholder="一句话说明它适合做什么" />
          </label>

          <label class="field">
            <span>标签</span>
            <input v-model="form.tags" type="text" placeholder="设计, AI, 效率" />
          </label>

          <label class="field">
            <span>图标</span>
            <input v-model="form.icon" type="text" inputmode="url" placeholder="留空自动使用 favicon" />
          </label>
        </div>

        <div class="dialog-actions">
          <button class="secondary-button" type="button" @click="emit('close')">取消</button>
          <button class="primary-button" type="submit" :disabled="!canSubmit">保存网站</button>
        </div>
      </form>
    </div>
  </Teleport>
</template>
