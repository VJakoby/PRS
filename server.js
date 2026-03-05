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
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const ContentIndexer = require('./indexer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initiera indexer
const indexer = new ContentIndexer();
let indexReady = false;

// Load index and start server
async function startServer() {
    try {
        await indexer.initialize();
        const info = indexer.getIndexInfo();
        
        if (info.total_pages > 0) {
            indexReady = true;
            console.log(`
✅ Index loaded with ${info.total_pages} pages`);
            console.log(`📅 Last updated: ${info.last_updated || 'Never'}`);
            console.log(`📚 Sources:`);
            info.sources.forEach(s => {
                console.log(`   - ${s.name}: ${s.page_count} pages`);
            });
            console.log();
        } else {
            console.log('⚠️  Index is empty. Run "npm run index" to build the index.');
        }
    } catch (error) {
        console.error('❌ Error loading index:', error.message);
    }

    // Start server after index is loaded
    app.listen(PORT, () => {
        console.log(`✅ ENGRAM server started`);
        console.log(`🌐 Server is being run at:  http://localhost:${PORT}`);        
        if (!indexReady) {
            console.log('⚠️  OBS: Index not ready!');
            console.log('   Run: npm run index\n');
        }
    });
}

startServer();

// API: Get status and sources
app.get('/api/status', (req, res) => {
    const info = indexer.getIndexInfo();
    res.json({
        ready: indexReady,
        version: '3.0',
        ...info
    });
});

// ═══════════════════════════════════════════════
// PRAGMA INTEGRATION - Target Context
// ═══════════════════════════════════════════════
const PRAGMA_URL = process.env.PRAGMA_URL || 'http://localhost:3000';
const CONTEXT_CACHE_TTL = 5000; // 5 seconds

let cachedContext = null;
let cacheTimestamp = 0;

async function fetchPragmaContext(sessionId, targetId) {
  const now = Date.now();
  
  if (cachedContext && (now - cacheTimestamp) < CONTEXT_CACHE_TTL) {
    return cachedContext;
  }
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    
    const response = await fetch(`${PRAGMA_URL}/api/engram/context`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json' 
      },
      body: JSON.stringify({ 
        session_id: sessionId, 
        target_id: targetId 
      })
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`PRAGMA returned ${response.status}`);
    }
    
    const context = await response.json();
    cachedContext = context;
    cacheTimestamp = now;
    
    return context;
    
  } catch (error) {
    console.debug(`[ENGRAM] PRAGMA not available: ${error.message}`);
    return { active: false, target: null };
  }
}

function injectTargetValues(text, target) {
  if (!target || !target.ip) return text;
  
  const shellEscape = (str) => {
    if (!str) return '';
    return String(str).replace(/[;&|`$(){}[\]<>'"\\]/g, '');
  };
  
  const safeIP = shellEscape(target.ip);
  const safeDomain = shellEscape(target.domain || '');
  
  let injected = text;
  
  // IP placeholders
  injected = injected.replace(/&lt;IP&gt;/g, safeIP);
  injected = injected.replace(/<IP>/g, safeIP);
  injected = injected.replace(/\$IP\b/g, safeIP);
  injected = injected.replace(/\$TARGET_IP\b/g, safeIP);
  injected = injected.replace(/\$RHOST\b/g, safeIP);
  injected = injected.replace(/\{IP\}/g, safeIP);
  
  // Domain placeholders
  if (safeDomain) {
    injected = injected.replace(/&lt;DOMAIN&gt;/g, safeDomain);
    injected = injected.replace(/<DOMAIN>/g, safeDomain);
    injected = injected.replace(/\$DOMAIN\b/g, safeDomain);
    injected = injected.replace(/\{DOMAIN\}/g, safeDomain);
  }
  
  return injected;
}

// API: Get PRAGMA context (for frontend)
app.post('/api/pragma/context', async (req, res) => {
  const { session_id, target_id } = req.body;
  const context = await fetchPragmaContext(session_id, target_id);
  res.json(context);
});

// API: Manual injection endpoint
app.post('/api/pragma/inject', async (req, res) => {
  const { text, session_id, target_id } = req.body;
  
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing text parameter' });
  }
  
  if (text.length > 50000) {
    return res.status(400).json({ error: 'Text too large' });
  }
  
  const context = await fetchPragmaContext(session_id, target_id);
  
  if (!context.active || !context.target) {
    return res.json({ injected: text, changes: false });
  }
  
  const injected = injectTargetValues(text, context.target);
  
  res.json({
    injected: injected,
    changes: injected !== text,
    context: {
      ip: context.target.ip,
      domain: context.target.domain
    }
  });
});

// API: Sök
app.post('/api/search', async (req, res) => {
    const { query, fuzzy = true, fuzzy_prefer = false, session_id, target_id } = req.body;
    
    if (!indexReady) {
        return res.status(503).json({
            error: 'Index not ready. Run "npm run index" first.',
            results: [],
            count: 0
        });
    }
    
    if (!query || query.trim() === '') {
        return res.json({ results: [], count: 0, query: '' });
    }

    try {
        const startTime = Date.now();
        
        // Fetch PRAGMA context (non-blocking, cached)
        const context = session_id && target_id 
          ? await fetchPragmaContext(session_id, target_id)
          : { active: false, target: null };
        
        const results = indexer.search(query, { fuzzy, fuzzy_prefer });
        const searchTime = Date.now() - startTime;
        
        // Inject target into snippets
        const topResults = results.slice(0, 50).map(r => {
            const injected = { ...r };
            
            // Inject into snippet if PRAGMA is active
            if (injected.snippet && context.target) {
                if (typeof injected.snippet === 'string') {
                    injected.snippet = injectTargetValues(injected.snippet, context.target);
                } else if (injected.snippet && injected.snippet.text) {
                    injected.snippet = {
                        ...injected.snippet,
                        text: injectTargetValues(injected.snippet.text, context.target)
                    };
                }
            }
            
            return {
                source_name: injected.source_name,
                source_id: injected.source_id,
                title: injected.title,
                page_name: injected.page_name,
                url: injected.url,
                file_path: injected.file_path,
                relevance_score: injected.relevance_score,
                match_type: injected.match_type,
                snippet: injected.snippet,
                is_local: injected.is_local
            };
        });

        res.json({
            results: topResults,
            count: topResults.length,
            total_matches: results.length,
            query: query,
            search_time_ms: searchTime,
            total_searched: indexer.index.pages.length,
            // Include target info for frontend banner
            pragma_context: context.active ? {
                ip: context.target?.ip,
                domain: context.target?.domain
            } : null
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            error: 'Search error',
            results: [],
            count: 0
        });
    }
});

// API: Get all sources
app.get('/api/sources', (req, res) => {
    const info = indexer.getIndexInfo();
    res.json({
        sources: info.sources || [],
        total: info.sources?.length || 0
    });
});

// API: Preview lokal markdown-fil
app.get('/api/preview', async (req, res) => {
    const { file } = req.query;
    
    if (!file) {
        return res.status(400).json({ error: 'No file specified' });
    }
    
    try {
        // Security: Only allow files that are in the index
        const page = indexer.index.pages.find(p => p.file_path === file);
        if (!page) {
            return res.status(404).json({ error: 'File not found in index' });
        }
        
        const content = await fs.readFile(file, 'utf-8');
        
        // Simple markdown to HTML conversion (basic)
        const html = simpleMarkdownToHTML(content);
        
        res.json({
            title: page.title,
            page_name: page.page_name,
            html: html,
            raw: content,
            file_path: file
        });
    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ error: 'Could not read file' });
    }
});

// Simple markdown to HTML converter (basic but works)
function simpleMarkdownToHTML(markdown) {
    let html = markdown;
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    
    // Wrap in paragraph
    html = '<p>' + html + '</p>';
    
    // Clean up
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p><h/g, '<h');
    html = html.replace(/<\/h([1-6])><\/p>/g, '</h$1>');
    html = html.replace(/<p><pre>/g, '<pre>');
    html = html.replace(/<\/pre><\/p>/g, '</pre>');
    
    return html;
}

// API: Incremental update of local file
app.post('/api/update-file', async (req, res) => {
    const { file } = req.body;
    
    if (!file) {
        return res.status(400).json({ error: 'No file specified' });
    }
    
    try {
        const success = await indexer.updateLocalFile(file);
        if (success) {
            res.json({ 
                success: true, 
                message: 'File updated in index',
                total_pages: indexer.index.pages.length
            });
        } else {
            res.status(400).json({ 
                success: false,
                error: 'Could not update file'
            });
        }
    } catch (error) {
        console.error('Update file error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// API: Remove file from index
app.post('/api/remove-file', async (req, res) => {
    const { file } = req.body;
    
    if (!file) {
        return res.status(400).json({ error: 'No file specified' });
    }
    
    try {
        const success = await indexer.removeLocalFile(file);
        if (success) {
            res.json({ 
                success: true, 
                message: 'File removed from index',
                total_pages: indexer.index.pages.length
            });
        } else {
            res.status(404).json({ 
                success: false,
                error: 'File not found in index'
            });
        }
    } catch (error) {
        console.error('Remove file error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// API: Get cached page (for offline preview)
app.get('/api/cached-page', async (req, res) => {
    const { source_id, url } = req.query;
    
    if (!source_id || !url) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    
    try {
        const crypto = require('crypto');
        const hash = crypto.createHash('md5').update(url).digest('hex');
        const cachePath = path.join(__dirname, 'data', 'cache', 'online', source_id, `${hash}.html`);
        
        const html = await fs.readFile(cachePath, 'utf-8');
        
        res.json({
            html: html,
            cached: true,
            source_id: source_id,
            url: url
        });
    } catch (error) {
        res.status(404).json({ 
            error: 'Page not cached',
            message: 'Run: npm run cache to cache offline pages' 
        });
    }
});

// API: Get cache status
app.get('/api/cache-status', async (req, res) => {
    try {
        const status = await indexer.getCacheStatus();
        res.json({ sources: status });
    } catch (error) {
        console.error('Cache status error:', error);
        res.json({ sources: [] });
    }
});

// API: Bygg om index (async)
app.post('/api/rebuild-index', async (req, res) => {
    if (!indexReady) {
        return res.status(503).json({
            error: 'Indexering pågår redan eller kan inte startas'
        });
    }

    try {
        console.log('🔄 Starting index rebuild...');
        res.json({ message: 'Indexing started in background' });
        
        indexReady = false;
        await indexer.buildIndex();
        indexReady = true;
        
        console.log('✅ Index rebuilt!');
    } catch (error) {
        console.error('❌ Error during rebuild:', error);
        indexReady = true; // Reset status
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        index_ready: indexReady,
        uptime: process.uptime()
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down server...');
    process.exit(0);
});