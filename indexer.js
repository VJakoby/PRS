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
const RATE = process.env.RATE || 1000; // Default is 1000

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
        } catch (err) {}

        try {
            const indexData = await fs.readFile(this.indexPath, 'utf-8');
            this.index = JSON.parse(indexData);
            console.log(`✅ Loaded existing index with ${this.index.pages.length} pages`);
        } catch (err) {
            console.log('📝 No existing index found, creating new one');
        }

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
        
        // Get global settings with defaults
        const settings = config.index_settings || {};
        const globalTTL = settings.default_ttl_days || 7;
        const maxPages = settings.max_pages_per_source || null; // null = unlimited
        const timeout = (settings.timeout_seconds || 15) * 1000; // Convert to ms
        const retryAttempts = settings.retry_attempts || 2;
        
        const onlineSources = (config.online_sources || config.sources || [])
            .filter(s => s.enabled)
            .map(s => ({ 
                ...s, 
                ttl_days: s.ttl_days ?? globalTTL,
                max_pages: s.max_pages ?? maxPages,
                timeout: timeout,
                retry_attempts: retryAttempts
            }));
            
        const offlineSources = (config.offline_sources || []).filter(s => s.enabled);
        
        return { 
            online: onlineSources, 
            offline: offlineSources, 
            all: [...onlineSources, ...offlineSources],
            globalTTL: globalTTL,
            settings: {
                default_ttl_days: globalTTL,
                auto_refresh: settings.auto_refresh || false,
                refresh_interval_hours: settings.refresh_interval_hours || 24,
                max_pages_per_source: maxPages,
                timeout_seconds: settings.timeout_seconds || 15,
                retry_attempts: retryAttempts
            }
        };
    }

    resolvePath(configPath) {
        // Relative paths (./notes or ../docs)
        if (configPath.startsWith('./') || configPath.startsWith('../')) {
            return path.resolve(__dirname, configPath);
        }
        
        // Absolute paths (/home/user/notes or C:\Users\...)
        // Return as-is, let the OS handle it
        if (path.isAbsolute(configPath)) {
            return configPath;
        }
        
        // Plain folder name (notes) - treat as relative to project root
        return path.resolve(__dirname, configPath);
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
                        if (extensions.includes(ext)) files.push(fullPath);
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
            if (match) return match[1].trim();
        }
        return path.basename(filePath, path.extname(filePath));
    }

    async indexLocalSource(source) {
        console.log(`\n📁 Indexing ${source.name}...`);
        const pages = [];
        const resolvedPath = this.resolvePath(source.path);
        console.log(`  Path: ${resolvedPath}`);
        try {
            await fs.access(resolvedPath);
        } catch (error) {
            console.log(`  ❌ Directory does not exist: ${resolvedPath}`);
            console.log(`  💡 Tips:`);
            console.log(`     - Check the path in sources.json`);
            console.log(`     - Use relative paths: "./notes" or "../docs"`);
            console.log(`     - Use absolute paths: "/full/path/to/notes"`);
            if (resolvedPath.includes('/home/')) {
                console.log(`     - Docker: Mount host path as volume in docker-compose.yml`);
            }
            return pages;
        }
        const extensions = source.file_extensions || ['.md'];
        const files = await this.findMarkdownFiles(resolvedPath, extensions);
        console.log(`  Found ${files.length} files`);
        if (files.length === 0) return pages;
        let newFiles = 0, updatedFiles = 0, unchangedFiles = 0;
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
                    if (existingPage) updatedFiles++; else newFiles++;
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
        console.log(`\n🔄 Updating file: ${filePath}`);
        const sources = await this.loadSources();
        let sourceMatch = null, resolvedPath = null;
        for (const source of sources.offline) {
            const sourcePath = this.resolvePath(source.path);
            if (filePath.startsWith(sourcePath)) {
                sourceMatch = source;
                resolvedPath = sourcePath;
                break;
            }
        }
        if (!sourceMatch) { console.log('  ❌ File belongs to no known source'); return false; }
        const newPage = await this.indexSingleLocalFile(filePath, sourceMatch, resolvedPath);
        if (!newPage) { console.log('  ❌ Could not index file'); return false; }
        const existingIndex = this.index.pages.findIndex(p => p.file_path === filePath);
        if (existingIndex >= 0) {
            this.index.pages[existingIndex] = newPage;
            console.log('  ✅ File updated in index');
        } else {
            this.index.pages.push(newPage);
            console.log('  ✅ New file added to index');
        }
        this.index.last_updated = new Date().toISOString();
        this.index.total_pages = this.index.pages.length;
        const sourceInIndex = this.index.sources.find(s => s.id === sourceMatch.id);
        if (sourceInIndex) {
            sourceInIndex.page_count = this.index.pages.filter(p => p.source_id === sourceMatch.id).length;
        }
        await this.saveIndex();
        return true;
    }

    async removeLocalFile(filePath) {
        console.log(`\n🗑️  Removing file from index: ${filePath}`);
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
            return true;
        }
        return false;
    }

    async fetchPage(url, timeout = 15000, retries = 2) {
        let lastError = null;
        
        for (let attempt = 0; attempt <= retries; attempt++) {
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
                lastError = error;
                if (attempt < retries) {
                    // Wait a bit before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                    continue;
                }
                
                // Log only on final failure
                if (error.code === 'ECONNABORTED') console.error(`  ⏱️  Timeout: ${url}`);
                else if (error.response) console.error(`  ❌ HTTP ${error.response.status}: ${url}`);
                else console.error(`  ❌ ${error.message}: ${url}`);
                return null;
            }
        }
        return null;
    }

    extractTextContent(html) {
        const $ = cheerio.load(html);
        $('script, style, nav, header, footer, .sidebar, .menu').remove();
        return $('body').text().replace(/\s+/g, ' ').trim().toLowerCase();
    }

    extractTitle(html, url) {
        const $ = cheerio.load(html);
        let title = $('h1').first().text().trim();
        if (!title) title = $('title').text().trim();
        if (!title) {
            const urlParts = url.split('/');
            title = urlParts[urlParts.length - 1].replace(/-/g, ' ');
        }
        // Keep full title - only remove common site suffixes in <title> tag
        if (title.includes(' | ')) {
            const parts = title.split(' | ');
            // Keep everything except last part if it looks like a site name
            if (parts.length > 1 && parts[parts.length - 1].length < 30) {
                title = parts.slice(0, -1).join(' | ');
            }
        }
        return title.trim() || 'Untitled';
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
        if (index === -1) return { text: '', highlightStart: -1, highlightLength: 0 };
        const start = Math.max(0, index - length / 2);
        const end = Math.min(content.length, index + searchTerm.length + length / 2);
        let snippet = content.substring(start, end);
        let highlightStart = snippet.toLowerCase().indexOf(lowerTerm);
        if (start > 0) { snippet = '...' + snippet; highlightStart += 3; }
        if (end < content.length) snippet = snippet + '...';
        return { text: snippet, highlightStart, highlightLength: searchTerm.length };
    }

    async jitter() {
        const delay = RATE * (0.8 + Math.random() * 0.4);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

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

    async fetchSitemap(baseUrl) {
        const sitemapUrl = baseUrl.replace(/\/$/, '') + '/sitemap.xml';
        console.log(`  🗺️  Checking for sitemap: ${sitemapUrl}`);
        try {
            const xml = await this.fetchPage(sitemapUrl);
            if (!xml || !xml.includes('<loc>')) return null;
            if (xml.includes('<sitemapindex') || xml.includes('<sitemap>')) {
                console.log(`  📑 Sitemap index detected - fetching child sitemaps...`);
                const childUrls = [];
                const sitemapMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g);
                for (const match of sitemapMatches) {
                    const childUrl = match[1].trim();
                    if (childUrl.endsWith('.xml')) childUrls.push(childUrl);
                }
                const allPageUrls = [];
                for (const childUrl of childUrls) {
                    const childXml = await this.fetchPage(childUrl);
                    if (childXml && childXml.includes('<loc>')) {
                        const pageUrls = this.parseSitemapUrls(childXml, baseUrl);
                        allPageUrls.push(...pageUrls);
                    }
                }
                if (allPageUrls.length > 0) return allPageUrls;
            }
            const urls = this.parseSitemapUrls(xml, baseUrl);
            if (urls.length > 0) return urls;
        } catch (e) {
            console.log(`  ⚠️  Sitemap error: ${e.message}`);
        }
        return null;
    }

    async fetchGitBookPage(url) {
        const plainUrl = url.includes('?') ? url + '&plain=true' : url + '?plain=true';
        return await this.fetchPage(plainUrl);
    }

    async indexGitBookSource(source) {
        console.log(`\n📚 Indexing ${source.name}...`);
        const pages = [];
        const sitemapUrls = await this.fetchSitemap(source.index_url);
        let linkArray;
        if (sitemapUrls) {
            linkArray = sitemapUrls;
        } else {
            const html = await this.fetchPage(source.index_url, source.timeout, source.retry_attempts);
            if (!html) return pages;
            const $ = cheerio.load(html);
            const links = new Set();
            $('a[href]').each((i, elem) => {
                let href = $(elem).attr('href');
                if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
                    try {
                        const fullUrl = new URL(href, source.index_url).href;
                        if (fullUrl.startsWith(source.index_url)) links.add(fullUrl);
                    } catch (e) {}
                }
            });
            linkArray = Array.from(links).slice(0, 50);
        }
        
        // Apply max_pages limit if set
        if (source.max_pages && linkArray.length > source.max_pages) {
            console.log(`  ℹ️  Limiting to ${source.max_pages} pages (total found: ${linkArray.length})`);
            linkArray = linkArray.slice(0, source.max_pages);
        }
        
        let successful = 0, skipped = 0;
        for (let i = 0; i < linkArray.length; i++) {
            const link = linkArray[i];
            console.log(`  [${i + 1}/${linkArray.length}] Fetching: ${link}`);
            const pageHtml = await this.fetchGitBookPage(link);
            if (pageHtml) {
                const content = this.extractTextContent(pageHtml);
                if (content.length < 100) { 
                    console.log(`  ⏭️  Skipped (too short)`);
                    skipped++; 
                    await this.jitter(); 
                    continue; 
                }
                const title = this.extractTitle(pageHtml, link);
                pages.push({
                    source_id: source.id, source_name: source.name, url: link,
                    title: title,
                    page_name: this.extractPageName(link),
                    content: content.substring(0, 10000),
                    indexed_at: new Date().toISOString(), is_local: false
                });
                console.log(`  ✅ Indexed: ${title}`);
                successful++;
            } else {
                console.log(`  ❌ Failed to fetch`);
            }
            await this.jitter();
        }
        console.log(`  ✅ Indexed total ${pages.length} pages from ${source.name}`);
        return pages;
    }

    async indexDocusaurusSource(source) {
        console.log(`\n📘 Indexing ${source.name}...`);
        const pages = [];
        if (!source.pages || source.pages.length === 0) return pages;
        
        let pageList = source.pages;
        if (source.max_pages && pageList.length > source.max_pages) {
            console.log(`  ℹ️  Limiting to ${source.max_pages} pages (total found: ${pageList.length})`);
            pageList = pageList.slice(0, source.max_pages);
        }
        
        for (let i = 0; i < pageList.length; i++) {
            const page = pageList[i];
            const url = `${source.base_url}/${page}`;
            console.log(`  [${i + 1}/${pageList.length}] Fetching: ${url}`);
            const html = await this.fetchPage(url, source.timeout, source.retry_attempts);
            if (html) {
                const title = this.extractTitle(html, url);
                pages.push({
                    source_id: source.id, source_name: source.name, url,
                    title: title,
                    page_name: page.replace(/-/g, ' '),
                    content: this.extractTextContent(html).substring(0, 10000),
                    indexed_at: new Date().toISOString(), is_local: false
                });
                console.log(`  ✅ Indexed: ${title}`);
            } else {
                console.log(`  ❌ Failed to fetch`);
            }
            await this.jitter();
        }
        console.log(`  ✅ Indexed ${pages.length} pages from ${source.name}`);
        return pages;
    }

    async indexMarkdownSource(source) {
        console.log(`\n📄 Indexing ${source.name}...`);
        const pages = [];
        if (!source.urls || source.urls.length === 0) return pages;
        
        let urlList = source.urls;
        if (source.max_pages && urlList.length > source.max_pages) {
            console.log(`  ℹ️  Limiting to ${source.max_pages} pages (total found: ${urlList.length})`);
            urlList = urlList.slice(0, source.max_pages);
        }
        
        for (let i = 0; i < urlList.length; i++) {
            const url = urlList[i];
            console.log(`  [${i + 1}/${urlList.length}] Fetching: ${url}`);
            const markdownContent = await this.fetchPage(url, source.timeout, source.retry_attempts);
            if (markdownContent) {
                const lines = markdownContent.split('\n');
                let title = null;
                for (const line of lines) {
                    const match = line.match(/^#\s+(.+)/);
                    if (match) { title = match[1].trim(); break; }
                }
                if (!title) {
                    const urlParts = url.split('/');
                    title = urlParts[urlParts.length - 1].replace(/\.md$/i, '').replace(/[-_]/g, ' ');
                }
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split('/').filter(p => p);
                const pageName = pathParts[pathParts.length - 1].replace(/\.md$/i, '').replace(/[-_]/g, ' ');
                const content = markdownContent
                    .replace(/```[\s\S]*?```/g, ' ').replace(/`[^`]+`/g, ' ')
                    .replace(/[#*_\[\]()]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
                pages.push({
                    source_id: source.id, source_name: source.name, url, title, page_name: pageName,
                    content: content.substring(0, 10000),
                    indexed_at: new Date().toISOString(), is_local: false
                });
                console.log(`  ✅ Indexed: ${title}`);
            } else {
                console.log(`  ❌ Failed to fetch`);
            }
            await this.jitter();
        }
        console.log(`  ✅ Indexed total ${pages.length} markdown files from ${source.name}`);
        return pages;
    }

    async buildIndex() {
        console.log('\n🚀 Starting indexing of all sources...\n');
        const sources = await this.loadSources();
        const forceReindex = process.argv.includes('--force');
        const onlineOnly = process.argv.includes('--online');
        const localOnly = process.argv.includes('--local');
        const defaultTTL = sources.globalTTL || 7;
        
        // Validate flags
        if (onlineOnly && localOnly) {
            console.error('❌ Error: Cannot use both --online and --local flags together');
            process.exit(1);
        }
        
        console.log(`⏱️  Rate limit: ${this.getRateFormatted()}`);
        
        if (forceReindex) {
            console.log('⚡ FORCE MODE - Re-indexing all sources regardless of age');
        } else {
            console.log(`ℹ️  Using TTL: ${defaultTTL} days (can be overridden per source)`);
        }
        
        if (onlineOnly) {
            console.log('🌐 MODE: Online sources only');
        } else if (localOnly) {
            console.log('📁 MODE: Local sources only');
        }
        
        console.log();
        
        const allPages = [];
        let skippedCount = 0, indexedCount = 0;
        
        // Index online sources (unless --local is specified)
        if (!localOnly && sources.online.length > 0) {
            console.log('🌐 ONLINE SOURCES:');
            for (const source of sources.online) {
                try {
                    const ttlDays = source.ttl_days;
                    const shouldSkip = this.shouldSkipSource(source.id, ttlDays, forceReindex);
                    
                    if (shouldSkip) {
                        const age = this.getSourceAge(source.id);
                        const existingPages = this.reuseSourcePages(source.id);
                        console.log(`\n✅ ${source.name} - Skipping (indexed ${age}, TTL: ${ttlDays} days)`);
                        console.log(`   Using ${existingPages.length} cached pages from index`);
                        allPages.push(...existingPages);
                        skippedCount++;
                        continue;
                    }
                    
                    let pages = [];
                    if (source.type === 'gitbook') pages = await this.indexGitBookSource(source);
                    else if (source.type === 'docusaurus') pages = await this.indexDocusaurusSource(source);
                    else if (source.type === 'markdown') pages = await this.indexMarkdownSource(source);
                    allPages.push(...pages);
                    indexedCount++;
                } catch (error) {
                    console.error(`❌ Error indexing ${source.name}:`, error.message);
                }
            }
        } else if (localOnly && sources.online.length > 0) {
            // When --local is specified, keep existing online pages in index
            console.log('🌐 ONLINE SOURCES: Skipped (--local flag active)');
            console.log('   Preserving existing online pages in index\n');
            sources.online.forEach(source => {
                const existingPages = this.reuseSourcePages(source.id);
                if (existingPages.length > 0) {
                    allPages.push(...existingPages);
                }
            });
        }
        
        // Index offline sources (unless --online is specified)
        if (!onlineOnly && sources.offline.length > 0) {
            console.log('\n📁 OFFLINE SOURCES:');
            for (const source of sources.offline) {
                try {
                    const pages = await this.indexLocalSource(source);
                    allPages.push(...pages);
                    indexedCount++;
                } catch (error) {
                    console.error(`❌ Error indexing ${source.name}:`, error.message);
                }
            }
        } else if (onlineOnly && sources.offline.length > 0) {
            // When --online is specified, keep existing offline pages in index
            console.log('\n📁 OFFLINE SOURCES: Skipped (--online flag active)');
            console.log('   Preserving existing offline pages in index\n');
            sources.offline.forEach(source => {
                const existingPages = this.reuseSourcePages(source.id);
                if (existingPages.length > 0) {
                    allPages.push(...existingPages);
                }
            });
        }
        
        // Update index with last_indexed timestamp for each source
        const updatedSources = sources.all.map(s => {
            const ttlDays = s.ttl_days || defaultTTL;
            const isOnlineSource = sources.online.find(os => os.id === s.id);
            const isOfflineSource = sources.offline.find(os => os.id === s.id);
            
            // Determine if this source was actually indexed in this run
            let wasIndexedNow = false;
            if (onlineOnly && isOnlineSource) {
                wasIndexedNow = !this.shouldSkipSource(s.id, ttlDays, forceReindex) || forceReindex;
            } else if (localOnly && isOfflineSource) {
                wasIndexedNow = true;
            } else if (!onlineOnly && !localOnly) {
                if (isOnlineSource) {
                    wasIndexedNow = !this.shouldSkipSource(s.id, ttlDays, forceReindex) || forceReindex;
                } else {
                    wasIndexedNow = true;
                }
            }
            
            const existing = this.index.sources.find(old => old.id === s.id);
            
            return {
                id: s.id,
                name: s.name,
                type: s.type,
                description: s.description || '',
                page_count: allPages.filter(p => p.source_id === s.id).length,
                is_local: s.type === 'local',
                last_indexed: wasIndexedNow ? new Date().toISOString() : (existing?.last_indexed || new Date().toISOString()),
                ttl_days: ttlDays
            };
        });
        
        this.index = {
            pages: allPages,
            last_updated: new Date().toISOString(),
            total_pages: allPages.length,
            sources: updatedSources
        };
        
        this.index.pages.forEach(page => { 
            if (page.is_local === undefined) page.is_local = false; 
        });
        
        await this.saveIndex();
        
        console.log(`\n✅ Indexing complete!`);
        console.log(`   Total pages: ${allPages.length}`);
        console.log(`   Sources indexed: ${indexedCount}`);
        console.log(`   Sources skipped (TTL): ${skippedCount}`);
        if (!forceReindex && skippedCount > 0 && !onlineOnly && !localOnly) {
            console.log(`\n💡 Tip: Use --force to re-index all sources regardless of TTL`);
        }
    }

    async saveIndex() {
        await fs.copyFile(this.indexPath, this.indexPath + '.backup').catch(() => {});
        const indexData = JSON.stringify(this.index, null, 2);
        await fs.writeFile(this.indexPath, indexData, 'utf-8');
        const metadataPath = this.indexPath.replace('.json', '.meta.json');
        await fs.writeFile(metadataPath, JSON.stringify({
            size_bytes: indexData.length,
            size_kb: parseFloat((indexData.length / 1024).toFixed(2)),
            pages_count: this.index.pages.length,
            last_saved: new Date().toISOString()
        }, null, 2), 'utf-8');
    }

    expandQuery(query) {
        if (!this.synonyms || Object.keys(this.synonyms).length === 0) return query;
        const terms = query.toLowerCase().split(/\s+/);
        const expanded = new Set();
        terms.forEach(term => {
            expanded.add(term);
            Object.entries(this.synonyms).forEach(([key, synonymArray]) => {
                if (key === term || synonymArray.includes(term)) {
                    synonymArray.forEach(syn => expanded.add(syn));
                }
            });
        });
        return [...expanded].join(' ');
    }

    search(query, options = {}) {
        const fuzzyMatch = options.fuzzy !== false;
        const context    = options.context || null;
        const hasContext = context && context.active;

        const originalTerm = query.toLowerCase().trim();
        const expandedStr  = this.expandQuery(query).toLowerCase().trim();
        const allTerms = [originalTerm];
        expandedStr.split(/\s+/).forEach(t => {
            if (t && !allTerms.includes(t)) allTerms.push(t);
        });

        const results = [];

        for (const page of this.index.pages) {
            let score       = 0;
            let matchType   = null;
            let contextBoosted = false;

            const titleLower    = page.title.toLowerCase();
            const pageNameLower = page.page_name.toLowerCase();
            const contentLower  = page.content;
            const urlLower      = page.url.toLowerCase();

            for (let ti = 0; ti < allTerms.length; ti++) {
                const term   = allTerms[ti];
                const weight = ti === 0 ? 1.0 : 0.6;

                if (titleLower === term) {
                    score += Math.round(100 * weight);
                    if (!matchType) matchType = 'exact_title';
                }
                else if (titleLower.includes(term)) {
                    score += Math.round(50 * weight);
                    if (!matchType) matchType = 'title_contains';
                }

                if (pageNameLower.includes(term)) {
                    score += Math.round(30 * weight);
                    if (!matchType) matchType = 'page_name';
                }

                if (urlLower.includes(term)) {
                    score += Math.round(20 * weight);
                    if (!matchType) matchType = 'url';
                }

                const safeRe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const occurrences = (contentLower.match(new RegExp(safeRe, 'g')) || []).length;
                if (occurrences > 0) {
                    score += Math.round(occurrences * 2 * weight);
                    if (!matchType) matchType = 'content';
                }

                if (fuzzyMatch && score === 0 && ti === 0) {
                    const fScore = this.fuzzySearch(term, titleLower) +
                                   this.fuzzySearch(term, pageNameLower);
                    if (fScore > 0.7) {
                        score += Math.floor(fScore * 10);
                        matchType = 'fuzzy';
                    }
                }
            }

            if (score > 0 && titleLower.length < 50) score += 5;

            if (score > 0 && hasContext) {
                const pageContent = (titleLower + ' ' + contentLower).toLowerCase();
                if (context.services && context.services.length > 0) {
                    context.services.forEach(service => {
                        if (pageContent.includes(service.toLowerCase())) {
                            score += 15;
                            contextBoosted = true;
                        }
                    });
                }
                if (context.phase) {
                    const phaseKeywords = {
                        'initial_recon':        ['reconnaissance', 'enumeration', 'discovery', 'scanning'],
                        'enumeration':           ['enum', 'list', 'users', 'shares', 'services'],
                        'exploitation':          ['exploit', 'vulnerability', 'rce', 'shell', 'payload'],
                        'privilege_escalation':  ['privesc', 'sudo', 'suid', 'root', 'admin', 'elevation'],
                        'lateral_movement':      ['lateral', 'pivot', 'smb', 'pass the hash', 'kerberos']
                    };
                    (phaseKeywords[context.phase] || []).forEach(keyword => {
                        if (pageContent.includes(keyword)) { score += 10; contextBoosted = true; }
                    });
                }
            }

            if (score > 0) {
                results.push({
                    ...page,
                    relevance_score: score,
                    match_type:      matchType,
                    snippet:         this.extractSnippet(page.content, originalTerm),
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
        let matches = 0, patternIndex = 0;
        for (let i = 0; i < text.length && patternIndex < pattern.length; i++) {
            if (text[i] === pattern[patternIndex]) { matches++; patternIndex++; }
        }
        return matches / pattern.length;
    }

    hashUrl(url) { return crypto.createHash('md5').update(url).digest('hex'); }

    removeImages(html) {
        const $ = cheerio.load(html);
        $('img, picture, svg, video, audio').remove();
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
        } catch { return '0.00'; }
    }

    async saveCacheMetadata(sourceId, metadata) {
        const cacheDir = path.join(__dirname, 'data', 'cache', 'online', sourceId);
        await fs.mkdir(cacheDir, { recursive: true });
        await fs.writeFile(path.join(cacheDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');
    }

    async cacheSourcePages(source, pages) {
        const cacheDir = path.join(__dirname, 'data', 'cache', 'online', source.id);
        await fs.mkdir(cacheDir, { recursive: true });
        let cached = 0, failed = 0;
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            console.log(`  [${i + 1}/${pages.length}] Caching: ${page.url}`);
            try {
                const html = await this.fetchPage(page.url);
                if (!html) { 
                    console.log(`  ❌ Failed to fetch`);
                    failed++; 
                    continue; 
                }
                const cleanHtml = this.removeImages(html);
                const hash = this.hashUrl(page.url);
                await fs.writeFile(path.join(cacheDir, `${hash}.html`), cleanHtml, 'utf-8');
                page.cache_hash = hash; page.cached_at = new Date().toISOString(); page.is_cached = true;
                console.log(`  ✅ Cached successfully`);
                cached++;
                await this.jitter();
            } catch (error) { 
                console.log(`  ❌ Error: ${error.message}`);
                failed++; 
            }
        }
        const sizeInMB = await this.getCacheSize(cacheDir);
        await this.saveCacheMetadata(source.id, {
            source_name: source.name, source_id: source.id,
            total_pages: pages.length, cached_pages: cached, failed_pages: failed,
            cached_at: new Date().toISOString(), size_mb: parseFloat(sizeInMB)
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
                    const metadata = JSON.parse(await fs.readFile(path.join(cacheDir, sourceId, 'metadata.json'), 'utf-8'));
                    status.push(metadata);
                } catch {}
            }
        } catch {}
        return status;
    }

    getIndexInfo() {
        return {
            total_pages: this.index.pages.length,
            last_updated: this.index.last_updated,
            sources: this.index.sources || []
        };
    }

    getRate() {
        return RATE;
    }

    getRateFormatted() {
        const requestsPerSecond = 1000 / RATE;
        
        // Format based on value
        if (requestsPerSecond >= 1) {
            return `${RATE}ms (${requestsPerSecond.toFixed(1)} req/s)`;
        } else {
            // Less than 1 req/s, show as requests per minute
            const requestsPerMinute = (60 * 1000) / RATE;
            return `${RATE}ms (~${requestsPerMinute.toFixed(0)} req/min)`;
        }
    }

    // Check if a source should be skipped based on TTL
    shouldSkipSource(sourceId, ttlDays, forceReindex) {
        if (forceReindex) return false; // Never skip in force mode
        
        const sourceInIndex = this.index.sources.find(s => s.id === sourceId);
        if (!sourceInIndex || !sourceInIndex.last_indexed) return false; // No previous index, must index
        
        const lastIndexed = new Date(sourceInIndex.last_indexed);
        const now = new Date();
        const daysSinceIndex = (now - lastIndexed) / (1000 * 60 * 60 * 24);
        
        return daysSinceIndex < ttlDays;
    }

    // Get age of source index in human-readable format
    getSourceAge(sourceId) {
        const sourceInIndex = this.index.sources.find(s => s.id === sourceId);
        if (!sourceInIndex || !sourceInIndex.last_indexed) return 'never indexed';
        
        const lastIndexed = new Date(sourceInIndex.last_indexed);
        const now = new Date();
        const daysSinceIndex = Math.floor((now - lastIndexed) / (1000 * 60 * 60 * 24));
        
        if (daysSinceIndex === 0) return 'today';
        if (daysSinceIndex === 1) return '1 day ago';
        return `${daysSinceIndex} days ago`;
    }

    // Reuse existing pages from index for a source
    reuseSourcePages(sourceId) {
        return this.index.pages.filter(p => p.source_id === sourceId);
    }
}

if (require.main === module) {
    const indexer = new ContentIndexer();
    const command = process.argv[2];
    
    // Check for --help flag
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        console.log('ENGRAM Indexer - Usage:');
        console.log('');
        console.log('Indexing:');
        console.log('  npm run index                           Smart incremental indexing (respects TTL)');
        console.log('  npm run index -- --force                Force re-index all sources');
        console.log('  npm run index -- --online               Index only online sources');
        console.log('  npm run index -- --local                Index only local sources');
        console.log('  npm run index -- --force --online       Force re-index online sources only');
        console.log('  npm run index -- --force --local        Force re-index local sources only');
        console.log('');
        console.log('Information & Status:');
        console.log('  npm run info                            Show index status and source ages');
        console.log('  npm run search "query"                  Search the index');
        console.log('  npm run help                            Show this help');
        console.log('');
        console.log('Cache Management:');
        console.log('  npm run cache                           Cache pages for offline use');
        console.log('  npm run cache-status                    Check cache status');
        console.log('');
        console.log('File Management:');
        console.log('  npm run update <file>                   Update specific local file');
        console.log('  npm run remove <file>                   Remove file from index');
        console.log('');
        console.log('Docker Usage:');
        console.log('  docker compose run --rm engram npm run index');
        console.log('  docker compose run --rm engram npm run index -- --local');
        console.log('  docker compose run --rm engram npm run info');
        console.log('  docker compose run --rm engram npm run search "query"');
        console.log('');
        console.log('Examples:');
        console.log('  npm run index                           # Daily update (fast)');
        console.log('  npm run index -- --local                # Update only local files');
        console.log('  npm run index -- --force                # Full re-index (slow)');
        console.log('  npm run search "sql injection"          # Search indexed content');
        console.log('');
        process.exit(0);
    }
    
    (async () => {
        await indexer.initialize();
        if (!command || command === 'build' || command === 'rebuild' || command.startsWith('--')) {
            await indexer.buildIndex();
        } else if (command === 'cache') {
            const sources = await indexer.loadSources();
            const offlineSources = sources.online.filter(s => s.cache_offline === true);
            if (offlineSources.length === 0) { console.log('⚠️  No sources configured for offline caching'); return; }
            if (offlineSources.length > 5) { console.log('❌ Too many sources (max 5)'); return; }
            for (const source of offlineSources) {
                let pages = [];
                if (source.type === 'gitbook') pages = await indexer.indexGitBookSource(source);
                else if (source.type === 'docusaurus') pages = await indexer.indexDocusaurusSource(source);
                else if (source.type === 'markdown') pages = await indexer.indexMarkdownSource(source);
                if (pages.length > 0) await indexer.cacheSourcePages(source, pages);
            }
        } else if (command === 'cache-status') {
            const status = await indexer.getCacheStatus();
            status.forEach(s => console.log(`📦 ${s.source_name}: ${s.cached_pages}/${s.total_pages} pages, ${s.size_mb}MB`));
        } else if (command === 'update' && process.argv[3]) {
            await indexer.updateLocalFile(process.argv[3]);
        } else if (command === 'remove' && process.argv[3]) {
            await indexer.removeLocalFile(process.argv[3]);
        } else if (command === 'search' && process.argv[3]) {
            const q = process.argv.slice(3).join(' ');
            const results = indexer.search(q);
            results.slice(0, 10).forEach((r, i) => {
                console.log(`${i+1}. ${r.title} — score: ${r.relevance_score} (${r.match_type})`);
                console.log(`   ${r.url}`);
            });
            console.log(`\nTotal: ${results.length} results`);
        } else if (command === 'info') {
            const info = indexer.getIndexInfo();
            console.log(`\n📊 ENGRAM Index Status`);
            console.log(`   Total pages: ${info.total_pages}`);
            console.log(`   Last updated: ${info.last_updated || 'Never'}`);
            console.log(`\n📚 Sources:`);
            info.sources.forEach(s => {
                const age = indexer.getSourceAge(s.id);
                const ttl = s.ttl_days || 7;
                console.log(`   - ${s.name}: ${s.page_count} pages (indexed ${age}, TTL: ${ttl}d)`);
            });
            console.log(`\n💡 Tips:`);
            console.log(`   - Run "npm run index" for incremental update (respects TTL)`);
            console.log(`   - Run "npm run index -- --force" to re-index everything`);
        } else {
            console.log('ENGRAM Indexer - Usage:');
            console.log('');
            console.log('Indexing:');
            console.log('  npm run index                           Smart incremental indexing (respects TTL)');
            console.log('  npm run index -- --force                Force re-index all sources');
            console.log('  npm run index -- --online               Index only online sources');
            console.log('  npm run index -- --local                Index only local sources');
            console.log('  npm run index -- --force --online       Force re-index online sources only');
            console.log('  npm run index -- --force --local        Force re-index local sources only');
            console.log('');
            console.log('Information & Status:');
            console.log('  npm run info                            Show index status and source ages');
            console.log('  npm run search "query"                  Search the index');
            console.log('  npm run help                            Show this help');
            console.log('');
            console.log('Cache Management:');
            console.log('  npm run cache                           Cache pages for offline use');
            console.log('  npm run cache-status                    Check cache status');
            console.log('');
            console.log('File Management:');
            console.log('  npm run update <file>                   Update specific local file');
            console.log('  npm run remove <file>                   Remove file from index');
            console.log('');
            console.log('Docker Usage:');
            console.log('  docker compose run --rm engram npm run index');
            console.log('  docker compose run --rm engram npm run index -- --local');
            console.log('  docker compose run --rm engram npm run info');
            console.log('  docker compose run --rm engram npm run search "query"');
            console.log('');
        }
    })();
}

module.exports = ContentIndexer;