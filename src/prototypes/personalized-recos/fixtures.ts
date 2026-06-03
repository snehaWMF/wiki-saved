export interface RecommendedArticle {
  title: string
  description: string
  thumbnailSrc?: string
  topic: string
  readTime: string
  href: string
}

export interface TopicFilter {
  label: string
  value: string
}

export const TOPIC_FILTERS: TopicFilter[] = [
  { label: 'All', value: 'all' },
  { label: 'Science', value: 'science' },
  { label: 'History', value: 'history' },
  { label: 'Geography', value: 'geography' },
  { label: 'Arts', value: 'arts' },
  { label: 'Technology', value: 'technology' },
]

export const RECOMMENDED_ARTICLES: RecommendedArticle[] = [
  {
    title: 'James Webb Space Telescope',
    description: 'Space telescope launched in 2021, designed to conduct infrared astronomy.',
    thumbnailSrc:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Webb_Mirrors_Aligned.jpg/240px-Webb_Mirrors_Aligned.jpg',
    topic: 'science',
    readTime: '12 min read',
    href: '#',
  },
  {
    title: 'Byzantine Empire',
    description:
      'Continuation of the Roman Empire in its eastern provinces during Late Antiquity and the Middle Ages.',
    thumbnailSrc:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Justinian_mosaik_ravenna.jpg/240px-Justinian_mosaik_ravenna.jpg',
    topic: 'history',
    readTime: '20 min read',
    href: '#',
  },
  {
    title: 'Great Barrier Reef',
    description:
      "World's largest coral reef system, located in the Coral Sea off the coast of Australia.",
    thumbnailSrc:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Great_Barrier_Reef_Marine_Park_Authority%2C_light_blue_fish_swimming_through_coral.jpg/240px-Great_Barrier_Reef_Marine_Park_Authority%2C_light_blue_fish_swimming_through_coral.jpg',
    topic: 'geography',
    readTime: '9 min read',
    href: '#',
  },
  {
    title: 'Impressionism',
    description:
      '19th-century art movement originating in France, characterized by small visible brushstrokes.',
    thumbnailSrc:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Claude_Monet%2C_Impression%2C_soleil_levant%2C_1872.jpg/240px-Claude_Monet%2C_Impression%2C_soleil_levant%2C_1872.jpg',
    topic: 'arts',
    readTime: '14 min read',
    href: '#',
  },
  {
    title: 'Large Language Model',
    description:
      'A type of artificial intelligence algorithm that applies neural network techniques to understand and generate text.',
    thumbnailSrc: undefined,
    topic: 'technology',
    readTime: '11 min read',
    href: '#',
  },
  {
    title: 'Plate tectonics',
    description:
      'Scientific theory describing the large-scale motion of the plates making up the Earth\'s lithosphere.',
    thumbnailSrc:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Plates_tect2_en.svg/240px-Plates_tect2_en.svg.png',
    topic: 'science',
    readTime: '16 min read',
    href: '#',
  },
  {
    title: 'Silk Road',
    description:
      'Ancient network of trade routes connecting the East and West, central to cultural interaction.',
    thumbnailSrc:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Silk_route.jpg/240px-Silk_route.jpg',
    topic: 'history',
    readTime: '18 min read',
    href: '#',
  },
  {
    title: 'Amazon rainforest',
    description:
      'Moist broadleaf tropical rainforest in the Amazon biome that covers most of the Amazon basin.',
    thumbnailSrc:
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Amazonie_de%CC%81forestation.jpg/240px-Amazonie_de%CC%81forestation.jpg',
    topic: 'geography',
    readTime: '10 min read',
    href: '#',
  },
]

export const USER_TOPICS_SUMMARY =
  'Based on your reading history in Science and History'
