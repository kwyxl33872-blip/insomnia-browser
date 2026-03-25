/**
 * Scramjet-style proxy client
 * Works without iframes by rewriting URLs dynamically
 */

(function() {
    const PROXY_PATH = '/proxy';
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    
    // Don't run on proxy pages
    if (location.pathname.startsWith(PROXY_PATH)) {
        return;
    }
    
    // URL encoding function
    function encodeUrl(url) {
        try {
            return btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        } catch(e) {
            return url;
        }
    }
    
    // Rewrite URLs in the page
    function rewriteUrl(url) {
        if (!url || url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('#')) {
            return url;
        }
        
        // Already proxied
        if (url.includes(PROXY_PATH)) {
            return url;
        }
        
        // Same origin
        if (url.startsWith('/') && !url.startsWith('//')) {
            return url;
        }
        
        // External URL - proxy it
        if (url.startsWith('http')) {
            return PROXY_PATH + '/' + encodeUrl(url);
        }
        
        return url;
    }
    
    // Process existing content
    function processNode(node) {
        if (!node || node.nodeType !== 1) return;
        
        // Rewrite attributes
        ['href', 'src', 'action', 'data', 'poster', 'cite', 'background'].forEach(attr => {
            if (node[attr]) {
                node[attr] = rewriteUrl(node[attr]);
            }
        });
        
        // Process children
        Array.from(node.children || []).forEach(processNode);
    }
    
    // Observe dynamic changes
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    processNode(node);
                }
            });
        });
    });
    
    // Start observing
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            processNode(document.body);
            observer.observe(document.body, { childList: true, subtree: true });
        });
    } else {
        processNode(document.body);
        observer.observe(document.body, { childList: true, subtree: true });
    }
    
    // Intercept fetch/XHR requests
    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    
    window.fetch = function(url, options = {}) {
        const rewrittenUrl = rewriteUrl(url);
        return originalFetch(rewrittenUrl, options);
    };
    
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        const rewrittenUrl = rewriteUrl(url);
        return originalXHROpen.call(this, method, rewrittenUrl, ...args);
    };
    
    console.log('Scramjet-style proxy client loaded');
})();
