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
    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
    let encoded = cipher.update(url, 'utf8', 'hex');
    encoded += cipher.final('hex');
    return encoded;
}

function decodeUrl(encoded) {
    try {
        const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
        let decoded = decipher.update(encoded, 'hex', 'utf8');
        decoded += decipher.final('utf8');
        return decoded;
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
            
            const a = abs(v);
            if (!a || !/^https?:\/\//i.test(a)) return;
            
            $(el).attr(attr, PROXY_PATH + "/" + encodeUrl(a));
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
            return `url(${PROXY_PATH}/${encodeUrl(absUrl)})`;
        });
        $(el).html(rewritten);
    });

    // Add script for dynamic content rewriting
    $('head').append(`
        <script>
            (function() {
                // Rewrite dynamically added content
                const observer = new MutationObserver(function(mutations) {
                    mutations.forEach(function(mutation) {
                        mutation.addedNodes.forEach(function(node) {
                            if (node.nodeType === 1) { // Element node
                                rewriteNode(node);
                            }
                        });
                    });
                });
                
                function rewriteNode(node) {
                    // Rewrite attributes
                    ['href', 'src', 'action', 'data'].forEach(function(attr) {
                        if (node[attr] && node[attr].startsWith('http')) {
                            node[attr] = '${PROXY_PATH}/' + btoa(node[attr]);
                        }
                    });
                    
                    // Rewrite child elements
                    Array.from(node.querySelectorAll('*')).forEach(rewriteNode);
                }
                
                observer.observe(document.body, { childList: true, subtree: true });
                
                // Rewrite existing content
                rewriteNode(document.body);
            })();
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

        if (ct.includes("text/html")) {
            const html = buf.toString("utf8");
            const out = rewriteHtml(html, target);
            res.type("html").send(out);
        } else {
            if (ct) res.set("Content-Type", ct);
            res.send(buf);
        }
    } catch (err) {
        res.status(502).type("text/plain").send("Proxy error: " + err.message);
    }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Main route
app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname, "main.html"));
});

app.listen(PORT, function () {
    console.log("Scramjet-style proxy running on port " + PORT);
});
