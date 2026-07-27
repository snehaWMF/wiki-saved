<script setup lang="ts">
import { ref, nextTick, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { CdxButton, CdxIcon, CdxTypeaheadSearch, CdxProgressBar, CdxTabs, CdxTab } from '@wikimedia/codex'
import type { SearchResult, SearchResultClickEvent } from '@wikimedia/codex'
import { cdxIconBookmarkOutline, cdxIconBookmark, cdxIconBookmarkList, cdxIconAdd, cdxIconClose, cdxIconArticles, cdxIconImage, cdxIconQuotes, cdxIconReload, cdxIconUserAvatar, cdxIconAppearance, cdxIconBell, cdxIconTray, cdxIconWatchlist } from '@wikimedia/codex-icons'

import ChromeWrapper from '@/components/ChromeWrapper.vue'
import ChromeHeader from '@/components/ChromeHeader.vue'
import PrototypeUserSettingsPopover from '@/components/PrototypeUserSettingsPopover.vue'
import SpecialPageWrapper from '@/components/SpecialPageWrapper.vue'
import { useConfig } from '@/composables/useConfig'

const { displayName, user } = useConfig()

onMounted(() => {
  if (user.value === 'logged-out') user.value = 'new'
})

definePage({
  meta: {
    title: 'Saved',
    description: 'Personalized reading list and topic discovery.',
  },
})

const router = useRouter()

// ── Article type ──
interface ArticleCard {
  title: string
  extract: string
  thumbnailSrc: string | null
  href: string
}

// ── Multi-topic state ──
const hasStarted = ref(false)
const topics = ref<string[]>([])
const activeTopic = ref<string>('')
const recosByTopic = ref<Record<string, ArticleCard[]>>({})
const loadingByTopic = ref<Record<string, boolean>>({})
const refreshOffsetByTopic = ref<Record<string, number>>({})


async function fetchRecommendations(searchTopic: string) {
  loadingByTopic.value = { ...loadingByTopic.value, [searchTopic]: true }
  try {
    const offset = refreshOffsetByTopic.value[searchTopic] ?? 0
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `morelike:${searchTopic}`,
      gsrlimit: '5',
      gsroffset: String(offset),
      prop: 'pageimages|extracts',
      exintro: '1',
      exsentences: '5',
      explaintext: '1',
      piprop: 'thumbnail',
      pithumbsize: '400',
      format: 'json',
      origin: '*',
    })
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`)
    const data = await res.json()
    const pages = Object.values(data.query?.pages ?? {}) as any[]
    pages.sort((a: any, b: any) => a.index - b.index)
    recosByTopic.value = {
      ...recosByTopic.value,
      [searchTopic]: pages.map((p: any) => ({
        title: p.title,
        extract: p.extract ?? '',
        thumbnailSrc: p.thumbnail?.source ?? null,
        href: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title)}`,
      })),
    }
  } finally {
    loadingByTopic.value = { ...loadingByTopic.value, [searchTopic]: false }
  }
}

// ── Initial search (screen 1) ──
const suggestions = ref<SearchResult[]>([])
const lastQuery = ref('')
let abortController: AbortController | null = null

async function fetchSuggestions(value: string) {
  const trimmed = (value ?? '').trim()
  lastQuery.value = trimmed
  if (!trimmed) { suggestions.value = []; return }
  abortController?.abort()
  abortController = new AbortController()
  try {
    const params = new URLSearchParams({
      action: 'opensearch', search: trimmed, limit: '8',
      namespace: '0', format: 'json', origin: '*',
    })
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { signal: abortController.signal })
    const [, titles, descriptions] = (await res.json()) as [string, string[], string[], string[]]
    if (lastQuery.value !== trimmed) return
    suggestions.value = titles.map((title, i) => ({
      value: title, label: title,
      description: descriptions[i] || undefined,
    }))
  } catch (err) {
    if ((err as Error).name !== 'AbortError') suggestions.value = []
  }
}

async function addFirstTopic(title: string) {
  if (!title) return
  router.push({ query: { topic: title } })
  hasStarted.value = true
  topics.value = [title]
  activeTopic.value = title
  await fetchRecommendations(title)
  fetchImages(title)
  fetchQuoteContent(title)
}

function onSelect(event: SearchResultClickEvent) {
  const title = event.searchResult?.value as string
  if (title) addFirstTopic(title)
}

function onSubmit(payload: { value?: string }) {
  const title = (payload.value ?? lastQuery.value).trim()
  if (title) addFirstTopic(title)
}

// ── Random topic ──
const RANDOM_TOPICS = [
  'Quantum mechanics', 'Byzantine Empire', 'Amazon rainforest',
  'Jazz music', 'Plate tectonics', 'Impressionism', 'Silk Road', 'Black holes',
]

function pickRandom() {
  addFirstTopic(RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)])
}

// ── Add interest inline search ──
const showAddSearch = ref(false)
const addSearchRef = ref<{ $el: HTMLElement } | null>(null)

async function openAddSearch() {
  showAddSearch.value = true
  await nextTick()
  const input = addSearchRef.value?.$el?.querySelector('input')
  input?.focus()
}
const addSuggestions = ref<SearchResult[]>([])
const addLastQuery = ref('')
let addAbortController: AbortController | null = null

async function onAddInput(value: string) {
  const trimmed = (value ?? '').trim()
  addLastQuery.value = trimmed
  if (!trimmed) { addSuggestions.value = []; return }
  addAbortController?.abort()
  addAbortController = new AbortController()
  try {
    const params = new URLSearchParams({
      action: 'opensearch', search: trimmed, limit: '8',
      namespace: '0', format: 'json', origin: '*',
    })
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { signal: addAbortController.signal })
    const [, titles, descriptions] = (await res.json()) as [string, string[], string[], string[]]
    if (addLastQuery.value !== trimmed) return
    addSuggestions.value = titles.map((title, i) => ({
      value: title, label: title,
      description: descriptions[i] || undefined,
    }))
  } catch (err) {
    if ((err as Error).name !== 'AbortError') addSuggestions.value = []
  }
}

function removeTopic(title: string) {
  topics.value = topics.value.filter((t) => t !== title)
  if (activeTopic.value === title) {
    activeTopic.value = topics.value[0] ?? ''
  }
  if (topics.value.length === 0) {
    openAddSearch()
  }
}

async function addTopic(title: string) {
  if (!title) return
  if (!topics.value.includes(title)) {
    topics.value = [...topics.value, title]
    await fetchRecommendations(title)
    fetchImages(title)
    fetchQuoteContent(title)
  }
  activeTopic.value = title
  showAddSearch.value = false
  addSuggestions.value = []
  addLastQuery.value = ''
}

function onAddSelect(event: SearchResultClickEvent) {
  const title = event.searchResult?.value as string
  if (title) addTopic(title)
}

function onAddSubmit(payload: { value?: string }) {
  addTopic((payload.value ?? addLastQuery.value).trim())
}

// ── Image mode ──
interface ImageCard {
  caption: string
  imageUrl: string
  href: string
}

type ViewMode = 'articles' | 'images' | 'quotes'
const viewMode = ref<ViewMode>('articles')
const imagesByTopic = ref<Record<string, ImageCard[]>>({})
const imagesLoadingByTopic = ref<Record<string, boolean>>({})

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

function parseImagePages(pages: any[], sourceTitle: string): ImageCard[] {
  const SKIP_EXT = /\.(svg|ogg|ogv|webm|mp3|wav)$/i
  const SKIP_NAME = /logo|icon|map|flag|commons|seal|coa|coat/i
  return pages
    .filter((p: any) => {
      const url: string = p.imageinfo?.[0]?.url ?? ''
      const name: string = p.title ?? ''
      return url && !SKIP_EXT.test(url) && !SKIP_NAME.test(name)
    })
    .map((p: any) => ({
      caption: (() => {
        const raw = stripHtml(
          p.imageinfo?.[0]?.extmetadata?.ImageDescription?.value ??
          p.imageinfo?.[0]?.extmetadata?.ObjectName?.value ?? ''
        )
        return /^https?:\/\/|^File:|^Image:/.test(raw) ? '' : raw
      })(),
      imageUrl: p.imageinfo?.[0]?.url,
      href: `https://en.wikipedia.org/wiki/${encodeURIComponent(sourceTitle)}`,
    }))
}

async function fetchArticleImages(articleTitle: string, limit = 20): Promise<ImageCard[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'images',
    titles: articleTitle,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiextmetadatafilter: 'ImageDescription|ObjectName',
    gimlimit: String(limit),
    format: 'json',
    origin: '*',
  })
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`)
  const data = await res.json()
  const pages = Object.values(data.query?.pages ?? {}) as any[]
  return parseImagePages(pages, articleTitle)
}

async function fetchImages(topic: string) {
  if (imagesByTopic.value[topic] !== undefined) return
  imagesLoadingByTopic.value = { ...imagesLoadingByTopic.value, [topic]: true }
  try {
    const offset = refreshOffsetByTopic.value[topic] ?? 0
    // Fetch from topic article + up to 2 related articles in parallel
    const related = (recosByTopic.value[topic] ?? []).slice(0, 2).map(a => a.title)
    const [topicImgs, ...relatedImgsArrays] = await Promise.all([
      fetchArticleImages(topic, 30),
      ...related.map(t => fetchArticleImages(t, 10)),
    ])

    // Rotate the topic images window based on offset
    const start = topicImgs.length > 0 ? offset % topicImgs.length : 0
    const rotated = [...topicImgs.slice(start), ...topicImgs.slice(0, start)]
    const topicPicked = rotated.slice(0, 3)
    const relatedPicked = relatedImgsArrays.map(imgs => imgs[0]).filter(Boolean) as ImageCard[]

    // Interleave: topic, related, topic, related, topic — deduplicate by imageUrl
    const seen = new Set<string>()
    const mixed: ImageCard[] = []
    const maxLen = Math.max(topicPicked.length, relatedPicked.length)
    for (let i = 0; i < maxLen && mixed.length < 5; i++) {
      if (topicPicked[i] && !seen.has(topicPicked[i].imageUrl)) {
        seen.add(topicPicked[i].imageUrl)
        mixed.push(topicPicked[i])
      }
      if (mixed.length < 5 && relatedPicked[i] && !seen.has(relatedPicked[i].imageUrl)) {
        seen.add(relatedPicked[i].imageUrl)
        mixed.push(relatedPicked[i])
      }
    }

    imagesByTopic.value = { ...imagesByTopic.value, [topic]: mixed }
  } finally {
    imagesLoadingByTopic.value = { ...imagesLoadingByTopic.value, [topic]: false }
  }
}

// ── Quotes / editorial mode ──
interface QuoteContent {
  title: string
  heroImage: string | null
  paragraphs: string[]
  pullQuotes: (string | null)[]
  href: string
  fetchedDay: number
}

const quotesByTopic = ref<Record<string, QuoteContent>>({})
const quotesLoadingByTopic = ref<Record<string, boolean>>({})

function extractPullQuote(paragraph: string): string | null {
  const sentences = paragraph.split(/(?<=[.!?])\s+/)
  const candidates = sentences.filter(s => s.length >= 60 && s.length <= 160)
  return candidates.sort((a, b) => b.length - a.length)[0] ?? null
}

async function fetchQuoteContent(topic: string) {
  const today = Math.floor(Date.now() / 86400000)
  const existing = quotesByTopic.value[topic]
  if (existing && existing.fetchedDay === today) return

  quotesLoadingByTopic.value = { ...quotesLoadingByTopic.value, [topic]: true }
  try {
    const related = recosByTopic.value[topic] ?? []
    if (!related.length) return
    const offset = refreshOffsetByTopic.value[topic] ?? 0
    const featured = related[(today + Math.floor(offset / 5)) % related.length]

    const params = new URLSearchParams({
      action: 'query',
      titles: featured.title,
      prop: 'extracts|pageimages',
      exintro: '1',
      explaintext: '1',
      piprop: 'thumbnail',
      pithumbsize: '1200',
      format: 'json',
      origin: '*',
    })
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`)
    const data = await res.json()
    const page: any = Object.values(data.query?.pages ?? {})[0]
    if (!page) return

    const paragraphs = (page.extract ?? '')
      .split('\n\n')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 80)

    const pullQuotes = paragraphs.map((p: string, i: number) =>
      i % 2 === 1 ? extractPullQuote(p) : null
    )

    quotesByTopic.value = {
      ...quotesByTopic.value,
      [topic]: {
        title: page.title,
        heroImage: page.thumbnail?.source ?? null,
        paragraphs,
        pullQuotes,
        href: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
        fetchedDay: today,
      },
    }
  } finally {
    quotesLoadingByTopic.value = { ...quotesLoadingByTopic.value, [topic]: false }
  }
}

const isRefreshing = ref(false)

async function refresh() {
  const topic = activeTopic.value
  if (!topic || isRefreshing.value) return
  isRefreshing.value = true

  // Increment offset so next fetch returns a different page/window
  refreshOffsetByTopic.value = {
    ...refreshOffsetByTopic.value,
    [topic]: (refreshOffsetByTopic.value[topic] ?? 0) + 5,
  }

  try {
    if (viewMode.value === 'articles') {
      const { [topic]: _, ...rest } = recosByTopic.value
      recosByTopic.value = rest
      await fetchRecommendations(topic)
    } else if (viewMode.value === 'images') {
      const { [topic]: _, ...rest } = imagesByTopic.value
      imagesByTopic.value = rest
      await fetchImages(topic)
    } else if (viewMode.value === 'quotes') {
      const { [topic]: _q, ...restQ } = quotesByTopic.value
      const { [topic]: _i, ...restI } = imagesByTopic.value
      quotesByTopic.value = restQ
      imagesByTopic.value = restI
      await fetchRecommendations(topic)
      await Promise.all([fetchImages(topic), fetchQuoteContent(topic)])
    }
  } finally {
    isRefreshing.value = false
  }
}

function setViewMode(mode: ViewMode) {
  viewMode.value = mode
  if (mode === 'images' && activeTopic.value) fetchImages(activeTopic.value)
  if (mode === 'quotes' && activeTopic.value) {
    fetchQuoteContent(activeTopic.value)
    fetchImages(activeTopic.value)
  }
}

// Cycle order: articles → quotes → images → articles
const VIEW_CYCLE: ViewMode[] = ['articles', 'quotes', 'images']

const nextViewMode = computed<ViewMode>(() => {
  const idx = VIEW_CYCLE.indexOf(viewMode.value)
  return VIEW_CYCLE[(idx + 1) % VIEW_CYCLE.length]
})

const nextViewIcon = computed(() => {
  if (nextViewMode.value === 'quotes') return cdxIconQuotes
  if (nextViewMode.value === 'images') return cdxIconImage
  return cdxIconArticles
})

const nextViewLabel = computed(() => {
  if (nextViewMode.value === 'quotes') return 'Switch to quotes view'
  if (nextViewMode.value === 'images') return 'Switch to image view'
  return 'Switch to article view'
})

function cycleViewMode() {
  setViewMode(nextViewMode.value)
}

// ── Saved pages & images ──
const savedArticles = ref<ArticleCard[]>([])
const savedImages = ref<ArticleCard[]>([])
const savedTab = ref<'pages' | 'images'>('pages')

function isSaved(key: string) {
  return (
    savedArticles.value.some((a) => a.title === key) ||
    savedImages.value.some((a) => a.thumbnailSrc === key)
  )
}

function toggleSave(article: ArticleCard, isImage = false) {
  if (isImage) {
    const already = savedImages.value.some((a) => a.thumbnailSrc === article.thumbnailSrc)
    if (already) {
      savedImages.value = savedImages.value.filter((a) => a.thumbnailSrc !== article.thumbnailSrc)
    } else {
      savedImages.value = [article, ...savedImages.value]
      savedTab.value = 'images'
    }
  } else {
    const already = savedArticles.value.some((a) => a.title === article.title)
    if (already) {
      savedArticles.value = savedArticles.value.filter((a) => a.title !== article.title)
    } else {
      savedArticles.value = [article, ...savedArticles.value]
      savedTab.value = 'pages'
    }
  }
}
</script>

<template>
  <ChromeWrapper :last-edited-notice="false">
    <template #header>
      <ChromeHeader :username="displayName">
        <template #nav>
          <CdxButton weight="quiet" aria-label="Appearance">
            <CdxIcon :icon="cdxIconAppearance" />
          </CdxButton>
          <CdxButton weight="quiet" aria-label="Notifications">
            <CdxIcon :icon="cdxIconBell" />
          </CdxButton>
          <CdxButton weight="quiet" aria-label="Notices">
            <CdxIcon :icon="cdxIconTray" />
          </CdxButton>
          <CdxButton weight="quiet" class="chrome-header__hide-narrow" aria-label="Watchlist">
            <CdxIcon :icon="cdxIconWatchlist" />
          </CdxButton>
          <CdxButton weight="quiet" :icon-only="true" aria-label="Saved">
            <CdxIcon :icon="cdxIconBookmarkList" />
          </CdxButton>
          <PrototypeUserSettingsPopover v-slot="{ toggle, open }">
            <CdxButton
              class="chrome-header__user-btn"
              weight="quiet"
              aria-label="Prototype user"
              :aria-expanded="open"
              @click="toggle"
            >
              <CdxIcon :icon="cdxIconUserAvatar" />
              <span class="chrome-header__dropdown-chevron" aria-hidden="true" />
            </CdxButton>
          </PrototypeUserSettingsPopover>
        </template>
      </ChromeHeader>
    </template>
    <SpecialPageWrapper title="Saved">

      <!-- ── RECOMMENDATIONS VIEW ── -->
      <template v-if="hasStarted">
        <div class="recos-view">

          <section class="recos-view__section">
            <h2 class="recos-view__section-heading">
              Saved interest &nbsp;–&nbsp; Daily recommendations
            </h2>

            <!-- Topic chips + edit -->
            <div class="recos-view__chips-row">
              <span
                v-for="t in topics"
                :key="t"
                class="recos-view__chip-wrap"
              >
                <button
                  :class="['recos-view__chip', t === activeTopic && 'recos-view__chip--active']"
                  @click="activeTopic = t; if (viewMode === 'images') fetchImages(t); if (viewMode === 'quotes') fetchQuoteContent(t)"
                >
                  {{ t }}
                </button>
                <button
                  v-if="showAddSearch"
                  class="recos-view__chip-remove"
                  :aria-label="`Remove ${t}`"
                  @click="removeTopic(t)"
                >
                  <CdxIcon :icon="cdxIconClose" />
                </button>
              </span>

              <!-- Search bar: always visible when no topics, toggleable otherwise -->
              <Transition name="slide">
                <div
                  v-if="showAddSearch || !topics.length"
                  :class="['recos-view__add-search-bar', !topics.length && 'recos-view__add-search-bar--wide']"
                >
                  <CdxTypeaheadSearch
                    id="add-topic-search"
                    ref="addSearchRef"
                    class="recos-view__add-search-input"
                    :placeholder="topics.length ? 'Add an interest…' : 'Search for a topic of interest…'"
                    :search-results="addSuggestions"
                    search-results-label="Wikipedia articles"
                    :show-thumbnail="false"
                    form-action="javascript:void(0)"
                    @input="onAddInput"
                    @search-result-click="onAddSelect"
                    @submit="onAddSubmit"
                  />
                  <p v-if="!topics.length" class="recos-view__add-search-hint">
                    e.g. Japan, Northern lights, Mayan languages, Internet culture
                  </p>
                  <CdxButton
                    v-if="topics.length"
                    weight="quiet"
                    :icon-only="true"
                    aria-label="Cancel"
                    @click="showAddSearch = false"
                  >
                    <CdxIcon :icon="cdxIconClose" />
                  </CdxButton>
                </div>
              </Transition>

              <button
                v-if="!showAddSearch && topics.length"
                class="recos-view__edit-link"
                @click="openAddSearch"
              >
                Edit interest
              </button>

              <!-- Mode toggle — shows next mode's icon, cycles articles → quotes → images -->
              <div class="recos-view__mode-buttons">
                <CdxButton weight="quiet" :icon-only="true" :aria-label="nextViewLabel" class="recos-view__mode-btn" @click="cycleViewMode">
                  <CdxIcon :icon="nextViewIcon" />
                </CdxButton>
                <!-- refresh button hidden for now
                <span class="recos-view__mode-divider" />
                <CdxButton weight="quiet" :icon-only="true" aria-label="Refresh" class="recos-view__mode-btn" :disabled="isRefreshing" @click="refresh">
                  <CdxIcon :icon="cdxIconReload" :class="isRefreshing && 'recos-view__refresh-spinning'" />
                </CdxButton>
                -->
              </div>
            </div>

            <!-- Cards for active topic -->
            <CdxProgressBar v-if="topics.length && (loadingByTopic[activeTopic] || imagesLoadingByTopic[activeTopic])" />

            <!-- Image mode: photo gallery -->
            <p v-if="viewMode === 'images' && topics.length && !imagesLoadingByTopic[activeTopic] && !(imagesByTopic[activeTopic] ?? []).length" class="recos-view__empty-mode">
              No images found for this topic.
            </p>
            <div v-if="viewMode === 'images' && topics.length && !imagesLoadingByTopic[activeTopic] && (imagesByTopic[activeTopic] ?? []).length" class="recos-view__gallery">
              <div
                v-for="img in imagesByTopic[activeTopic] ?? []"
                :key="img.imageUrl"
                class="gallery-card"
              >
                <!-- Image with save button -->
                <div class="gallery-card__img-wrap">
                  <img :src="img.imageUrl" :alt="img.caption" class="gallery-card__img" />
                  <button
                    :class="['recos-view__card-save', isSaved(img.imageUrl) && 'recos-view__card-save--saved']"
                    :aria-label="isSaved(img.imageUrl) ? 'Unsave' : 'Save'"
                    @click.prevent.stop="toggleSave({ title: img.caption || img.href, extract: '', thumbnailSrc: img.imageUrl, href: img.href }, true)"
                  >
                    <CdxIcon :icon="isSaved(img.imageUrl) ? cdxIconBookmark : cdxIconBookmarkOutline" />
                  </button>
                </div>
                <!-- Caption as blue link -->
                <p v-if="img.caption" class="gallery-card__caption">{{ img.caption }}</p>
              </div>
            </div>

            <!-- Article mode (default) -->
            <p v-if="viewMode === 'articles' && topics.length && !loadingByTopic[activeTopic] && !(recosByTopic[activeTopic] ?? []).length" class="recos-view__empty-mode">
              No articles found for this topic.
            </p>
            <div v-if="viewMode === 'articles' && topics.length && !loadingByTopic[activeTopic] && (recosByTopic[activeTopic] ?? []).length" class="recos-view__cards">
              <div
                v-for="article in recosByTopic[activeTopic] ?? []"
                :key="article.title"
                class="recos-view__card-wrapper"
              >
                <a
                  class="recos-view__card"
                  :href="article.href"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <!-- Image on top -->
                  <div v-if="article.thumbnailSrc" class="recos-view__card-image">
                    <img :src="article.thumbnailSrc" :alt="article.title" class="recos-view__card-img" />
                    <button
                      :class="['recos-view__card-save', isSaved(article.title) && 'recos-view__card-save--saved']"
                      :aria-label="isSaved(article.title) ? 'Unsave article' : 'Save article'"
                      @click.prevent.stop="toggleSave(article)"
                    >
                      <CdxIcon :icon="isSaved(article.title) ? cdxIconBookmark : cdxIconBookmarkOutline" />
                    </button>
                  </div>

                  <!-- Text below -->
                  <div :class="['recos-view__card-body', article.thumbnailSrc ? 'recos-view__card-body--clamped' : 'recos-view__card-body--fill']">
                    <button
                      v-if="!article.thumbnailSrc"
                      :class="['recos-view__card-save', 'recos-view__card-save--text', isSaved(article.title) && 'recos-view__card-save--saved']"
                      :aria-label="isSaved(article.title) ? 'Unsave article' : 'Save article'"
                      @click.prevent.stop="toggleSave(article)"
                    >
                      <CdxIcon :icon="isSaved(article.title) ? cdxIconBookmark : cdxIconBookmarkOutline" />
                    </button>
                    <p class="recos-view__card-title">{{ article.title }}</p>
                    <p class="recos-view__card-extract">{{ article.extract }}</p>
                  </div>
                </a>
              </div>
            </div>

            <!-- Quotes / editorial mode -->
            <CdxProgressBar v-if="viewMode === 'quotes' && (quotesLoadingByTopic[activeTopic] || imagesLoadingByTopic[activeTopic])" />

            <p v-if="viewMode === 'quotes' && !quotesLoadingByTopic[activeTopic] && !imagesLoadingByTopic[activeTopic] && !quotesByTopic[activeTopic]" class="recos-view__empty-mode">
              No content found for this topic.
            </p>
            <div v-if="viewMode === 'quotes' && !quotesLoadingByTopic[activeTopic] && !imagesLoadingByTopic[activeTopic] && quotesByTopic[activeTopic]" class="editorial">
              <p class="editorial__label">Today's read</p>
              <h2 class="editorial__headline">{{ quotesByTopic[activeTopic].title }}</h2>

              <div class="editorial__flow">
                <!-- Small floated image — text wraps around it -->
                <img
                  v-if="(imagesByTopic[activeTopic] ?? [])[0]"
                  :src="imagesByTopic[activeTopic][0].imageUrl"
                  :alt="imagesByTopic[activeTopic][0].caption"
                  class="editorial__float-img"
                />

                <template v-for="(para, i) in quotesByTopic[activeTopic].paragraphs.slice(0, 2)" :key="i">
                  <p class="editorial__body">{{ para }}</p>
                  <blockquote v-if="quotesByTopic[activeTopic].pullQuotes[i]" class="editorial__pullquote">
                    {{ quotesByTopic[activeTopic].pullQuotes[i] }}
                  </blockquote>
                </template>
              </div>

              <a
                :href="quotesByTopic[activeTopic].href"
                class="editorial__cta"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read full article →
              </a>
            </div>

          </section>

          <!-- Saved section — plain heading when no images saved, tabs when images exist -->
          <section class="recos-view__section">

            <!-- No saved images yet: plain heading + pages list -->
            <template v-if="!savedImages.length">
              <h2 class="recos-view__section-heading">Saved pages</h2>
              <template v-if="savedArticles.length">
                <div class="recos-view__saved-grid">
                  <a
                    v-for="article in savedArticles"
                    :key="article.title"
                    class="recos-view__saved-card"
                    :href="article.href"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div v-if="article.thumbnailSrc" class="recos-view__saved-thumb">
                      <img :src="article.thumbnailSrc" :alt="article.title" class="recos-view__saved-thumb-img" />
                    </div>
                    <div class="recos-view__saved-info">
                      <p class="recos-view__saved-title">{{ article.title }}</p>
                      <p class="recos-view__saved-extract">{{ article.extract }}</p>
                    </div>
                  </a>
                </div>
              </template>
              <p v-else class="recos-view__saved-empty">
                You have not saved any pages yet. Tap bookmark icon on articles to save for future reading.
              </p>
            </template>

            <!-- Saved images exist: show tabs -->
            <CdxTabs v-else v-model:active="savedTab">
              <CdxTab name="pages" label="Saved pages">
                <template v-if="savedArticles.length">
                  <div class="recos-view__saved-grid">
                    <a
                      v-for="article in savedArticles"
                      :key="article.title"
                      class="recos-view__saved-card"
                      :href="article.href"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div v-if="article.thumbnailSrc" class="recos-view__saved-thumb">
                        <img :src="article.thumbnailSrc" :alt="article.title" class="recos-view__saved-thumb-img" />
                      </div>
                      <div class="recos-view__saved-info">
                        <p class="recos-view__saved-title">{{ article.title }}</p>
                        <p class="recos-view__saved-extract">{{ article.extract }}</p>
                      </div>
                    </a>
                  </div>
                </template>
                <p v-else class="recos-view__saved-empty">
                  You have not saved any pages yet. Tap bookmark icon on articles to save for future reading.
                </p>
              </CdxTab>

              <CdxTab name="images" label="Saved images">
                <div class="recos-view__gallery recos-view__gallery--saved">
                  <div
                    v-for="img in savedImages"
                    :key="img.thumbnailSrc ?? img.title"
                    class="gallery-card"
                  >
                    <a :href="img.href" target="_blank" rel="noopener noreferrer" class="gallery-card__link">
                      <div class="gallery-card__img-wrap">
                        <img :src="img.thumbnailSrc ?? ''" :alt="img.title" class="gallery-card__img" />
                      </div>
                    </a>
                    <p v-if="img.title" class="gallery-card__caption">{{ img.title }}</p>
                  </div>
                </div>
              </CdxTab>
            </CdxTabs>

          </section>

        </div>
      </template>

      <!-- ── SEARCH / EMPTY VIEW ── -->
      <template v-else>
        <div class="saved-page">
          <div class="saved-page__empty-state">
            <CdxIcon :icon="cdxIconBookmarkOutline" class="saved-page__empty-icon" />
            <p class="saved-page__empty-text">Your saved items will appear here.</p>
          </div>
          <div class="saved-page__discovery">
            <h2 class="saved-page__discovery-heading">
              What topic are you interested in learning?
            </h2>
            <CdxTypeaheadSearch
              id="topic-search"
              class="saved-page__search"
              placeholder="Search the topic of your interest"
              :search-results="suggestions"
              search-results-label="Wikipedia articles"
              :show-thumbnail="false"
              form-action=""
              @input="fetchSuggestions"
              @search-result-click="onSelect"
              @submit="onSubmit"
            />
            <p class="saved-page__hint">
              for e.g. Japan, Northern lights, Mayan languages, Internet culture
            </p>
            <CdxButton action="progressive" weight="primary" style="margin-top: var(--spacing-100, 16px);" @click="pickRandom">
              Pick a random topic
            </CdxButton>
          </div>
        </div>
      </template>

    </SpecialPageWrapper>
  </ChromeWrapper>
</template>

<style scoped>
.saved-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: var(--spacing-300, 48px);
  padding-bottom: var(--spacing-300, 48px);
  gap: var(--spacing-200, 32px);
}

.saved-page__empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-100, 16px);
}

.saved-page__empty-icon {
  width: 32px;
  height: 32px;
  opacity: 0.35;
  color: var(--color-subtle);
}

.saved-page__empty-text {
  margin: 0;
  font-size: var(--font-size-medium);
  color: var(--color-subtle);
}

.saved-page__discovery {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-100, 16px);
  width: 100%;
  max-width: 560px;
  text-align: center;
}

.saved-page__discovery-heading {
  margin: 0;
  font-size: var(--font-size-large);
  font-weight: var(--font-weight-bold);
  color: var(--color-base);
  border: none;
}

.saved-page__search {
  width: 100%;
}

.saved-page__hint {
  margin: 0;
  margin-top: calc(-1 * var(--spacing-75, 12px));
  font-size: var(--font-size-small);
  color: var(--color-subtle);
}

/* ── Recommendations view ── */
.recos-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-300, 48px);
  padding-bottom: var(--spacing-300, 48px);
}

.recos-view__section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-75, 12px);
}

.recos-view__section-heading {
  margin: 0;
  font-size: var(--font-size-large);
  font-weight: var(--font-weight-bold);
  color: var(--color-base);
  border: none;
}

.recos-view__cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  /* row height = 4:3 image height + clamped body height, derived from vw
     image height = (100vw - 4*32px) / 5 * 0.75 = 15vw - 19px */
  grid-auto-rows: calc(15vw - 19px + 1rem * 1.3 + 0.875rem * 1.4 * 4 + 0.25rem + 1.5rem);
  gap: var(--spacing-200, 32px);
}

@media (max-width: 1199px) {
  .recos-view__cards {
    grid-template-columns: repeat(4, 1fr);
    /* (100vw - 3*32px) / 4 * 0.75 = 18.75vw - 18px */
    grid-auto-rows: calc(18.75vw - 18px + 1rem * 1.3 + 0.875rem * 1.4 * 4 + 0.25rem + 1.5rem);
  }
}

@media (max-width: 839px) {
  .recos-view__cards {
    grid-template-columns: repeat(3, 1fr);
    /* (100vw - 2*32px) / 3 * 0.75 = 25vw - 16px */
    grid-auto-rows: calc(25vw - 16px + 1rem * 1.3 + 0.875rem * 1.4 * 4 + 0.25rem + 1.5rem);
  }
}

@media (max-width: 599px) {
  .recos-view__cards {
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    gap: var(--spacing-100, 16px);
    /* clip so the peeking next card doesn't scroll the page */
    padding-inline-start: var(--spacing-150, 24px);
    padding-inline-end: var(--spacing-150, 24px);
    /* cancel the fixed row height set above */
    grid-auto-rows: unset;
  }

  .recos-view__cards::-webkit-scrollbar {
    display: none;
  }

  .recos-view__card-wrapper {
    flex: 0 0 78vw;
    scroll-snap-align: start;
    min-height: 0;
  }

  .recos-view__card-image {
    height: 32vw;
  }

  .recos-view__card-img {
    height: 100%;
  }

  .recos-view__card-body {
    padding: var(--spacing-50, 8px);
    gap: var(--spacing-25, 4px);
  }

  .recos-view__card-title {
    font-size: var(--font-size-small, 0.875rem);
    padding-right: var(--spacing-150, 24px);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .recos-view__card-extract {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 0.75rem;
  }
}

.recos-view__card-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-50, 8px);
  /* min-height: 0 means this wrapper doesn't contribute intrinsic height to the
     grid row — only image cards drive the row height; text-only cards stretch to match */
  min-height: 0;
  overflow: hidden;
}

.recos-view__card {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  text-decoration: none;
  color: inherit;
  border: 1px solid var(--border-color-subtle, #eaecf0);
  border-radius: 4px;
  overflow: hidden;
}

.recos-view__card:hover .recos-view__card-title {
  text-decoration: underline;
}

.recos-view__card-image {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  flex-shrink: 0;
  border-radius: 4px;
}

.recos-view__card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  display: block;
}

.recos-view__card-save {
  position: absolute;
  top: var(--spacing-50, 8px);
  right: var(--spacing-50, 8px);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background-color: rgba(255, 255, 255, 0.88);
  border: 1px solid var(--border-color-subtle, #eaecf0);
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-base);
  padding: 0;
  backdrop-filter: blur(2px);
}

.recos-view__card-save :deep(svg) {
  width: 12px;
  height: 12px;
}

.recos-view__card-save:hover {
  background-color: #fff;
  color: var(--color-progressive, #3366cc);
}

.recos-view__card-save--saved {
  background-color: #fff;
  color: var(--color-progressive, #3366cc);
  border-color: var(--color-progressive, #3366cc);
}

/* Shared card body base */
.recos-view__card-body {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-25, 4px);
  padding: var(--spacing-75, 12px);
  overflow: hidden;
}

/*
 * Article card body: 1 title line + 3 extract lines visible (4 lines total height).
 * Gradient starts at line 4 (75%) and fades smoothly to transparent.
 * DO NOT reduce line count or change gradient start point — intentional design decision.
 */
.recos-view__card-body--clamped {
  /* title (1rem/1.3lh) + extract × 4 lines (0.875rem/1.4lh) + gap + padding */
  height: calc(
    1rem * 1.3 +
    0.875rem * 1.4 * 4 +
    var(--spacing-25, 0.25rem) +
    var(--spacing-75, 0.75rem) * 2
  );
  flex-shrink: 0;
  /* 3 lines fully visible, smooth fade starting at line 4 */
  -webkit-mask-image: linear-gradient(to bottom, black 75%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 75%, transparent 100%);
}

/* Text-only card: fills grid row height, larger text, fades after a few lines */
.recos-view__card-body--fill {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, black 40%, transparent 70%);
  mask-image: linear-gradient(to bottom, black 40%, transparent 70%);
}

.recos-view__card-body--fill .recos-view__card-title {
  font-size: var(--font-size-large);
  line-height: 1.25;
}

.recos-view__card-body--fill .recos-view__card-extract {
  font-size: var(--font-size-medium);
  line-height: 1.6;
}

.recos-view__card-save--text {
  position: absolute;
  top: var(--spacing-50, 8px);
  right: var(--spacing-50, 8px);
  background-color: var(--background-color-base, #fff);
  border-color: transparent;
}

.recos-view__card-title {
  margin: 0;
  font-size: var(--font-size-medium);
  font-weight: var(--font-weight-bold);
  color: var(--color-progressive, #3366cc);
  line-height: 1.3;
  padding-right: var(--spacing-200, 32px);
  flex-shrink: 0;
}

.recos-view__card-extract {
  margin: 0;
  font-size: var(--font-size-small);
  color: var(--color-subtle);
  line-height: 1.4;
  overflow: hidden;
}

/* Image card extract: overflow hidden, mask on parent handles the fade */
.recos-view__card-body--clamped .recos-view__card-extract {
  overflow: visible;
}

/* Text-only card extract: fill remaining space, fade at bottom */
.recos-view__card-body--fill .recos-view__card-extract {
  flex: 1;
  min-height: 0;
  -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
}

.recos-view__card-label {
  margin: 0;
  font-size: var(--font-size-x-small);
  color: var(--color-subtle);
  flex-shrink: 0;
}

.recos-view__card-topic-link {
  color: var(--color-progressive, #3366cc);
  text-decoration: none;
}

.recos-view__card-topic-link:hover {
  text-decoration: underline;
}

.recos-view__mode-buttons {
  display: flex;
  gap: var(--spacing-25, 4px);
  margin-left: auto;
  color: var(--color-subtle);
}

/* Gray out all mode buttons by default */
@keyframes cdx-spin { to { transform: rotate(360deg); } }
.recos-view__refresh-spinning { animation: cdx-spin 0.7s linear infinite; }

.recos-view__mode-divider {
  display: inline-block;
  width: 1px;
  height: 16px;
  background: var(--border-color-subtle, #eaecf0);
  align-self: center;
  margin: 0 var(--spacing-25, 4px);
}

.recos-view__mode-btn {
  color: #a2a9b1;
}

.recos-view__mode-btn--active {
  color: #54595d;
  background-color: var(--background-color-interactive, #f8f9fa);
  border-radius: var(--border-radius-base, 2px);
}

/* Topic chips row */
.recos-view__chips-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-75, 12px);
}

.recos-view__chip-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.recos-view__chip {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 var(--spacing-100, 16px);
  background: #f8f9fa;
  border: 1.5px solid #c8ccd1;
  border-radius: 999px;
  font-size: var(--font-size-small);
  color: #202122;
  cursor: pointer;
  white-space: nowrap;
  transition: background 100ms, border-color 100ms;
}

.recos-view__chip:hover {
  background: #eaecf0;
  border-color: #a2a9b1;
}

.recos-view__chip--active {
  background: #eaecf0;
  border-color: #72777d;
  color: #202122;
}

.recos-view__chip-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background: var(--background-color-base, #fff);
  border: 1px solid var(--border-color-subtle, #eaecf0);
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  color: var(--color-subtle);
  line-height: 1;
}

.recos-view__chip-remove:hover {
  color: var(--color-destructive, #d73333);
  border-color: var(--color-destructive, #d73333);
}

.recos-view__edit-link {
  background: none;
  border: none;
  padding: 0;
  font-size: var(--font-size-small);
  color: var(--color-progressive, #3366cc);
  cursor: pointer;
  text-decoration: none;
}

.recos-view__edit-link:hover {
  text-decoration: underline;
}

.recos-view__no-interests {
  margin: 0;
  font-size: var(--font-size-medium);
  color: var(--color-subtle);
}

.recos-view__empty-mode {
  margin: 0;
  padding: var(--spacing-150, 24px) 0;
  font-size: var(--font-size-medium);
  color: var(--color-subtle);
}

.recos-view__add-search-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-75, 12px);
  width: 320px;
}

.recos-view__add-search-bar--wide {
  width: 480px;
  flex-direction: column;
  align-items: stretch;
}

.recos-view__add-search-input {
  flex: 1;
}

.recos-view__add-search-hint {
  margin: 0;
  font-size: var(--font-size-small);
  color: var(--color-subtle);
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* CdxTabs overrides */
:deep(.cdx-tabs__header) {
  border-bottom: none;
  width: fit-content;
  border-bottom: 1px solid var(--border-color-base, #a2a9b1);
}

:deep(.cdx-tabs__content) {
  padding-top: var(--spacing-150, 24px);
}

.recos-view__gallery--saved {
  grid-template-columns: repeat(6, 1fr);
  gap: var(--spacing-100, 16px);
}

@media (max-width: 1199px) {
  .recos-view__gallery--saved { grid-template-columns: repeat(5, 1fr); }
}

@media (max-width: 839px) {
  .recos-view__gallery--saved { grid-template-columns: repeat(3, 1fr); }
}

.recos-view__saved-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-100, 16px);
}

@media (max-width: 839px) {
  .recos-view__saved-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 599px) {
  .recos-view__saved-grid { grid-template-columns: 1fr; }
}

.recos-view__saved-card {
  display: flex;
  gap: var(--spacing-75, 12px);
  text-decoration: none;
  color: inherit;
  border: 1px solid var(--border-color-subtle, #eaecf0);
  border-radius: var(--border-radius-base, 2px);
  overflow: hidden;
}

.recos-view__saved-card:hover .recos-view__saved-title {
  text-decoration: underline;
  color: var(--color-progressive, #3366cc);
}

.recos-view__saved-thumb {
  width: 96px;
  flex-shrink: 0;
  background-color: var(--background-color-interactive, #f8f9fa);
  overflow: hidden;
  align-self: stretch;
}

.recos-view__saved-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.recos-view__saved-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-25, 4px);
  padding: var(--spacing-75, 12px);
}

.recos-view__saved-title {
  margin: 0;
  font-size: var(--font-size-medium);
  font-weight: var(--font-weight-bold);
  color: var(--color-base);
}

.recos-view__saved-extract {
  margin: 0;
  font-size: var(--font-size-small);
  color: var(--color-subtle);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recos-view__saved-empty {
  margin: 0;
  font-size: var(--font-size-small);
  color: var(--color-placeholder, #a2a9b1);
}

/* ── Photo gallery (image mode) ── */
.recos-view__gallery {
  columns: 5;
  column-gap: var(--spacing-150, 24px);
}

@media (max-width: 1199px) { .recos-view__gallery { columns: 4; } }
@media (max-width: 839px)  { .recos-view__gallery { columns: 3; } }
@media (max-width: 599px)  { .recos-view__gallery { columns: 2; } }

.gallery-card {
  display: flex;
  flex-direction: column;
  color: inherit;
  border: 1px solid #a2a9b1;
  background-color: #f8f9fa;
  padding: 4px;
  break-inside: avoid;
  margin-bottom: var(--spacing-150, 24px);
}

.gallery-card__link {
  display: block;
  text-decoration: none;
  color: inherit;
}

.gallery-card__img-wrap {
  width: 100%;
  overflow: hidden;
  border-radius: 0;
  background-color: #fff;
}

.gallery-card__img {
  width: 100%;
  height: auto;
  display: block;
}

.gallery-card__caption {
  margin: 6px 2px 2px;
  font-size: var(--font-size-small);
  font-style: normal;
  color: var(--color-base);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Editorial / quotes mode ── */
.editorial {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-50, 8px);
  max-width: 720px;
}

.editorial__flow {
  display: flow-root;
  max-height: calc(1rem * 1.8 * 8);
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
  mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
}

.editorial__float-img {
  float: left;
  width: 180px;
  height: 180px;
  object-fit: cover;
  border-radius: var(--border-radius-base, 2px);
  margin: 0 var(--spacing-150, 24px) var(--spacing-100, 16px) 0;
  shape-outside: margin-box;
}

.editorial__label {
  margin: 0;
  font-size: var(--font-size-x-small);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-subtle);
}

.editorial__headline {
  margin: 0 0 var(--spacing-100, 16px);
  font-size: var(--font-size-xxx-large, 2rem);
  font-weight: var(--font-weight-bold);
  line-height: 1.15;
  color: var(--color-base);
  border: none;
}

.editorial__body {
  margin: 0;
  font-size: var(--font-size-medium);
  line-height: 1.8;
  color: var(--color-base);
}

.editorial__pullquote {
  margin: 0;
  padding: var(--spacing-75, 12px) var(--spacing-100, 16px);
  border-left: 3px solid var(--border-color-base, #a2a9b1);
  font-size: var(--font-size-large);
  font-style: italic;
  line-height: 1.5;
  color: var(--color-base);
}

.editorial__cta {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-50, 8px);
  font-size: var(--font-size-medium);
  font-weight: var(--font-weight-bold);
  color: var(--color-progressive, #3366cc);
  text-decoration: none;
  margin-top: var(--spacing-50, 8px);
}

.editorial__cta:hover {
  text-decoration: underline;
}
</style>
