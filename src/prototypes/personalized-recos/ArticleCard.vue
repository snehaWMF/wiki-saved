<script setup lang="ts">
import { CdxCard, CdxIcon, CdxButton } from '@wikimedia/codex'
import { cdxIconBookmark, cdxIconClose } from '@wikimedia/codex-icons'
import type { RecommendedArticle } from './fixtures'

defineProps<{
  article: RecommendedArticle
}>()

defineEmits<{
  dismiss: []
  save: []
}>()
</script>

<template>
  <CdxCard
    class="article-card"
    :url="article.href"
    :thumbnail="article.thumbnailSrc ? { url: article.thumbnailSrc } : undefined"
    :force-thumbnail="true"
  >
    <template #title>{{ article.title }}</template>
    <template #description>{{ article.description }}</template>
    <template #supporting-text>
      <span class="article-card__meta">
        <span class="article-card__topic cdx-label">{{ article.topic }}</span>
        <span class="article-card__read-time">{{ article.readTime }}</span>
      </span>
    </template>
  </CdxCard>
  <div class="article-card__actions">
    <CdxButton weight="quiet" :aria-label="`Save ${article.title}`" @click.prevent="$emit('save')">
      <CdxIcon :icon="cdxIconBookmark" />
      Save
    </CdxButton>
    <CdxButton weight="quiet" :aria-label="`Dismiss ${article.title}`" @click.prevent="$emit('dismiss')">
      <CdxIcon :icon="cdxIconClose" />
      Not interested
    </CdxButton>
  </div>
</template>

<style scoped>
.article-card {
  width: 100%;
}

.article-card__meta {
  display: flex;
  gap: var(--spacing-75, 12px);
  align-items: center;
  margin-top: var(--spacing-25, 4px);
  font-size: var(--font-size-small);
  color: var(--color-subtle);
}

.article-card__topic {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--spacing-50, 8px);
  background-color: var(--background-color-interactive);
  border-radius: var(--border-radius-pill, 9999px);
  font-size: var(--font-size-x-small);
  font-weight: var(--font-weight-bold);
  text-transform: capitalize;
  color: var(--color-base);
}

.article-card__actions {
  display: flex;
  gap: var(--spacing-50, 8px);
  margin-top: var(--spacing-50, 8px);
  padding: 0 var(--spacing-25, 4px);
}
</style>
