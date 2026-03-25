/**
 * Scramjet-style proxy implementation
 * Rewrites URLs dynamically for seamless proxy experience
 */

const express = require("express");
const path = require("path");
const cheerio = require("cheerio");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const PROXY_PATH = "/proxy";
const ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex'); // In production, use a fixed key

const app = express();

// URL encoding/decoding for obfuscation
function encodeUrl(url) {
    return Buffer.from(url).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function decodeUrl(encoded) {
    try {
        // Add padding back
        const padded = encoded + '='.repeat((4 - encoded.length % 4) % 4);
        const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(base64, 'base64').toString('utf8');
    } catch (e) {
        return null;
    }
}

function isBlockedTarget(urlStr) {
    try {
        const u = new URL(urlStr);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
            return true;
        }
        const h = u.hostname.toLowerCase();
        if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") {
            return true;
        }
        return false;
    } catch (e) {
        return true;
    }
}

function rewriteHtml(html, pageUrl) {
    const $ = cheerio.load(html, { decodeEntities: false });
    const base = new URL(pageUrl);

    function abs(u) {
        try {
            return new URL(u, base).href;
        } catch (e) {
            return null;
        }
    }

    function rewriteAttr(sel, attr) {
        $(sel).each(function (_, el) {
            const v = $(el).attr(attr);
            if (!v) return;
            
            if (attr === "href" && (v.startsWith("#") || v.startsWith("javascript:") || v.startsWith("mailto:") || v.startsWith("tel:"))) {
                return;
            }
            
            // Convert to absolute URL
            let absoluteUrl;
            if (v.startsWith("http")) {
                absoluteUrl = v;
            } else if (v.startsWith("/")) {
                absoluteUrl = new URL(v, base).href;
            } else {
                absoluteUrl = new URL(v, base).href;
            }
            
            console.log(`Rewriting ${attr}: ${v} -> ${absoluteUrl}`);
            
            if (absoluteUrl && absoluteUrl.startsWith("http")) {
                $(el).attr(attr, PROXY_PATH + "?url=" + encodeURIComponent(absoluteUrl));
            }
        });
    }

    // Rewrite all attributes that can contain URLs
    rewriteAttr('a[href]', "href");
    rewriteAttr('link[href]', "href");
    rewriteAttr('area[href]', "href");
    rewriteAttr('img[src]', "src");
    rewriteAttr('script[src]', "src");
    rewriteAttr('iframe[src]', "src");
    rewriteAttr('embed[src]', "src");
    rewriteAttr('video[src]', "src");
    rewriteAttr('audio[src]', "src");
    rewriteAttr('source[src]', "src");
    rewriteAttr('track[src]', "src");
    rewriteAttr('form[action]', "action");
    rewriteAttr('object[data]', "data");

    // Rewrite CSS URLs
    $('style').each(function (_, el) {
        const css = $(el).html();
        const rewritten = css.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, url) => {
            if (url.startsWith('data:') || url.startsWith('#')) return match;
            const absUrl = abs(url);
            if (!absUrl) return match;
            return `url(${PROXY_PATH}?url=${encodeURIComponent(absUrl)})`;
        });
        $(el).html(rewritten);
    });

    // Add comprehensive network request interceptor
    const baseUrl = base.href.replace(/\/$/, ''); // Remove trailing slash
    
    $('head').append(`
        <script>
            // Notify SW of the correct base URL for this page
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ 
                    type: 'setBaseUrl', 
                    url: '` + baseUrl + `'
                });
            }
            
            // Test that script is loaded
            console.log('Proxy interceptor script loaded');
            
            // Store the original base URL
            window.originalBaseUrl = '` + baseUrl + `';
            const originalBaseUrl = window.originalBaseUrl || location.origin;
            console.log('Original base URL:', originalBaseUrl);
            
            // Remove any existing base tag and set our own
            var existingBase = document.querySelector('base');
            if (existingBase) existingBase.remove();
            var baseTag = document.createElement('base');
            baseTag.href = originalBaseUrl + '/';
            document.head.insertBefore(baseTag, document.head.firstChild);
            
            // Helper to check if URL needs proxying
            function needsProxy(url) {
                if (!url || typeof url !== 'string') return false;
                if (url.indexOf('/proxy?url=') !== -1 || url.indexOf('/proxy/') !== -1) return false;
                if (url.indexOf('data:') === 0 || url.indexOf('blob:') === 0 || url.indexOf('javascript:') === 0 || url.indexOf('mailto:') === 0 || url.indexOf('tel:') === 0 || url.indexOf('#') === 0) return false;
                if (url.indexOf('http') === 0) return true;
                return true;
            }
            
            // Helper to convert relative to absolute URL
            function toAbsolute(url) {
                if (url.indexOf('http') === 0) return url;
                if (url.indexOf('//') === 0) return 'https:' + url;
                if (url.indexOf('/') === 0) return originalBaseUrl + url;
                return new URL(url, originalBaseUrl + '/').href;
            }
            
            // Fix existing script tags immediately
            document.querySelectorAll('script[src], link[href], img[src]').forEach(function(el) {
                const attr = el.hasAttribute('src') ? 'src' : 'href';
                const url = el.getAttribute(attr);
                if (url && needsProxy(url)) {
                    const absolute = toAbsolute(url);
                    console.log('Fixing existing element:', attr, url, '->', absolute);
                    el.setAttribute(attr, '` + PROXY_PATH + `?url=' + encodeURIComponent(absolute));
                }
            });
            
            // Intercept all network requests
            const originalFetch = window.fetch;
            const originalXHROpen = XMLHttpRequest.prototype.open;
            
            window.fetch = function(url, options) {
                if (needsProxy(url)) {
                    const absolute = toAbsolute(url);
                    console.log('Intercepting fetch:', url, '->', absolute);
                    url = '` + PROXY_PATH + `?url=' + encodeURIComponent(absolute);
                }
                return originalFetch(url, options);
            };
            
            XMLHttpRequest.prototype.open = function(method, url, ...args) {
                if (needsProxy(url)) {
                    const absolute = toAbsolute(url);
                    console.log('Intercepting XHR:', url, '->', absolute);
                    url = '` + PROXY_PATH + `?url=' + encodeURIComponent(absolute);
                }
                return originalXHROpen.call(this, method, url, ...args);
            };
            
            // Intercept dynamic script creation
            const originalCreateElement = document.createElement;
            document.createElement = function(tagName) {
                const element = originalCreateElement.call(this, tagName);
                if (tagName.toLowerCase() === 'script' || tagName.toLowerCase() === 'img' || tagName.toLowerCase() === 'link') {
                    const originalSetAttribute = element.setAttribute;
                    element.setAttribute = function(name, value) {
                        if ((name === 'src' || name === 'href') && needsProxy(value)) {
                            const absolute = toAbsolute(value);
                            console.log('Intercepting element attribute:', name, value, '->', absolute);
                            value = '` + PROXY_PATH + `?url=' + encodeURIComponent(absolute);
                        }
                        return originalSetAttribute.call(this, name, value);
                    };
                }
                return element;
            };
        </script>
    `);

    return $.html();
}

// Main proxy route
app.get([PROXY_PATH, PROXY_PATH + '/:encodedUrl'], async function (req, res) {
    let target;
    
    if (req.params.encodedUrl) {
        target = decodeUrl(req.params.encodedUrl);
    } else {
        target = req.query.url;
    }
    
    if (!target || typeof target !== "string") {
        return res.status(400).type("text/plain").send("Missing URL");
    }
    
    if (isBlockedTarget(target)) {
        return res.status(403).type("text/plain").send("Target not allowed");
    }

    try {
        const r = await fetch(target, {
            redirect: "follow",
            headers: {
                "User-Agent": req.headers["user-agent"] || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                Referer: target,
            },
        });

        const ct = r.headers.get("content-type") || "";
        const buf = Buffer.from(await r.arrayBuffer());

        // Add CORS headers to allow cross-origin requests
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        // Handle different content types properly
        if (ct.includes("text/html")) {
            const html = buf.toString("utf8");
            const out = rewriteHtml(html, target);
            res.type("html").send(out);
        } else if (ct.includes("application/javascript") || ct.includes("text/javascript")) {
            res.set("Content-Type", "application/javascript").send(buf);
        } else if (ct.includes("text/css")) {
            res.set("Content-Type", "text/css").send(buf);
        } else if (ct.includes("application/json")) {
            res.set("Content-Type", "application/json").send(buf);
        } else if (ct.includes("image/")) {
            res.set("Content-Type", ct).send(buf);
        } else if (ct.includes("font/")) {
            res.set("Content-Type", ct).send(buf);
        } else {
            // For other types, preserve original or set generic binary type
            if (ct) {
                res.set("Content-Type", ct);
            }
            res.send(buf);
        }
    } catch (err) {
        res.status(502).type("text/plain").send("Proxy error: " + err.message);
    }
});

// Handle OPTIONS preflight requests
app.options([PROXY_PATH, PROXY_PATH + '/:encodedUrl'], function (req, res) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(204).send();
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Main route
app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname, "main.html"));
});

app.listen(PORT, function () {
    console.log("=== Proxy Server Started ===");
    console.log("Port:", PORT);
    console.log("Proxy path:", PROXY_PATH);
    console.log("Open: http://localhost:" + PORT);
    console.log("=========================");
});
