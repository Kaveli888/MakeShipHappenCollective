/**
 * omni-release · research engine · fetch + parse
 *
 * Fetches each source and normalizes its payload into ResearchItems. No third-
 * party parsing deps: RSS/Atom are parsed with a small tolerant extractor, and
 * JSON sources (Hacker News, Reddit) use the public APIs directly.
 *
 * Network errors never throw out of `fetchSource` — they resolve into a
 * `FetchOutcome` with `ok:false` so the lane can record health and continue.
 */

import type { ResearchItem, Source, SourceCategory } from './types.js';
import type { ResolvedContext } from './context.js';

const USER_AGENT =
  'omni-release-research/0.1 (+https://makeshiphappen.tech; contact: zzgemsjewelry@gmail.com)';

/** Result of attempting one source fetch. */
export interface FetchOutcome {
  source: Source;
  ok: boolean;
  items: ResearchItem[];
  latencyMs: number;
  skipped: boolean;
  skipReason?: string;
  error?: string;
}

export interface FetchOptions {
  timeoutMs: number;
  maxItemsPerSource: number;
  /** Keywords substituted into `{query}` placeholders (HN). */
  keywords?: string[];
}

/** Fetch a single source and normalize it. Never rejects. */
export async function fetchSource(
  source: Source,
  opts: FetchOptions,
  ctx: ResolvedContext,
): Promise<FetchOutcome> {
  const start = ctx.now();

  if (source.needsBrowser || source.type === 'manual' || source.type === 'html') {
    return {
      source,
      ok: false,
      items: [],
      latencyMs: 0,
      skipped: true,
      skipReason:
        source.type === 'html'
          ? 'html scraping not supported in auto lane'
          : 'browser-gated source — handled by the browser lane (t5)',
    };
  }

  try {
    const url = applyQueryPlaceholder(source.url, opts.keywords);
    const body = await fetchWithTimeout(url, opts.timeoutMs, ctx);
    const items = parseSource(source, body).slice(0, Math.max(0, opts.maxItemsPerSource));
    const latencyMs = ctx.now() - start;
    ctx.logger.debug(`fetched ${source.id}: ${items.length} items in ${latencyMs}ms`);
    return { source, ok: true, items, latencyMs, skipped: false };
  } catch (err) {
    const latencyMs = ctx.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    ctx.logger.warn(`fetch failed ${source.id}: ${message}`);
    return { source, ok: false, items: [], latencyMs, skipped: false, error: message };
  }
}

/** Fetch many sources with a bounded concurrency pool. */
export async function fetchSources(
  sources: Source[],
  opts: FetchOptions & { concurrency: number },
  ctx: ResolvedContext,
): Promise<FetchOutcome[]> {
  const results: FetchOutcome[] = new Array(sources.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      const source = sources[i];
      if (i >= sources.length || !source) return;
      results[i] = await fetchSource(source, opts, ctx);
    }
  };
  const lanes = Math.max(1, Math.min(opts.concurrency, sources.length));
  await Promise.all(Array.from({ length: lanes }, worker));
  return results;
}

// ── HTTP ───────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  ctx: ResolvedContext,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await ctx.fetchImpl(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/json, text/xml, */*',
      },
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.text();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function applyQueryPlaceholder(url: string, keywords?: string[]): string {
  if (!url.includes('{query}')) return url;
  const q = keywords && keywords.length ? keywords.join(' OR ') : 'AI OR LLM';
  return url.replace('{query}', encodeURIComponent(q));
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

function parseSource(source: Source, body: string): ResearchItem[] {
  switch (source.type) {
    case 'rss':
      return parseRss(source, body);
    case 'atom':
      return parseAtom(source, body);
    case 'json-hn':
      return parseHackerNews(source, body);
    case 'json-reddit':
      return parseReddit(source, body);
    case 'json-generic':
      return parseGenericJson(source, body);
    default:
      return [];
  }
}

// ── RSS / Atom ───────────────────────────────────────────────────────────────

function parseRss(source: Source, xml: string): ResearchItem[] {
  const items: ResearchItem[] = [];
  for (const block of extractBlocks(xml, 'item')) {
    const title = clean(tagText(block, 'title'));
    const link = clean(tagText(block, 'link')) || extractHref(block);
    const desc = clean(tagText(block, 'description') || tagText(block, 'content:encoded'));
    const pub = tagText(block, 'pubDate') || tagText(block, 'dc:date');
    const author = clean(tagText(block, 'dc:creator') || tagText(block, 'author'));
    if (!title && !link) continue;
    items.push(
      makeItem(source, {
        title,
        url: link,
        summary: desc,
        publishedAt: toIso(pub),
        author: author || null,
      }),
    );
  }
  return items;
}

function parseAtom(source: Source, xml: string): ResearchItem[] {
  const items: ResearchItem[] = [];
  for (const block of extractBlocks(xml, 'entry')) {
    const title = clean(tagText(block, 'title'));
    const link = extractHref(block) || clean(tagText(block, 'id'));
    const summary = clean(tagText(block, 'summary') || tagText(block, 'content'));
    const pub = tagText(block, 'published') || tagText(block, 'updated');
    const author = clean(tagText(block, 'name'));
    if (!title && !link) continue;
    items.push(
      makeItem(source, {
        title,
        url: link,
        summary,
        publishedAt: toIso(pub),
        author: author || null,
      }),
    );
  }
  return items;
}

/** Extract `<tag>...</tag>` blocks, tolerating attributes and namespaces. */
function extractBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1] ?? '');
  return out;
}

/** First inner text of `<tag ...>text</tag>` (CDATA-aware). */
function tagText(block: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = re.exec(block);
  if (!m) {
    // self-closing or attribute-only (e.g. <link href="..."/>) handled elsewhere
    return '';
  }
  return stripCdata(m[1] ?? '');
}

/** Atom `<link href="..."/>`; prefers rel="alternate" when present. */
function extractHref(block: string): string {
  const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => m[1] ?? '');
  const pick = (pred: (attrs: string) => boolean) => {
    const found = links.find(pred);
    if (!found) return '';
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(found);
    return href && href[1] ? clean(href[1]) : '';
  };
  return (
    pick((a) => /rel\s*=\s*["']alternate["']/i.test(a)) ||
    pick((a) => !/rel\s*=\s*["']/i.test(a)) ||
    pick(() => true)
  );
}

// ── Hacker News (Algolia) ────────────────────────────────────────────────────

function parseHackerNews(source: Source, body: string): ResearchItem[] {
  const data = safeJson(body);
  const hits: any[] = Array.isArray(data?.hits) ? data.hits : [];
  return hits
    .map((h) => {
      const title = clean(h.title || h.story_title || '');
      const url =
        clean(h.url || h.story_url || '') ||
        (h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : '');
      if (!title && !url) return null;
      const points = Number(h.points) || 0;
      const comments = Number(h.num_comments) || 0;
      return makeItem(
        source,
        {
          title,
          url,
          summary: clean(h.story_text || h.comment_text || ''),
          publishedAt: h.created_at ? toIso(h.created_at) : null,
          author: h.author ? String(h.author) : null,
        },
        // engagement signal feeds scoring downstream
        points + comments,
      );
    })
    .filter((x): x is ResearchItem => x !== null);
}

// ── Reddit listing ───────────────────────────────────────────────────────────

function parseReddit(source: Source, body: string): ResearchItem[] {
  const data = safeJson(body);
  const children: any[] = data?.data?.children ?? [];
  return children
    .map((c) => {
      const d = c?.data ?? {};
      const title = clean(d.title || '');
      const isSelf = Boolean(d.is_self);
      const url = isSelf
        ? `https://www.reddit.com${d.permalink || ''}`
        : clean(d.url || `https://www.reddit.com${d.permalink || ''}`);
      if (!title) return null;
      const score = Number(d.score) || 0;
      const comments = Number(d.num_comments) || 0;
      return makeItem(
        source,
        {
          title,
          url,
          summary: clean(truncate(d.selftext || '', 600)),
          publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
          author: d.author ? `u/${d.author}` : null,
        },
        score + comments,
      );
    })
    .filter((x): x is ResearchItem => x !== null);
}

// ── Generic JSON ─────────────────────────────────────────────────────────────

function parseGenericJson(source: Source, body: string): ResearchItem[] {
  const data = safeJson(body);
  const arr = source.itemsPath ? getPath(data, source.itemsPath) : data;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((row: any) => {
      const title = clean(row.title || row.name || row.headline || '');
      const url = clean(row.url || row.link || row.href || '');
      if (!title && !url) return null;
      return makeItem(source, {
        title,
        url,
        summary: clean(row.summary || row.description || row.excerpt || ''),
        publishedAt: toIso(row.publishedAt || row.published || row.date || ''),
        author: row.author ? String(row.author) : null,
      });
    })
    .filter((x): x is ResearchItem => x !== null);
}

// ── Item construction + utilities ────────────────────────────────────────────

interface RawItem {
  title: string;
  url: string;
  summary: string;
  publishedAt: string | null;
  author: string | null;
}

function makeItem(source: Source, raw: RawItem, engagement = 0): ResearchItem {
  const url = raw.url || '';
  const id = hashId(source.id, canonicalUrl(url) || raw.title);
  return {
    id,
    sourceId: source.id,
    sourceName: source.name,
    category: source.category as SourceCategory,
    title: truncate(raw.title, 280),
    url,
    summary: truncate(raw.summary, 600),
    publishedAt: raw.publishedAt,
    author: raw.author,
    tags: source.tags ? [...source.tags] : [],
    // The lane recomputes `score`; we stash the normalized source weight and
    // engagement in the breakdown so the scorer can use them without re-fetching.
    score: 0,
    scoreBreakdown: {
      recency: 0,
      sourceWeight: normalizeWeight(source.weight),
      keyword: 0,
      engagement,
    },
  };
}

/** Normalize a registry weight (~0.6..1.6) into 0..1 for blending. */
export function normalizeWeight(weight: number | undefined): number {
  const w = weight ?? 1;
  const n = (w - 0.5) / 1.2;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Stable, non-crypto 32-bit FNV-1a hash rendered as hex. */
export function hashId(...parts: string[]): string {
  const str = parts.join('::');
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Canonicalize a URL for dedupe: drop trailing slash, utm params, fragment. */
export function canonicalUrl(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.hash = '';
    const drop = [...u.searchParams.keys()].filter(
      (k) => /^utm_/i.test(k) || k === 'ref' || k === 'source',
    );
    for (const k of drop) u.searchParams.delete(k);
    let s = `${u.protocol}//${u.host}${u.pathname}`;
    const q = u.searchParams.toString();
    if (q) s += `?${q}`;
    return s.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

/** Strip tags, decode common entities, collapse whitespace. */
function clean(s: string): string {
  if (!s) return '';
  let out = stripCdata(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => safeFromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeFromCharCode(parseInt(h, 16)));
  return out.replace(/\s+/g, ' ').trim();
}

function safeFromCharCode(n: number): string {
  try {
    return Number.isFinite(n) ? String.fromCodePoint(n) : '';
  } catch {
    return '';
  }
}

function truncate(s: string, max: number): string {
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Parse a date string into ISO 8601, or null when unparseable. */
export function toIso(value: string): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

function safeJson(body: string): any {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function getPath(obj: any, dotPath: string): any {
  return dotPath.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}
