/**
 * Service Worker for proxying requests
 * Aggressively intercepts all fetch requests and routes them through the proxy
 */

const PROXY_PATH = '/proxy';
const PROXY_HOST = self.location.origin;

self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(self.clients.claim());
});

// Store the original site's base URL
let originalBaseUrl = null;

self.addEventListener('message', (event) => {
    if (event.data.type === 'setBaseUrl') {
        originalBaseUrl = event.data.url;
        console.log('[SW] Base URL set to:', originalBaseUrl);
    }
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});

// Check if URL needs proxying
function needsProxy(url) {
    try {
        const urlObj = new URL(url);
        
        // Skip if already proxied
        if (urlObj.pathname.startsWith(PROXY_PATH)) {
            return false;
        }
        
        // Skip special protocols
        if (/^(data|javascript|mailto|tel|blob|about|chrome|chrome-extension):/i.test(urlObj.protocol)) {
            return false;
        }
        
        // External http/https - proxy
        if (urlObj.origin !== PROXY_HOST && /^https?:/i.test(urlObj.protocol)) {
            return true;
        }
        
        // Same origin but looks like relative URL from original site
        if (urlObj.origin === PROXY_HOST && originalBaseUrl) {
            // Check if it's a file that looks like it's from the original site (has hash-like name)
            const pathname = urlObj.pathname;
            if (/\/[a-f0-9]{8,}-[a-z0-9]+\.js$/i.test(pathname) || 
                /\/[a-f0-9]{8,}\.js$/i.test(pathname)) {
                return 'relative';
            }
        }
        
        return false;
    } catch (e) {
        return false;
    }
}

// Intercept all fetch requests
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = request.url;
    
    // Skip non-GET requests for now
    if (request.method !== 'GET') {
        return;
    }
    
    // Check if this needs proxying
    const proxyResult = needsProxy(url);
    if (proxyResult === false) {
        return;
    }
    
    // Determine the actual URL to proxy
    let targetUrl = url;
    if (proxyResult === 'relative' && originalBaseUrl) {
        // Construct the full URL from the relative path
        const urlObj = new URL(url);
        targetUrl = originalBaseUrl.replace(/\/$/, '') + urlObj.pathname;
        console.log('[SW] Converting relative to absolute:', url, '->', targetUrl);
    }
    
    // Proxy the request
    console.log('[SW] Proxying:', targetUrl);
    const proxyUrl = `${PROXY_HOST}${PROXY_PATH}?url=${encodeURIComponent(targetUrl)}`;
    
    event.respondWith(
        fetch(proxyUrl, {
            method: request.method,
            headers: request.headers,
            mode: 'cors',
            credentials: 'omit',
            redirect: 'follow'
        }).catch(err => {
            console.error('[SW] Proxy error:', err);
            return new Response('Proxy Error: ' + err.message, { 
                status: 502,
                headers: { 'Content-Type': 'text/plain' }
            });
        })
    );
});

// Listen for messages from the main page
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
