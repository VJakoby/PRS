# Indexing Improvement Roadmap

ENGRAM should improve online indexing by increasing signal quality and reducing unnecessary work, not just by pushing request rate higher.

## Priority Areas

1. Better page filtering and deduplication
2. Bounded concurrency per source
3. Content-hash incremental refresh
4. Smarter sitemap filtering

## 1. Better Page Filtering and Deduplication

Goal:
- index fewer low-value pages
- reduce duplicate content in the index
- improve retrieval quality by preferring actual documentation content

Candidate changes:
- skip tag, category, landing, or navigation-heavy pages
- filter out very short or boilerplate-dense pages
- normalize URLs before indexing to avoid duplicate variants
- deduplicate by URL normalization and content hash

Expected improvement:
- less noise in search results
- less wasted indexing time
- lower chance of generic pages outranking useful documentation

## 2. Bounded Concurrency Per Source

Goal:
- speed up indexing without hammering sites
- make request behavior more predictable per source

Candidate changes:
- allow a small configurable concurrency level per source
- keep jitter and delay, but apply them per host instead of one blunt global rate
- use lower concurrency for fragile sources and higher concurrency for stable docs sites

Expected improvement:
- faster indexing on well-behaved sources
- less risk of rate-limiting or bans
- better balance between speed and politeness

## 3. Content-Hash Incremental Refresh

Goal:
- avoid reprocessing online pages that have not really changed
- make repeated indexing runs cheaper

Candidate changes:
- store a content hash for each indexed online page
- compare current content hash to stored content hash before reprocessing
- reuse existing page data when content is unchanged

Expected improvement:
- faster refresh cycles
- less redundant parsing and extraction
- more efficient periodic indexing

## 4. Smarter Sitemap Filtering

Goal:
- improve coverage while avoiding irrelevant sitemap entries
- use sitemap data as the primary discovery mechanism where possible

Candidate changes:
- prefer sitemap URLs over HTML link discovery when available
- filter sitemap URLs before fetch based on path heuristics
- skip obvious low-value paths such as tags, changelogs, category pages, or archives
- keep support for sitemap indexes and child sitemaps

Expected improvement:
- better source coverage with less crawling
- fewer irrelevant pages indexed
- faster indexing for structured documentation sites

## Suggested Order

1. Better page filtering and deduplication
2. Smarter sitemap filtering
3. Bounded concurrency per source
4. Content-hash incremental refresh

## Success Criteria

Indexing is improving if:

- fewer irrelevant online pages are added to the index
- repeated runs spend less time on unchanged content
- indexing becomes faster without more HTTP failures
- search quality improves because generic online noise is reduced
