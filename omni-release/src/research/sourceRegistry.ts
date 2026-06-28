/**
 * omni-release · research engine · source registry
 *
 * The canonical, in-code catalog of AI-news sources organized by category.
 * `source-list.md` (repo root) is the human-readable mirror of this file — keep
 * them in sync. Add/disable sources here; the lane reads from this registry.
 */

import type { Source, SourceCategory } from './types.js';

/**
 * Built-in source catalog.
 *
 * Notes on access:
 * - rss/atom/json-* sources are fetched directly with no API key.
 * - Reddit JSON requires a descriptive User-Agent (set in fetchSources).
 * - Hacker News uses the public Algolia search API (`{query}` is substituted).
 * - `needsBrowser: true` sources are reported as skipped by the auto lane and
 *   handed to the browser publisher/collector lane (t5).
 */
export const SOURCE_REGISTRY: Source[] = [
  // ── lab-blog ────────────────────────────────────────────────────────────
  {
    id: 'openai-blog',
    name: 'OpenAI Blog',
    category: 'lab-blog',
    type: 'rss',
    url: 'https://openai.com/blog/rss.xml',
    weight: 1.6,
    enabled: true,
    tags: ['openai', 'frontier', 'product'],
    notes: 'OpenAI announcements + research posts.',
  },
  {
    id: 'anthropic-news',
    name: 'Anthropic News',
    category: 'lab-blog',
    type: 'rss',
    url: 'https://www.anthropic.com/rss.xml',
    weight: 1.6,
    enabled: true,
    tags: ['anthropic', 'claude', 'safety'],
    notes: 'Anthropic announcements; may require browser fallback if blocked.',
  },
  {
    id: 'google-deepmind-blog',
    name: 'Google DeepMind Blog',
    category: 'lab-blog',
    type: 'rss',
    url: 'https://deepmind.google/blog/rss.xml',
    weight: 1.4,
    enabled: true,
    tags: ['deepmind', 'google', 'research'],
  },
  {
    id: 'google-ai-blog',
    name: 'Google Research Blog',
    category: 'lab-blog',
    type: 'atom',
    url: 'https://research.google/blog/rss/',
    weight: 1.2,
    enabled: true,
    tags: ['google', 'research'],
  },
  {
    id: 'meta-ai-blog',
    name: 'Meta AI Blog',
    category: 'lab-blog',
    type: 'rss',
    url: 'https://ai.meta.com/blog/rss/',
    weight: 1.2,
    enabled: true,
    tags: ['meta', 'llama', 'open-weights'],
  },
  {
    id: 'mistral-news',
    name: 'Mistral AI News',
    category: 'lab-blog',
    type: 'rss',
    url: 'https://mistral.ai/news/feed.xml',
    weight: 1.1,
    enabled: true,
    tags: ['mistral', 'open-weights', 'europe'],
  },
  {
    id: 'huggingface-blog',
    name: 'Hugging Face Blog',
    category: 'lab-blog',
    type: 'rss',
    url: 'https://huggingface.co/blog/feed.xml',
    weight: 1.1,
    enabled: true,
    tags: ['huggingface', 'open-source', 'models'],
  },

  // ── research ────────────────────────────────────────────────────────────
  {
    id: 'arxiv-cs-ai',
    name: 'arXiv cs.AI (recent)',
    category: 'research',
    type: 'atom',
    url: 'http://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=25',
    weight: 1.0,
    enabled: true,
    tags: ['arxiv', 'papers', 'ai'],
    notes: 'arXiv API returns Atom; cs.AI category.',
  },
  {
    id: 'arxiv-cs-cl',
    name: 'arXiv cs.CL (NLP, recent)',
    category: 'research',
    type: 'atom',
    url: 'http://export.arxiv.org/api/query?search_query=cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=25',
    weight: 1.0,
    enabled: true,
    tags: ['arxiv', 'papers', 'nlp', 'llm'],
  },
  {
    id: 'arxiv-cs-lg',
    name: 'arXiv cs.LG (ML, recent)',
    category: 'research',
    type: 'atom',
    url: 'http://export.arxiv.org/api/query?search_query=cat:cs.LG&sortBy=submittedDate&sortOrder=descending&max_results=25',
    weight: 0.9,
    enabled: true,
    tags: ['arxiv', 'papers', 'machine-learning'],
  },
  {
    id: 'papers-with-code',
    name: 'Papers with Code (latest)',
    category: 'research',
    type: 'rss',
    url: 'https://paperswithcode.com/latest/rss',
    weight: 0.9,
    enabled: false,
    tags: ['papers', 'benchmarks', 'sota'],
    notes: 'Feed availability is intermittent; disabled by default.',
  },

  // ── aggregator ──────────────────────────────────────────────────────────
  {
    id: 'hn-ai',
    name: 'Hacker News · AI stories',
    category: 'aggregator',
    type: 'json-hn',
    url: 'https://hn.algolia.com/api/v1/search_by_date?tags=story&query={query}&hitsPerPage=30',
    weight: 1.3,
    enabled: true,
    tags: ['hackernews', 'community', 'discussion'],
    notes: '`{query}` is replaced with lane keywords (default "AI OR LLM").',
  },
  {
    id: 'reddit-machinelearning',
    name: 'r/MachineLearning (new)',
    category: 'aggregator',
    type: 'json-reddit',
    url: 'https://www.reddit.com/r/MachineLearning/new.json?limit=30',
    weight: 1.0,
    enabled: true,
    tags: ['reddit', 'research', 'community'],
  },
  {
    id: 'reddit-localllama',
    name: 'r/LocalLLaMA (new)',
    category: 'aggregator',
    type: 'json-reddit',
    url: 'https://www.reddit.com/r/LocalLLaMA/new.json?limit=30',
    weight: 1.1,
    enabled: true,
    tags: ['reddit', 'open-weights', 'local', 'community'],
  },
  {
    id: 'reddit-artificial',
    name: 'r/artificial (new)',
    category: 'aggregator',
    type: 'json-reddit',
    url: 'https://www.reddit.com/r/artificial/new.json?limit=30',
    weight: 0.8,
    enabled: false,
    tags: ['reddit', 'general', 'community'],
    notes: 'Noisier; disabled by default.',
  },

  // ── newsletter ──────────────────────────────────────────────────────────
  {
    id: 'the-batch',
    name: 'The Batch · DeepLearning.AI',
    category: 'newsletter',
    type: 'rss',
    url: 'https://www.deeplearning.ai/the-batch/rss/',
    weight: 1.2,
    enabled: true,
    tags: ['newsletter', 'andrew-ng', 'weekly'],
  },
  {
    id: 'import-ai',
    name: 'Import AI · Jack Clark',
    category: 'newsletter',
    type: 'rss',
    url: 'https://importai.substack.com/feed',
    weight: 1.1,
    enabled: true,
    tags: ['newsletter', 'policy', 'research'],
  },
  {
    id: 'bens-bites',
    name: "Ben's Bites",
    category: 'newsletter',
    type: 'rss',
    url: 'https://bensbites.beehiiv.com/rss',
    weight: 0.9,
    enabled: true,
    tags: ['newsletter', 'daily', 'product'],
  },

  // ── news ────────────────────────────────────────────────────────────────
  {
    id: 'venturebeat-ai',
    name: 'VentureBeat · AI',
    category: 'news',
    type: 'rss',
    url: 'https://venturebeat.com/category/ai/feed/',
    weight: 1.0,
    enabled: true,
    tags: ['press', 'enterprise', 'funding'],
  },
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch · AI',
    category: 'news',
    type: 'rss',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    weight: 1.0,
    enabled: true,
    tags: ['press', 'startups', 'funding'],
  },
  {
    id: 'theverge-ai',
    name: 'The Verge · AI',
    category: 'news',
    type: 'rss',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    weight: 0.9,
    enabled: true,
    tags: ['press', 'consumer'],
  },
  {
    id: 'arstechnica-ai',
    name: 'Ars Technica · AI',
    category: 'news',
    type: 'rss',
    url: 'https://arstechnica.com/ai/feed/',
    weight: 0.9,
    enabled: true,
    tags: ['press', 'deep-dive'],
  },

  // ── product ─────────────────────────────────────────────────────────────
  {
    id: 'github-trending-ai',
    name: 'GitHub Trending · AI (proxy)',
    category: 'product',
    type: 'rss',
    url: 'https://mshibanami.github.io/GitHubTrendingRSS/daily/all.xml',
    weight: 0.8,
    enabled: false,
    tags: ['github', 'repos', 'trending'],
    notes: 'Community RSS proxy for GitHub Trending; disabled until verified.',
  },
  {
    id: 'producthunt-ai',
    name: 'Product Hunt · AI',
    category: 'product',
    type: 'manual',
    url: 'https://www.producthunt.com/topics/artificial-intelligence',
    weight: 0.7,
    enabled: false,
    needsBrowser: true,
    tags: ['product-hunt', 'launches'],
    notes: 'No stable public feed; collect via browser lane (t5).',
  },

  // ── social ──────────────────────────────────────────────────────────────
  {
    id: 'x-ai-list',
    name: 'X · AI builders list',
    category: 'social',
    type: 'manual',
    url: 'https://x.com/i/lists',
    weight: 0.6,
    enabled: false,
    needsBrowser: true,
    tags: ['x', 'twitter', 'realtime'],
    notes: 'Requires authenticated browser session; handled by t5 browser lane.',
  },
];

export interface SourceQuery {
  categories?: SourceCategory[];
  sourceIds?: string[];
  includeDisabled?: boolean;
  includeBrowserSources?: boolean;
}

/** Return the source with the given id, or undefined. */
export function getSource(id: string, registry: Source[] = SOURCE_REGISTRY): Source | undefined {
  return registry.find((s) => s.id === id);
}

/** All distinct categories present in the registry, in declaration order. */
export function listCategories(registry: Source[] = SOURCE_REGISTRY): SourceCategory[] {
  const seen: SourceCategory[] = [];
  for (const s of registry) if (!seen.includes(s.category)) seen.push(s.category);
  return seen;
}

/**
 * Select sources matching a query. Filtering precedence:
 *  1. explicit `sourceIds` (exact set; still subject to browser/disabled gates
 *     unless those gates are explicitly opened)
 *  2. `categories`
 *  3. enabled + browser gates
 */
export function selectSources(
  query: SourceQuery = {},
  registry: Source[] = SOURCE_REGISTRY,
): Source[] {
  let out = registry.slice();

  if (query.sourceIds && query.sourceIds.length) {
    const want = new Set(query.sourceIds);
    out = out.filter((s) => want.has(s.id));
  }

  if (query.categories && query.categories.length) {
    const want = new Set(query.categories);
    out = out.filter((s) => want.has(s.category));
  }

  if (!query.includeDisabled) {
    // When an explicit id list is given, honor it even if disabled.
    if (!(query.sourceIds && query.sourceIds.length)) {
      out = out.filter((s) => s.enabled);
    }
  }

  if (!query.includeBrowserSources) {
    out = out.filter((s) => !s.needsBrowser);
  }

  return out;
}

/** Quick registry summary, useful for `omni research sources`. */
export function summarizeRegistry(registry: Source[] = SOURCE_REGISTRY) {
  const byCategory: Record<string, { total: number; enabled: number }> = {};
  for (const s of registry) {
    const c = (byCategory[s.category] ??= { total: 0, enabled: 0 });
    c.total += 1;
    if (s.enabled) c.enabled += 1;
  }
  return {
    total: registry.length,
    enabled: registry.filter((s) => s.enabled).length,
    categories: byCategory,
  };
}
