/**
 * ENGRAM
 * Copyright (C) 2026 VJakoby
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * ENGRAM is architected by VJakoby + 🤖. This program is distributed in 
 * the hope that it will be useful, but WITHOUT ANY WARRANTY; without even 
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');
const crypto = require('crypto');
const RATE = 1000; // Delay in ms between the requests (1000 = 1 req/sec), (500 = 2 req/sec

class ContentIndexer {
    constructor() {
        this.indexPath = path.join(__dirname, 'data', 'index.json');
        this.sourcesPath = path.join(__dirname, 'sources.json');
        this.synonymsPath = path.join(__dirname, 'synonyms.json');
        this.index = { pages: [], last_updated: null, sources: [] };
        this.synonyms = {};
    }

    async initialize() {
        const dataDir = path.join(__dirname, 'data');
        const cacheDir = path.join(__dirname, 'data', 'cache', 'online');
        try {
            await fs.mkdir(dataDir, { recursive: true });
            await fs.mkdir(cacheDir, { recursive: true });
        } catch (err) {
            // Directories exist
        }

        try {
            const indexData = await fs.readFile(this.indexPath, 'utf-8');
            this.index = JSON.parse(indexData);
            console.log(`✅ Loaded existing index with ${this.index.pages.length} pages`);
        } catch (err) {
            console.log('📝 No existing index found, creating new one');
        }

        // Load synonyms
        try {
            const synonymsData = await fs.readFile(this.synonymsPath, 'utf-8');
            this.synonyms = JSON.parse(synonymsData);
            console.log(`✅ Loaded ${Object.keys(this.synonyms).length} synonym groups`);
        } catch (err) {
            console.log('ℹ️  No synonyms.json found - query expansion disabled');
            this.synonyms = {};
        }
    }

    async loadSources() {
        const sourcesData = await fs.readFile(this.sourcesPath, 'utf-8');
        const config = JSON.parse(sourcesData);
        
        const onlineSources = (config.online_sources || config.sources || []).filter(s => s.enabled);
        const offlineSources = (config.offline_sources || []).filter(s => s.enabled);
        
        return {
            online: onlineSources,
            offline: offlineSources,
            all: [...onlineSources, ...offlineSources]
        };
    }

    resolvePath(configPath) {
        if (configPath.startsWith('./') || configPath.startsWith('../')) {
            return path.resolve(__dirname, configPath);
        }
        return configPath;
    }

    async findMarkdownFiles(directory, extensions = ['.md']) {
        const files = [];
        
        async function traverse(dir) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    
                    if (entry.isDirectory()) {
                        if (entry.name.endsWith('.md')) {
                            console.log(`  ⏭️  Skipping directory: ${entry.name}`);
                            continue;
                        }
                        await traverse(fullPath);
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        if (extensions.includes(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            } catch (error) {
                console.error(`  ❌ Error reading directory ${dir}:`, error.message);
            }
        }
        
        await traverse(directory);
        return files;
    }

    extractMarkdownTitle(content, filePath) {
        const lines = content.split('\n');
        for (const line of lines) {
            const match = line.match(/^#\s+(.+)/);
            if (match) {
                return match[1].trim();
            }
        }
        return path.basename(filePath, path.extname(filePath));
    }

    async indexLocalSource(source) {
        console.log(`
📁 Indexing ${source.name}...`);
        const pages = [];
        
        const resolvedPath = this.resolvePath(source.path);
        console.log(`  Path: ${resolvedPath}`);
        
        try {
            await fs.access(resolvedPath);
        } catch (error) {
            console.log(`  ⚠️  Directory does not exist: ${resolvedPath}`);
            console.log(`  💡 Create the directory or update path in sources.json`);
            return pages;
        }
        
        const extensions = source.file_extensions || ['.md'];
        const files = await this.findMarkdownFiles(resolvedPath, extensions);
        
        console.log(`  Found ${files.length} files`);
        
        if (files.length === 0) {
            console.log(`  ℹ️  No files to index`);
            return pages;
        }
        
        let newFiles = 0;
        let updatedFiles = 0;
        let unchangedFiles = 0;
        
        for (const filePath of files) {
            try {
                const stats = await fs.stat(filePath);
                const lastModified = stats.mtime.toISOString();
                
                const existingPage = this.index.pages.find(p => p.file_path === filePath);
                
                if (existingPage && existingPage.file_modified === lastModified) {
                    pages.push(existingPage);
                    unchangedFiles++;
                    continue;
                }
                
                const page = await this.indexSingleLocalFile(filePath, source, resolvedPath);
                if (page) {
                    page.file_modified = lastModified;
                    pages.push(page);
                    
                    if (existingPage) {
                        updatedFiles++;
                    } else {
                        newFiles++;
                    }
                }
            } catch (error) {
                console.error(`  ❌ Error processing ${filePath}:`, error.message);
            }
        }
        
        console.log(`  ✅ Indexed ${pages.length} files from ${source.name}`);
        if (newFiles > 0) console.log(`     🆕 ${newFiles} new files`);
        if (updatedFiles > 0) console.log(`     🔄 ${updatedFiles} updated files`);
        if (unchangedFiles > 0) console.log(`     ⏭️  ${unchangedFiles} unchanged files`);
        
        return pages;
    }

    async indexSingleLocalFile(filePath, source, resolvedPath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const title = this.extractMarkdownTitle(content, filePath);
            
            const relativePath = path.relative(resolvedPath, filePath);
            const pageName = relativePath.replace(/\\/g, '/').replace(/\.(md|txt)$/i, '');
            
            const fileUrl = `file://${filePath}`;
            
            return {
                source_id: source.id,
                source_name: source.name,
                url: fileUrl,
                file_path: filePath,
                title: title,
                page_name: pageName,
                content: content.toLowerCase(),
                indexed_at: new Date().toISOString(),
                is_local: true
            };
        } catch (error) {
            console.error(`  ❌ Error reading ${filePath}:`, error.message);
            return null;
        }
    }

    async updateLocalFile(filePath) {
        console.log(`\n🔄 Uppdaterar fil: ${filePath}`);
        
        const sources = await this.loadSources();
        let sourceMatch = null;
        let resolvedPath = null;
        
        for (const source of sources.offline) {
            const sourcePath = this.resolvePath(source.path);
            if (filePath.startsWith(sourcePath)) {
                sourceMatch = source;
                resolvedPath = sourcePath;
                break;
            }
        }
        
        if (!sourceMatch) {
            console.log('  ❌ Filen tillhör ingen känd källa');
            return false;
        }
        
        const newPage = await this.indexSingleLocalFile(filePath, sourceMatch, resolvedPath);
        
        if (!newPage) {
            console.log('  ❌ Kunde inte indexera filen');
            return false;
        }
        
        const existingIndex = this.index.pages.findIndex(p => p.file_path === filePath);
        
        if (existingIndex >= 0) {
            this.index.pages[existingIndex] = newPage;
            console.log('  ✅ Fil uppdaterad i index');
        } else {
            this.index.pages.push(newPage);
            console.log('  ✅ Ny fil tillagd i index');
        }
        
        this.index.last_updated = new Date().toISOString();
        this.index.total_pages = this.index.pages.length;
        
        const sourceInIndex = this.index.sources.find(s => s.id === sourceMatch.id);
        if (sourceInIndex) {
            sourceInIndex.page_count = this.index.pages.filter(p => p.source_id === sourceMatch.id).length;
        }
        
        await this.saveIndex();
        console.log('  💾 Index sparat\n');
        
        return true;
    }

    async removeLocalFile(filePath) {
        console.log(`\n🗑️  Tar bort fil from index: ${filePath}`);
        
        const existingIndex = this.index.pages.findIndex(p => p.file_path === filePath);
        
        if (existingIndex >= 0) {
            const removedPage = this.index.pages[existingIndex];
            this.index.pages.splice(existingIndex, 1);
            
            this.index.last_updated = new Date().toISOString();
            this.index.total_pages = this.index.pages.length;
            
            const sourceInIndex = this.index.sources.find(s => s.id === removedPage.source_id);
            if (sourceInIndex) {
                sourceInIndex.page_count = this.index.pages.filter(p => p.source_id === removedPage.source_id).length;
            }
            
            await this.saveIndex();
            console.log('  ✅ Fil borttagen from index');
            console.log('  💾 Index sparat\n');
            return true;
        } else {
            console.log('  ⚠️  Filen fanns inte i index');
            return false;
        }
    }

    async fetchPage(url, timeout = 15000) {
        try {
            const response = await axios.get(url, {
                timeout,
                headers: {
                    'User-Agent': 'ENGRAM',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
                maxRedirects: 5
            });
            return response.data;
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                console.error(`  ⏱️  Timeout: ${url}`);
            } else if (error.response) {
                console.error(`  ❌ HTTP ${error.response.status}: ${url}`);
            } else {
                console.error(`  ❌ ${error.message}: ${url}`);
            }
            return null;
        }
    }

    extractTextContent(html) {
        const $ = cheerio.load(html);
        $('script, style, nav, header, footer, .sidebar, .menu').remove();
        
        const textContent = $('body').text()
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        
        return textContent;
    }

    extractTitle(html, url) {
        const $ = cheerio.load(html);
        
        let title = $('h1').first().text().trim();
        
        if (!title) {
            title = $('title').text().trim();
        }
        
        if (!title) {
            const urlParts = url.split('/');
            title = urlParts[urlParts.length - 1].replace(/-/g, ' ');
        }
        
        title = title
            .replace(/\s*\|\s*.*/g, '')
            .replace(/\s*-\s*.*/g, '')
            .trim();
        
        return title || 'Untitled';
    }

    extractPageName(url) {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        const pageName = pathParts[pathParts.length - 1] || 'index';
        return pageName.replace(/-/g, ' ').replace(/_/g, ' ');
    }

    extractSnippet(content, searchTerm, length = 150) {
        const lowerContent = content.toLowerCase();
        const lowerTerm = searchTerm.toLowerCase();
        const index = lowerContent.indexOf(lowerTerm);
        
        if (index === -1) {
            return {
                text: '',
                highlightStart: -1,
                highlightLength: 0
            };
        }
        
        const start = Math.max(0, index - length / 2);
        const end = Math.min(content.length, index + searchTerm.length + length / 2);
        
        let snippet = content.substring(start, end);
        let highlightStart = snippet.toLowerCase().indexOf(lowerTerm);
        
        if (start > 0) {
            snippet = '...' + snippet;
            highlightStart += 3;
        }
        if (end < content.length) {
            snippet = snippet + '...';
        }
        
        return {
            text: snippet,
            highlightStart: highlightStart,
            highlightLength: searchTerm.length
        };
    }

    // ============ NEW: JITTER + SITEMAP METHODS ============

    // Adds a random delay between 80% and 120% of RATE
    async jitter() {
        const delay = RATE * (0.8 + Math.random() * 0.4);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Extract all <loc> URLs from a sitemap XML string
    parseSitemapUrls(xml, baseUrl) {
        const normalizedBase = baseUrl.replace(/\/$/, '');
        const urls = [];
        const matches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
        for (const match of matches) {
            const url = match[1].trim();
            const normalizedUrl = url.replace(/\/$/, '');
            if (normalizedUrl.startsWith(normalizedBase) && normalizedUrl !== normalizedBase) {
                urls.push(url);
            }
        }
        return urls;
    }

    // Try to fetch sitemap.xml - handles both regular sitemaps and sitemap index files
    async fetchSitemap(baseUrl) {
        const sitemapUrl = baseUrl.replace(/\/$/, '') + '/sitemap.xml';
        console.log(`  🗺️  Checking for sitemap: ${sitemapUrl}`);

        try {
            const xml = await this.fetchPage(sitemapUrl);
            if (!xml || !xml.includes('<loc>')) return null;

            // Check if this is a sitemap INDEX (contains <sitemap> tags pointing to other sitemaps)
            if (xml.includes('<sitemapindex') || xml.includes('<sitemap>')) {
                console.log(`  📑 Sitemap index detected - fetching child sitemaps...`);
                const childUrls = [];
                const sitemapMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
                for (const match of sitemapMatches) {
                    const childUrl = match[1].trim();
                    if (childUrl.endsWith('.xml')) {
                        childUrls.push(childUrl);
                    }
                }

                console.log(`  📑 Found ${childUrls.length} child sitemaps`);
                const allPageUrls = [];

                for (const childUrl of childUrls) {
                    const childXml = await this.fetchPage(childUrl);
                    if (childXml && childXml.includes('<loc>')) {
                        const pageUrls = this.parseSitemapUrls(childXml, baseUrl);
                        allPageUrls.push(...pageUrls);
                        console.log(`  📑 ${childUrl} → ${pageUrls.length} URLs`);
                    }
                    // No delay for XML sitemap files - they're lightweight metadata
                }

                if (allPageUrls.length > 0) {
                    console.log(`  ✅ Found ${allPageUrls.length} total URLs across all sitemaps`);
                    return allPageUrls;
                }
            }

            // Regular sitemap
            const urls = this.parseSitemapUrls(xml, baseUrl);
            if (urls.length > 0) {
                console.log(`  ✅ Found sitemap with ${urls.length} URLs`);
                return urls;
            }

        } catch (e) {
            console.log(`  ⚠️  Sitemap error: ${e.message}`);
        }

        console.log(`  ℹ️  No sitemap found - falling back to link crawling`);
        return null;
    }

    // ============ END NEW METHODS ============

    // GitBook renders via JavaScript (SPA). ?plain=true returns server-side rendered content.
    async fetchGitBookPage(url) {
        const plainUrl = url.includes('?') ? url + '&plain=true' : url + '?plain=true';
        return await this.fetchPage(plainUrl);
    }

    async indexGitBookSource(source) {
        console.log(`\n📚 Indexing ${source.name}...`);
        const pages = [];

        // Step 1: Use sitemap as a guide to discover all page URLs
        const sitemapUrls = await this.fetchSitemap(source.index_url);

        let linkArray;
        if (sitemapUrls) {
            console.log(`  🗺️  Sitemap found - will crawl each of the ${sitemapUrls.length} URLs for actual content`);
            linkArray = sitemapUrls;
        } else {
            // Fallback: discover links by crawling main page HTML
            console.log(`  Fetching main page: ${source.index_url}`);
            const html = await this.fetchPage(source.index_url);
            if (!html) {
                console.log(`  ❌ Could not fetch main page`);
                return pages;
            }

            const $ = cheerio.load(html);
            const links = new Set();

            $('a[href]').each((i, elem) => {
                let href = $(elem).attr('href');
                if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
                    try {
                        const fullUrl = new URL(href, source.index_url).href;
                        if (fullUrl.startsWith(source.index_url)) {
                            links.add(fullUrl);
                        }
                    } catch (e) { }
                }
            });

            console.log(`  Found ${links.size} internal links`);

            if (links.size === 0) {
                console.log(`  ⚠️  No links found - indexing main page only`);
                const content = this.extractTextContent(html);
                pages.push({
                    source_id: source.id,
                    source_name: source.name,
                    url: source.index_url,
                    title: this.extractTitle(html, source.index_url),
                    page_name: this.extractPageName(source.index_url),
                    content: content.substring(0, 10000),
                    indexed_at: new Date().toISOString(),
                    is_local: false
                });
                return pages;
            }

            linkArray = Array.from(links).slice(0, 50);
        }

        // Step 2: Crawl each URL to fetch and index the actual page content
        console.log(`  📄 Crawling ${linkArray.length} pages for content at ~${RATE}ms/req...`);

        let successful = 0;
        let skipped = 0;

        for (let i = 0; i < linkArray.length; i++) {
            const link = linkArray[i];

            // Use GitBook-aware fetcher to handle JS-rendered pages
            const pageHtml = await this.fetchGitBookPage(link);

            if (pageHtml) {
                const content = this.extractTextContent(pageHtml);

                // Skip pages with too little content (pure JS shell, no SSR)
                if (content.length < 100) {
                    skipped++;
                    console.log(`  [${i + 1}/${linkArray.length}] ⏭️  No content extracted`);
                    await this.jitter();
                    continue;
                }

                pages.push({
                    source_id: source.id,
                    source_name: source.name,
                    url: link,
                    title: this.extractTitle(pageHtml, link),
                    page_name: this.extractPageName(link),
                    content: content.substring(0, 10000),
                    indexed_at: new Date().toISOString(),
                    is_local: false
                });
                successful++;
            }

            console.log(`  [${i + 1}/${linkArray.length}] ✅ ${successful} indexed, ${skipped} empty...`);
            await this.jitter();
        }

        if (skipped > 0) {
            console.log(`  ⚠️  ${skipped} pages had no extractable content (JS-rendered only)`);
            console.log(`  💡 Tip: Use git clone method for complete GitBook coverage`);
        }

        console.log(`  ✅ Indexed total ${pages.length} pages from ${source.name}`);
        return pages;
    }

    async indexDocusaurusSource(source) {
        console.log(`\n📘 Indexing ${source.name}...`);
        const pages = [];

        if (!source.pages || source.pages.length === 0) {
            console.log('  ⚠️  Inga pages specificerade');
            return pages;
        }

        console.log(`  📄 Indexing ${source.pages.length} pages sequentially at ~${RATE}ms/req...`);

        let successful = 0;
        for (let i = 0; i < source.pages.length; i++) {
            const page = source.pages[i];
            const url = `${source.base_url}/${page}`;
            const html = await this.fetchPage(url);

            if (html) {
                const content = this.extractTextContent(html);
                const title = this.extractTitle(html, url);
                const pageName = page.replace(/-/g, ' ');

                pages.push({
                    source_id: source.id,
                    source_name: source.name,
                    url: url,
                    title: title,
                    page_name: pageName,
                    content: content.substring(0, 10000),
                    indexed_at: new Date().toISOString(),
                    is_local: false
                });
                successful++;
            }

            console.log(`  [${i + 1}/${source.pages.length}] ${successful} successful...`);
            await this.jitter();
        }

        console.log(`  ✅ Indexed ${pages.length} pages from ${source.name}`);
        return pages;
    }

    async indexMarkdownSource(source) {
        console.log(`\n📄 Indexing ${source.name}...`);
        const pages = [];

        if (!source.urls || source.urls.length === 0) {
            console.log('  ⚠️  Inga URLs specificerade');
            return pages;
        }

        console.log(`  Found ${source.urls.length} markdown-filer att indexera`);
        console.log(`  📄 Indexing sequentially at ~${RATE}ms/req...`);

        let successful = 0;
        for (let i = 0; i < source.urls.length; i++) {
            const url = source.urls[i];
            const markdownContent = await this.fetchPage(url);

            if (markdownContent) {
                const lines = markdownContent.split('\n');
                let title = null;
                for (const line of lines) {
                    const match = line.match(/^#\s+(.+)/);
                    if (match) {
                        title = match[1].trim();
                        break;
                    }
                }

                if (!title) {
                    const urlParts = url.split('/');
                    title = urlParts[urlParts.length - 1]
                        .replace(/\.md$/i, '')
                        .replace(/[-_]/g, ' ');
                }

                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split('/').filter(p => p);
                const pageName = pathParts[pathParts.length - 1]
                    .replace(/\.md$/i, '')
                    .replace(/[-_]/g, ' ');

                const content = markdownContent
                    .replace(/```[\s\S]*?```/g, ' ')
                    .replace(/`[^`]+`/g, ' ')
                    .replace(/[#*_\[\]()]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .toLowerCase();

                pages.push({
                    source_id: source.id,
                    source_name: source.name,
                    url: url,
                    title: title,
                    page_name: pageName,
                    content: content.substring(0, 10000),
                    indexed_at: new Date().toISOString(),
                    is_local: false
                });
                successful++;
            }

            console.log(`  [${i + 1}/${source.urls.length}] ${successful} successful...`);
            await this.jitter();
        }

        console.log(`  ✅ Indexed total ${pages.length} markdown-filer from ${source.name}`);
        return pages;
    }

    async buildIndex() {
        console.log('\n🚀 Starting indexing of all sources...\n');
        
        const sources = await this.loadSources();
        const allPages = [];

        console.log('🌐 ONLINE SOURCES:');
        for (const source of sources.online) {
            try {
                let pages = [];
                
                if (source.type === 'gitbook') {
                    pages = await this.indexGitBookSource(source);
                } else if (source.type === 'docusaurus') {
                    pages = await this.indexDocusaurusSource(source);
                } else if (source.type === 'markdown') {
                    pages = await this.indexMarkdownSource(source);
                } else {
                    console.log(`⚠️  Okänd källtyp: ${source.type} för ${source.name}`);
                }
                
                allPages.push(...pages);
            } catch (error) {
                console.error(`❌ Error indexing ${source.name}:`, error.message);
            }
        }

        if (sources.offline.length > 0) {
            console.log('\n📁 OFFLINE SOURCES:');
            for (const source of sources.offline) {
                try {
                    const pages = await this.indexLocalSource(source);
                    allPages.push(...pages);
                } catch (error) {
                    console.error(`❌ Error indexing ${source.name}:`, error.message);
                }
            }
        }

        this.index = {
            pages: allPages,
            last_updated: new Date().toISOString(),
            total_pages: allPages.length,
            sources: sources.all.map(s => ({
                id: s.id,
                name: s.name,
                type: s.type,
                description: s.description || '',
                page_count: allPages.filter(p => p.source_id === s.id).length,
                is_local: s.type === 'local'
            }))
        };

        this.index.pages.forEach(page => {
            if (page.is_local === undefined) {
                page.is_local = false;
            }
        });

        await this.saveIndex();
        
        console.log('\n✅ Indexing complete!');
        console.log(`📊 Total indexed pages: ${allPages.length}`);
        console.log(`   🌐 Online: ${allPages.filter(p => !p.is_local).length}`);
        console.log(`   📁 Offline: ${allPages.filter(p => p.is_local).length}`);
        console.log(`💾 Index saved to: ${this.indexPath}\n`);
    }

    async saveIndex() {
        // Backup before overwriting
        await fs.copyFile(this.indexPath, this.indexPath + '.backup').catch(() => {});

        const indexData = JSON.stringify(this.index, null, 2);
        const sizeKB = (indexData.length / 1024).toFixed(2);
        
        console.log(`💾 Saving index (${sizeKB} KB)...`);
        
        await fs.writeFile(
            this.indexPath,
            indexData,
            'utf-8'
        );
        
        const metadataPath = this.indexPath.replace('.json', '.meta.json');
        await fs.writeFile(
            metadataPath,
            JSON.stringify({
                size_bytes: indexData.length,
                size_kb: parseFloat(sizeKB),
                pages_count: this.index.pages.length,
                last_saved: new Date().toISOString()
            }, null, 2),
            'utf-8'
        );
    }

    // Expand query with synonyms for better search coverage
    expandQuery(query) {
        if (!this.synonyms || Object.keys(this.synonyms).length === 0) {
            return query; // No synonyms loaded
        }

        const terms = query.toLowerCase().split(/\s+/);
        const expanded = new Set();

        terms.forEach(term => {
            // Add original term
            expanded.add(term);

            // Find all synonym groups containing this term
            Object.entries(this.synonyms).forEach(([key, synonymArray]) => {
                // Check if term matches the key or is in the synonym array
                if (key === term || synonymArray.includes(term)) {
                    // Add all synonyms from this group
                    synonymArray.forEach(syn => expanded.add(syn));
                }
            });
        });

        return [...expanded].join(' ');
    }

    // SEARCH-ALGORITHM
    search(query, options = {}) {
        // Expand query with synonyms
        const expandedQuery = this.expandQuery(query);
        const searchTerm = expandedQuery.toLowerCase().trim();
        const results = [];
        const fuzzyMatch = options.fuzzy !== false;
        
        // Extract PRAGMA context if provided
        const context = options.context || null;
        const hasContext = context && context.active;

        for (const page of this.index.pages) {
            let score = 0;
            let matchType = null;
            let contextBoosted = false;
            
            const titleLower = page.title.toLowerCase();
            const pageNameLower = page.page_name.toLowerCase();
            const contentLower = page.content;
            const urlLower = page.url.toLowerCase();
            
            // 1. EXACT TITLE (highest weight)
            if (titleLower === searchTerm) {
                score += 100;
                matchType = 'exact_title';
            }
            // 2. TITLE CONTAINS SEARCHTERM
            else if (titleLower.includes(searchTerm)) {
                score += 50;
                matchType = 'title_contains';
            }
            
            // 3. PAGENAME-MATCH (from URL)
            if (pageNameLower.includes(searchTerm)) {
                score += 30;
                if (!matchType) matchType = 'page_name';
            }
            
            // 4. URL-MATCH (important for specific pages)
            if (urlLower.includes(searchTerm)) {
                score += 20;
                if (!matchType) matchType = 'url';
            }
            
            // 5. CONTENT-MATCH
            const occurrences = (contentLower.match(new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
            if (occurrences > 0) {
                score += occurrences * 2;
                if (!matchType) matchType = 'content';
            }
            
            // 6. FUZZY MATCH (for miss-spellings)
            if (fuzzyMatch && score === 0) {
                const fuzzyScore = this.fuzzySearch(searchTerm, titleLower) +
                                  this.fuzzySearch(searchTerm, pageNameLower);
                if (fuzzyScore > 0.7) {
                    score += Math.floor(fuzzyScore * 10);
                    matchType = 'fuzzy';
                }
            }
            
            // 7. BOOST FOR SHORTER TITLES (more relevant)
            if (score > 0 && titleLower.length < 50) {
                score += 5;
            }
            
            // 8. CONTEXT-AWARE BOOSTING (from PRAGMA session)
            if (score > 0 && hasContext) {
                const pageContent = (titleLower + ' ' + contentLower).toLowerCase();
                
                // Boost if page mentions active services
                if (context.services && context.services.length > 0) {
                    context.services.forEach(service => {
                        if (pageContent.includes(service.toLowerCase())) {
                            score += 15;
                            contextBoosted = true;
                        }
                    });
                }
                
                // Boost based on current phase
                if (context.phase) {
                    const phaseKeywords = {
                        'initial_recon': ['reconnaissance', 'enumeration', 'discovery', 'scanning'],
                        'enumeration': ['enum', 'list', 'users', 'shares', 'services'],
                        'exploitation': ['exploit', 'vulnerability', 'rce', 'shell', 'payload'],
                        'privilege_escalation': ['privesc', 'sudo', 'suid', 'root', 'admin', 'elevation'],
                        'lateral_movement': ['lateral', 'pivot', 'smb', 'pass the hash', 'kerberos']
                    };
                    
                    const keywords = phaseKeywords[context.phase] || [];
                    keywords.forEach(keyword => {
                        if (pageContent.includes(keyword)) {
                            score += 10;
                            contextBoosted = true;
                        }
                    });
                }
            }

            if (score > 0) {
                results.push({
                    ...page,
                    relevance_score: score,
                    match_type: matchType,
                    snippet: this.extractSnippet(page.content, searchTerm),
                    context_boosted: contextBoosted
                });
            }
        }

        results.sort((a, b) => b.relevance_score - a.relevance_score);
        
        return results;
    }

    fuzzySearch(pattern, text) {
        if (pattern.length === 0) return 0;
        if (text.includes(pattern)) return 1;
        
        let matches = 0;
        let patternIndex = 0;
        
        for (let i = 0; i < text.length && patternIndex < pattern.length; i++) {
            if (text[i] === pattern[patternIndex]) {
                matches++;
                patternIndex++;
            }
        }
        
        return matches / pattern.length;
    }

    // ============ OFFLINE CACHE METHODS ============
    
    hashUrl(url) {
        return crypto.createHash('md5').update(url).digest('hex');
    }

    removeImages(html) {
        const $ = cheerio.load(html);
        
        $('img').remove();
        $('picture').remove();
        $('svg').remove();
        $('video').remove();
        $('audio').remove();
        
        $('[data-src]').removeAttr('data-src');
        $('[srcset]').removeAttr('srcset');
        
        return $.html();
    }

    async getCacheSize(dir) {
        try {
            let totalSize = 0;
            const files = await fs.readdir(dir);
            for (const file of files) {
                if (file === 'metadata.json') continue;
                const stats = await fs.stat(path.join(dir, file));
                totalSize += stats.size;
            }
            return (totalSize / 1024 / 1024).toFixed(2);
        } catch (error) {
            return '0.00';
        }
    }

    async saveCacheMetadata(sourceId, metadata) {
        const cacheDir = path.join(__dirname, 'data', 'cache', 'online', sourceId);
        await fs.mkdir(cacheDir, { recursive: true });
        const metaPath = path.join(cacheDir, 'metadata.json');
        await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
    }

    async cacheSourcePages(source, pages) {
        const cacheDir = path.join(__dirname, 'data', 'cache', 'online', source.id);
        await fs.mkdir(cacheDir, { recursive: true });
        
        console.log(`  💾 Caching pages for offline use...`);
        
        let cached = 0;
        let failed = 0;
        
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            
            try {
                const html = await this.fetchPage(page.url);
                if (!html) {
                    failed++;
                    continue;
                }
                
                const cleanHtml = this.removeImages(html);
                
                const hash = this.hashUrl(page.url);
                const cachePath = path.join(cacheDir, `${hash}.html`);
                
                await fs.writeFile(cachePath, cleanHtml, 'utf-8');
                
                page.cache_path = cachePath;
                page.cache_hash = hash;
                page.cached_at = new Date().toISOString();
                page.is_cached = true;
                
                cached++;
                
                if ((i + 1) % 10 === 0 || i === pages.length - 1) {
                    console.log(`    Cached ${cached}/${pages.length} pages...`);
                }
                
                // Jitter delay to avoid hammering server
                await this.jitter();
                
            } catch (error) {
                console.error(`    ❌ Cache failed for: ${page.title}`);
                failed++;
            }
        }
        
        const sizeInMB = await this.getCacheSize(cacheDir);
        
        console.log(`    ✅ Cached ${cached}/${pages.length} pages (${failed} failed)`);
        console.log(`    💾 Total size: ${sizeInMB} MB`);
        
        await this.saveCacheMetadata(source.id, {
            source_name: source.name,
            source_id: source.id,
            total_pages: pages.length,
            cached_pages: cached,
            failed_pages: failed,
            cached_at: new Date().toISOString(),
            size_mb: parseFloat(sizeInMB)
        });
        
        return { cached, failed, size_mb: sizeInMB };
    }

    async getCacheStatus() {
        const cacheDir = path.join(__dirname, 'data', 'cache', 'online');
        const status = [];
        
        try {
            const sources = await fs.readdir(cacheDir);
            
            for (const sourceId of sources) {
                try {
                    const metaPath = path.join(cacheDir, sourceId, 'metadata.json');
                    const metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
                    status.push(metadata);
                } catch (e) {
                    // No metadata for this source
                }
            }
        } catch (error) {
            // Cache directory doesn't exist yet
        }
        
        return status;
    }

    getIndexInfo() {
        return {
            total_pages: this.index.pages.length,
            last_updated: this.index.last_updated,
            sources: this.index.sources || []
        };
    }
}

// CLI-interface
if (require.main === module) {
    const indexer = new ContentIndexer();
    const command = process.argv[2];
    
    (async () => {
        await indexer.initialize();
        
        if (command === 'build' || command === 'rebuild') {
            await indexer.buildIndex();
        } else if (command === 'cache') {
            console.log('\n💾 Starting offline caching...\n');
            const sources = await indexer.loadSources();
            const offlineSources = sources.online.filter(s => s.cache_offline === true);
            
            if (offlineSources.length === 0) {
                console.log('⚠️  No sources configured for offline caching');
                console.log('💡 Add "cache_offline": true to sources in sources.json');
                console.log('\nExample:');
                console.log('  {');
                console.log('    "id": "hacktricks",');
                console.log('    "name": "HackTricks",');
                console.log('    "cache_offline": true  ← Add this');
                console.log('  }');
                return;
            }
            
            if (offlineSources.length > 5) {
                console.log(`❌ Too many sources configured for caching!`);
                console.log(`   Configured: ${offlineSources.length}`);
                console.log(`   Maximum allowed: 5`);
                console.log(`   \n💡 Please reduce to 5 or fewer sources for caching`);
                return;
            }
            
            console.log(`📦 Found ${offlineSources.length} source(s) to cache:`);
            offlineSources.forEach(s => console.log(`   - ${s.name} (${s.id})`));
            console.log();
            
            let totalCached = 0;
            let totalSize = 0;
            
            for (const source of offlineSources) {
                console.log(`\n📚 Processing ${source.name}...`);
                
                let pages = [];
                if (source.type === 'gitbook') {
                    pages = await indexer.indexGitBookSource(source);
                } else if (source.type === 'docusaurus') {
                    pages = await indexer.indexDocusaurusSource(source);
                } else if (source.type === 'markdown') {
                    pages = await indexer.indexMarkdownSource(source);
                }
                
                if (pages.length > 0) {
                    const result = await indexer.cacheSourcePages(source, pages);
                    totalCached += result.cached;
                    totalSize += parseFloat(result.size_mb);
                    
                    indexer.index.pages = indexer.index.pages.filter(p => p.source_id !== source.id);
                    indexer.index.pages.push(...pages);
                }
            }

            indexer.index.sources = offlineSources.map(s => ({
                id: s.id,
                name: s.name,
                type: s.type,
                description: s.description || '',
                page_count: indexer.index.pages.filter(p => p.source_id === s.id).length,
                is_local: false
            }));
            
            indexer.index.last_updated = new Date().toISOString();
            
            await indexer.saveIndex();
            
            console.log('\n✅ Offline caching complete!');
            console.log(`   Total cached: ${totalCached} pages`);
            console.log(`   Total size: ${totalSize.toFixed(2)} MB`);
            
        } else if (command === 'cache-status') {
            console.log('\n📊 Offline Cache Status:\n');
            const status = await indexer.getCacheStatus();
            
            if (status.length === 0) {
                console.log('  No cached sources found.');
                console.log('  Run: npm run cache');
            } else {
                let totalSize = 0;
                let totalPages = 0;
                
                status.forEach(s => {
                    console.log(`📦 ${s.source_name} (${s.source_id})`);
                    console.log(`   Cached: ${s.cached_pages}/${s.total_pages} pages`);
                    console.log(`   Size: ${s.size_mb} MB`);
                    console.log(`   Last cached: ${new Date(s.cached_at).toLocaleString()}`);
                    console.log();
                    
                    totalSize += s.size_mb;
                    totalPages += s.cached_pages;
                });
                
                console.log(`Total: ${totalPages} pages, ${totalSize.toFixed(2)} MB`);
            }
            
        } else if (command === 'update' && process.argv[3]) {
            const filePath = process.argv[3];
            await indexer.updateLocalFile(filePath);
        } else if (command === 'remove' && process.argv[3]) {
            const filePath = process.argv[3];
            await indexer.removeLocalFile(filePath);
        } else if (command === 'search' && process.argv[3]) {
            const query = process.argv.slice(3).join(' ');
            const results = indexer.search(query);
            
            console.log(`\n🔍 Search results for "${query}":\n`);
            if (results.length === 0) {
                console.log('No results found.');
            } else {
                results.slice(0, 10).forEach((result, i) => {
                    console.log(`${i + 1}. ${result.title} (${result.page_name})`);
                    console.log(`   ${result.url}`);
                    console.log(`   Score: ${result.relevance_score} (${result.match_type})`);
                    if (result.snippet && result.snippet.text) {
                        console.log(`   Snippet: ${result.snippet.text.substring(0, 80)}...`);
                    }
                    console.log();
                });
                console.log(`Total ${results.length} results found.\n`);
            }
        } else if (command === 'info') {
            const info = indexer.getIndexInfo();
            console.log('\n📊 Index information:');
            console.log(`Total pages: ${info.total_pages}`);
            console.log(`Last updated: ${info.last_updated || 'Never'}`);
            console.log(`Sources: ${info.sources.length}\n`);
            info.sources.forEach(s => {
                console.log(`  - ${s.name}: ${s.page_count} pages`);
            });
            console.log();
        } else {
            console.log('\n📚 ENGRAM\n');
            console.log('Usage:');
            console.log('  node indexer.js build              - Rebuild entire index');
            console.log('  node indexer.js cache              - Cache offline sources');
            console.log('  node indexer.js cache-status       - Show cache status');
            console.log('  node indexer.js update <filepath>  - Update a local file');
            console.log('  node indexer.js remove <filepath>  - Remove file from index');
            console.log('  node indexer.js search <term>      - Search in index');
            console.log('  node indexer.js info               - Show index information\n');
        }
    })();
}

module.exports = ContentIndexer;