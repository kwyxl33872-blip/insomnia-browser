/**
 * Service Worker for proxying requests
 * Intercepts fetch requests and routes them through the proxy
 */

const PROXY_PATH = '/proxy';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Rewrite URLs to go through proxy
function rewriteUrl(url) {
    try {
        const urlObj = new URL(url);
        
        // Skip if already proxied
        if (urlObj.pathname.startsWith(PROXY_PATH)) {
            return url;
        }
        
        // Skip same-origin requests
        if (urlObj.origin === self.location.origin) {
            return url;
        }
        
        // Skip data URLs, javascript, mailto
        if (/^(data|javascript|mailto|tel|blob|about):/i.test(url)) {
            return url;
        }
        
        // Proxy http/https requests
        if (/^https?:/i.test(urlObj.protocol)) {
            return `${self.location.origin}${PROXY_PATH}?url=${encodeURIComponent(url)}`;
        }
        
        return url;
    } catch (e) {
        // Relative URLs - convert to absolute and proxy
        if (url.startsWith('/')) {
            return `${self.location.origin}${url}`;
        }
        if (!url.includes('://')) {
            // Likely relative, skip
            return url;
        }
        return url;
    }
}

// Intercept fetch requests
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = request.url;
    
    // Skip non-GET requests for now
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip service worker scope
    if (url.includes('/sw.js')) {
        return;
    }
    
    // Rewrite and proxy the request
    const proxiedUrl = rewriteUrl(url);
    
    if (proxiedUrl !== url) {
        event.respondWith(
            fetch(proxiedUrl, {
                method: request.method,
                headers: request.headers,
                mode: 'cors',
                credentials: 'omit'
            }).catch((err) => {
                console.error('Proxy fetch failed:', err);
                return new Response(`Proxy error: ${err.message}`, {
                    status: 502,
                    headers: { 'Content-Type': 'text/plain' }
                });
            })
        );
    }
});
