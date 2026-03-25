/**
 * Local dev proxy: fetches http(s) URLs server-side and rewrites links to /proxy?url=...
 */
"use strict";

const express = require("express");
const path = require("path");
const cheerio = require("cheerio");

const PORT = process.env.PORT || 3000;
const PROXY_PATH = "/proxy";

const app = express();

function toProxyUrl(u) {
    return PROXY_PATH + "?url=" + encodeURIComponent(u);
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
            if (!v) {
                return;
            }
            if (attr === "href" && (v.startsWith("#") || v.startsWith("javascript:") || v.startsWith("mailto:") || v.startsWith("tel:"))) {
                return;
            }
            const a = abs(v);
            if (!a || !/^https?:\/\//i.test(a)) {
                return;
            }
            $(el).attr(attr, toProxyUrl(a));
        });
    }

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

    return $.html();
}

app.get(PROXY_PATH, async function (req, res) {
    const target = req.query.url;
    if (!target || typeof target !== "string") {
        return res.status(400).type("text/plain").send("Missing url query");
    }
    var decoded;
    try {
        decoded = decodeURIComponent(target);
    } catch (e) {
        return res.status(400).type("text/plain").send("Bad url encoding");
    }
    if (isBlockedTarget(decoded)) {
        return res.status(403).type("text/plain").send("Target not allowed");
    }

    try {
        const r = await fetch(decoded, {
            redirect: "follow",
            headers: {
                "User-Agent":
                    req.headers["user-agent"] ||
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        });

        const ct = r.headers.get("content-type") || "";
        const buf = Buffer.from(await r.arrayBuffer());

        if (ct.includes("text/html")) {
            const html = buf.toString("utf8");
            const out = rewriteHtml(html, decoded);
            res.type("html").send(out);
        } else {
            if (ct) {
                res.set("Content-Type", ct);
            }
            res.send(buf);
        }
    } catch (err) {
        res.status(502).type("text/plain").send("Proxy error: " + (err && err.message ? err.message : String(err)));
    }
});

app.get("/", function (req, res) {
    res.sendFile(path.join(__dirname, "main.html"));
});

// Serve service worker
app.get("/sw.js", function (req, res) {
    res.sendFile(path.join(__dirname, "sw.js"));
});

app.use(express.static(path.join(__dirname)));

app.listen(PORT, function () {
    console.log("Server running on port " + PORT);
});
