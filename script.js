(function () {
    const tabs = document.querySelectorAll(".tab");
    const panels = document.querySelectorAll(".panel");

    function showPanel(id) {
        panels.forEach(function (panel) {
            const match = panel.id === "panel-" + id;
            if (match) {
                panel.hidden = false;
                requestAnimationFrame(function () {
                    panel.classList.add("is-visible");
                });
            } else {
                panel.classList.remove("is-visible");
                panel.hidden = true;
            }
        });

        tabs.forEach(function (tab) {
            const active = tab.dataset.panel === id;
            tab.classList.toggle("is-active", active);
            tab.setAttribute("aria-selected", active ? "true" : "false");
        });
    }

    tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            showPanel(tab.dataset.panel);
        });
    });
})();

(function () {
    /** One named window — real browser chrome, not an iframe. Same name reuses the window. */
    var EXTERNAL_WINDOW_NAME = "studio-external-browser";
    var WINDOW_FEATURES =
        "width=1280,height=800,left=80,top=48,scrollbars=yes,resizable=yes,status=yes,toolbar=yes,location=yes,menubar=yes";

    var engines = {
        google: function (q) {
            return "https://www.google.com/search?q=" + encodeURIComponent(q);
        },
        duckduckgo: function (q) {
            return "https://duckduckgo.com/?q=" + encodeURIComponent(q);
        },
        brave: function (q) {
            return "https://search.brave.com/search?q=" + encodeURIComponent(q);
        },
        bing: function (q) {
            return "https://www.bing.com/search?q=" + encodeURIComponent(q);
        },
        ecosia: function (q) {
            return "https://www.ecosia.org/search?q=" + encodeURIComponent(q);
        },
        startpage: function (q) {
            return "https://www.startpage.com/sp/search?query=" + encodeURIComponent(q);
        },
        yahoo: function (q) {
            return "https://search.yahoo.com/search?p=" + encodeURIComponent(q);
        },
    };

    var form = document.getElementById("nav-form");
    var omnibar = document.getElementById("omnibar");
    var select = document.getElementById("engine-select");
    var tabstrip = document.getElementById("browser-tabstrip");
    var btnNewTab = document.getElementById("browser-tab-new");
    var browserWindow = document.getElementById("browser-window");
    var trafficClose = document.getElementById("traffic-close");
    var trafficExitFs = document.getElementById("traffic-exit-fs");
    var trafficFs = document.getElementById("traffic-fullscreen");
    var navBack = document.getElementById("nav-back");
    var navForward = document.getElementById("nav-forward");
    var navRefresh = document.getElementById("nav-refresh");
    var idleEl = document.getElementById("browser-external-idle");
    var activeEl = document.getElementById("browser-external-active");
    var statusUrl = document.getElementById("browser-status-url");
    var popupBlockedEl = document.getElementById("browser-popup-blocked");
    var viewport = document.getElementById("browser-viewport");
    var externalPanel = document.getElementById("browser-external-panel");

    var isElectron =
        (typeof window !== "undefined" &&
            window.electronShell &&
            window.electronShell.isElectron) ||
        (typeof navigator !== "undefined" && /Electron\//i.test(navigator.userAgent));

    var webviewEl = null;
    if (isElectron && viewport) {
        // Use webview for better site compatibility
        webviewEl = document.createElement("webview");
        webviewEl.className = "browser__webview";
        webviewEl.setAttribute("allowpopups", "");
        webviewEl.setAttribute("nodeintegration", "false");
        webviewEl.setAttribute("webSecurity", "false");
        webviewEl.setAttribute("allowRunningInsecureContent", "true");
        webviewEl.setAttribute("partition", "persist:browser-session");
        webviewEl.setAttribute("useragent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        webviewEl.setAttribute("src", "about:blank");
        webviewEl.style.border = "0";
        webviewEl.style.width = "100%";
        viewport.appendChild(webviewEl);
        
        // Add proper event listeners for browser functionality
        webviewEl.addEventListener('new-window', (e) => {
            e.preventDefault();
            webviewEl.src = e.url;
        });
        
        webviewEl.addEventListener('did-navigate', (e) => {
            if (omnibar && e.url !== 'about:blank') {
                omnibar.value = e.url;
            }
        });
        
        webviewEl.addEventListener('page-title-updated', (e) => {
            // Update tab title when page title changes
            const t = browserTabs[activeTabIndex];
            if (t) {
                t.title = e.title;
                renderBrowserTabs();
            }
        });
        
        // Add debugging for load issues
        webviewEl.addEventListener('did-fail-load', (e) => {
            console.error('Webview failed to load:', e);
        });
        
        // Inject CSS to fix iframe height in webview
        const fixWebviewHeight = () => {
            // Check if in fullscreen
            const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
            const height = isFullscreen ? '100vh' : '550px';
            
            // Try to access shadow DOM from main context
            try {
                const shadow = webviewEl.shadowRoot || webviewEl.openOrClosedShadowRoot;
                if (shadow) {
                    const iframe = shadow.querySelector('iframe');
                    if (iframe) {
                        iframe.style.height = height;
                        iframe.style.minHeight = height;
                        console.log('Fixed iframe height via shadow DOM:', height);
                    }
                }
            } catch (e) {
                console.log('Shadow DOM access failed:', e);
            }
            
            // Also try executeJavaScript as backup
            webviewEl.executeJavaScript(`
                (function() {
                    const isFullscreen = window.innerHeight === screen.height;
                    const height = isFullscreen ? '100vh' : '550px';
                    const style = document.createElement('style');
                    style.textContent = 'html, body, iframe { height: ' + height + ' !important; min-height: ' + height + ' !important; }';
                    document.head.appendChild(style);
                })();
            `).catch(err => {});
        };
        
        webviewEl.addEventListener('dom-ready', fixWebviewHeight);
        webviewEl.addEventListener('did-finish-load', fixWebviewHeight);
        
        // Run immediately and periodically
        setTimeout(fixWebviewHeight, 100);
        setTimeout(fixWebviewHeight, 500);
        setTimeout(fixWebviewHeight, 1000);
        
        // Fix height on fullscreen change
        document.addEventListener('fullscreenchange', () => {
            console.log('Fullscreen changed, fixing height');
            setTimeout(fixWebviewHeight, 100);
            setTimeout(fixWebviewHeight, 300);
        });
        document.addEventListener('webkitfullscreenchange', () => {
            console.log('Webkit fullscreen changed, fixing height');
            setTimeout(fixWebviewHeight, 100);
            setTimeout(fixWebviewHeight, 300);
        });
        
        if (viewport) {
            const observer = new MutationObserver((mutations) => {
                console.log('Viewport changed:', {
                    width: viewport.offsetWidth,
                    height: viewport.offsetHeight,
                    classes: viewport.className
                });
                
                // Debug when embed class is added/removed
                if (viewport.classList.contains('browser-viewport--embed')) {
                    console.log('EMBED MODE ACTIVE - Checking webview:');
                    if (webviewEl) {
                        console.log('Webview in embed mode:', {
                            width: webviewEl.offsetWidth,
                            height: webviewEl.offsetHeight,
                            display: window.getComputedStyle(webviewEl).display,
                            visibility: window.getComputedStyle(webviewEl).visibility,
                            opacity: window.getComputedStyle(webviewEl).opacity
                        });
                    }
                }
                
                // Also log the browser container
                const browserContainer = viewport.closest('.browser');
                if (browserContainer) {
                    console.log('Browser container:', {
                        width: browserContainer.offsetWidth,
                        height: browserContainer.offsetHeight,
                        classes: browserContainer.className
                    });
                }
                
                // Log parent container
                const content = viewport.parentElement;
                if (content) {
                    console.log('Content parent:', {
                        width: content.offsetWidth,
                        height: content.offsetHeight,
                        classes: content.className
                    });
                }
            });
            observer.observe(viewport, { 
                attributes: true, 
                attributeFilter: ['class', 'style'] 
            });
        }
    }

    var useProxy =
        typeof location !== "undefined" &&
        location.protocol === "http:" &&
        /^(127\.0\.0\.1|localhost)$/i.test(location.hostname || "");
    var proxyFrame = null;

    function rewriteUrlForShell(url) {
        if (!useProxy || !url || /^about:/i.test(url)) {
            return url;
        }
        return location.origin + "/proxy?url=" + encodeURIComponent(url);
    }

    if (useProxy && viewport && !isElectron) {
        proxyFrame = document.createElement("iframe");
        proxyFrame.className = "browser__proxy-frame";
        proxyFrame.setAttribute("title", "Proxied page");
        proxyFrame.style.display = "none";
        proxyFrame.src = "about:blank";
        viewport.appendChild(proxyFrame);
    }

    if (!form || !omnibar || !tabstrip || !browserWindow) {
        return;
    }

    function newTabState(id) {
        return {
            id: id || "t" + Date.now(),
            title: "New Tab",
            backStack: [],
            forwardStack: [],
            currentUrl: null,
            addressBar: "",
            engine: "duckduckgo",
        };
    }

    var browserTabs = [newTabState("t0")];
    var activeTabIndex = 0;

    function truncateTitle(s, max) {
        max = max || 26;
        if (s.length <= max) {
            return s;
        }
        return s.slice(0, max - 1) + "\u2026";
    }

    function isProbablyUrl(s) {
        s = s.trim();
        if (!s) {
            return false;
        }
        if (/^https?:\/\//i.test(s)) {
            return true;
        }
        if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(s)) {
            return true;
        }
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
            return true;
        }
        if (!/\s/.test(s) && /\.[a-z]{2,}($|[\/:?#])/i.test(s)) {
            return true;
        }
        return false;
    }

    function normalizeUrl(s) {
        s = s.trim();
        if (!s) {
            return null;
        }
        if (/^https?:\/\//i.test(s)) {
            return s;
        }
        if (isProbablyUrl(s)) {
            if (/^localhost/i.test(s) || /^127\.0\.0\.1/.test(s)) {
                return "http://" + s;
            }
            return "https://" + s;
        }
        return null;
    }

    function searchUrlForQuery(q, engineKey) {
        var build = engines[engineKey] || engines.duckduckgo;
        return build(q);
    }

    function titleFromUrl(url) {
        try {
            var u = new URL(url);
            var host = u.hostname.replace(/^www\./i, "") || "Page";
            if (u.pathname === "/" || u.pathname === "") {
                return truncateTitle(host);
            }
            return truncateTitle(host + u.pathname);
        } catch (e) {
            return "Page";
        }
    }

    function titleForNavigation(url) {
        try {
            var u = new URL(url);
            var host = u.hostname.toLowerCase();
            if (host.indexOf("google.") !== -1 && u.pathname.indexOf("/search") === 0) {
                var q = u.searchParams.get("q");
                if (q) {
                    return truncateTitle(q);
                }
            }
            if (host.indexOf("duckduckgo.") !== -1 || host.indexOf("bing.") !== -1 || host.indexOf("brave.") !== -1) {
                var qq = u.searchParams.get("q");
                if (qq) {
                    return truncateTitle(qq);
                }
            }
        } catch (e2) {
            /* ignore */
        }
        return titleFromUrl(url);
    }

    function updateExternalPanel() {
        var t = browserTabs[activeTabIndex];
        var has = !!(t && t.currentUrl);
        if (isElectron && webviewEl && viewport) {
            viewport.classList.toggle("browser-viewport--embed", has);
            webviewEl.style.display = has ? "block" : "none";
            if (externalPanel) {
                externalPanel.hidden = has;
            }
            if (!has) {
                if (idleEl) {
                    idleEl.hidden = false;
                }
                if (activeEl) {
                    activeEl.hidden = true;
                }
            } else {
                if (idleEl) {
                    idleEl.hidden = true;
                }
                if (activeEl) {
                    activeEl.hidden = false;
                }
            }
            
            // Add class to the panel for CSS targeting
            var panel = viewport.closest('.panel');
            if (panel) {
                panel.classList.toggle("browser-embed-panel", has);
            }
        }
        if (useProxy && proxyFrame && viewport) {
            viewport.classList.toggle("browser-viewport--embed", has);
            proxyFrame.style.display = has ? "block" : "none";
            if (externalPanel) {
                externalPanel.hidden = has;
            }
            if (!has) {
                if (idleEl) {
                    idleEl.hidden = false;
                }
                if (activeEl) {
                    activeEl.hidden = true;
                }
            } else {
                if (idleEl) {
                    idleEl.hidden = true;
                }
                if (activeEl) {
                    activeEl.hidden = false;
                }
            }
            
            // Add class to the panel for CSS targeting
            var panel = viewport.closest('.panel');
            if (panel) {
                panel.classList.toggle("browser-embed-panel", has);
            }
        }
        if (has && t && statusUrl) {
            statusUrl.href = t.currentUrl;
            statusUrl.textContent = t.currentUrl;
        }
    }

    function openExternal(url) {
        var shellUrl = rewriteUrlForShell(url);
        
        if (isElectron && webviewEl) {
            webviewEl.src = shellUrl;
            if (popupBlockedEl) {
                popupBlockedEl.hidden = true;
            }
            if (statusUrl) {
                statusUrl.href = url;
                statusUrl.textContent = url;
            }
            return true;
        }
        if (useProxy && proxyFrame) {
            proxyFrame.src = shellUrl;
            if (popupBlockedEl) {
                popupBlockedEl.hidden = true;
            }
            if (statusUrl) {
                statusUrl.href = url;
                statusUrl.textContent = url;
            }
            return true;
        }
        var w = window.open(url, EXTERNAL_WINDOW_NAME, WINDOW_FEATURES);
        if (!w) {
            if (popupBlockedEl) {
                popupBlockedEl.hidden = false;
            }
            if (statusUrl) {
                statusUrl.href = url;
                statusUrl.textContent = url;
            }
        } else {
            if (popupBlockedEl) {
                popupBlockedEl.hidden = true;
            }
            if (statusUrl) {
                statusUrl.href = url;
                statusUrl.textContent = url;
            }
        }
        return w;
    }

    function updateNavButtons() {
        var t = browserTabs[activeTabIndex];
        if (!t) {
            return;
        }
        if (navBack) {
            navBack.disabled = t.backStack.length === 0;
        }
        if (navForward) {
            navForward.disabled = t.forwardStack.length === 0;
        }
        if (navRefresh) {
            navRefresh.disabled = !t.currentUrl;
        }
    }

    function navigateTo(url) {
        var t = browserTabs[activeTabIndex];
        if (!t || !url) {
            return;
        }
        if (t.currentUrl) {
            t.backStack.push(t.currentUrl);
        }
        t.forwardStack = [];
        t.currentUrl = url;
        t.addressBar = url;
        t.title = titleForNavigation(url);
        omnibar.value = url;
        openExternal(url);
        updateExternalPanel();
        updateNavButtons();
        renderBrowserTabs();
    }

    async function goBack() {
        if (isElectron && webviewEl) {
            try {
                const canGo = await webviewEl.canGoBack();
                if (canGo) {
                    webviewEl.goBack();
                    return;
                }
            } catch (e) {
                console.log('goBack error:', e);
            }
        }
        // Fallback to tab-based navigation
        var t = browserTabs[activeTabIndex];
        if (!t || t.backStack.length === 0) {
            return;
        }
        if (t.currentUrl) {
            t.forwardStack.push(t.currentUrl);
        }
        t.currentUrl = t.backStack.pop();
        t.addressBar = t.currentUrl || "";
        t.title = t.currentUrl ? titleForNavigation(t.currentUrl) : "New Tab";
        omnibar.value = t.addressBar;
        if (t.currentUrl) {
            openExternal(t.currentUrl);
        } else {
            openExternal("about:blank");
        }
        updateExternalPanel();
        updateNavButtons();
        renderBrowserTabs();
    }

    async function goForward() {
        if (isElectron && webviewEl) {
            try {
                const canGo = await webviewEl.canGoForward();
                if (canGo) {
                    webviewEl.goForward();
                    return;
                }
            } catch (e) {
                console.log('goForward error:', e);
            }
        }
        // Fallback to tab-based navigation
        var t = browserTabs[activeTabIndex];
        if (!t || t.forwardStack.length === 0) {
            return;
        }
        if (t.currentUrl) {
            t.backStack.push(t.currentUrl);
        }
        t.currentUrl = t.forwardStack.pop();
        t.addressBar = t.currentUrl || "";
        t.title = t.currentUrl ? titleForNavigation(t.currentUrl) : "New Tab";
        omnibar.value = t.addressBar;
        if (t.currentUrl) {
            openExternal(t.currentUrl);
        } else {
            openExternal("about:blank");
        }
        updateExternalPanel();
        updateNavButtons();
        renderBrowserTabs();
    }

    function reloadExternal() {
        var t = browserTabs[activeTabIndex];
        if (!t || !t.currentUrl) {
            return;
        }
        if (isElectron && webviewEl && typeof webviewEl.reload === "function") {
            webviewEl.reload();
            return;
        }
        if (useProxy && proxyFrame) {
            try {
                if (proxyFrame.contentWindow && proxyFrame.contentWindow.location) {
                    proxyFrame.contentWindow.location.reload();
                } else {
                    openExternal(t.currentUrl);
                }
            } catch (e) {
                openExternal(t.currentUrl);
            }
            return;
        }
        openExternal(t.currentUrl);
    }

    function saveActiveTab() {
        var t = browserTabs[activeTabIndex];
        if (!t) {
            return;
        }
        t.addressBar = omnibar.value;
        t.engine = select ? select.value : "duckduckgo";
    }

    function loadActiveTabIntoUI(syncExternal) {
        var t = browserTabs[activeTabIndex];
        if (!t) {
            return;
        }
        omnibar.value = t.addressBar != null ? t.addressBar : "";
        if (select) {
            select.value = t.engine || "duckduckgo";
        }
        updateExternalPanel();
        updateNavButtons();
        if (syncExternal) {
            if (t.currentUrl) {
                openExternal(t.currentUrl);
            } else {
                openExternal("about:blank");
            }
        }
    }

    function renderBrowserTabs() {
        tabstrip.innerHTML = "";
        browserTabs.forEach(function (tab, index) {
            var item = document.createElement("div");
            item.className = "browser-tab-item";
            if (index === activeTabIndex) {
                item.classList.add("is-active");
            }
            item.dataset.tabId = tab.id;

            var label = document.createElement("button");
            label.type = "button";
            label.className = "browser-tab";
            if (index === activeTabIndex) {
                label.classList.add("is-active");
            }
            label.setAttribute("role", "tab");
            label.setAttribute("aria-selected", index === activeTabIndex ? "true" : "false");
            label.id = "browser-tab-" + tab.id;
            label.setAttribute("title", tab.title);
            label.textContent = tab.title;

            label.addEventListener("click", function () {
                if (index === activeTabIndex) {
                    return;
                }
                saveActiveTab();
                activeTabIndex = index;
                loadActiveTabIntoUI(true);
                renderBrowserTabs();
            });

            var closeBtn = document.createElement("button");
            closeBtn.type = "button";
            closeBtn.className = "browser-tab__close";
            closeBtn.setAttribute("aria-label", "Close tab");
            closeBtn.innerHTML = "&times;";
            closeBtn.addEventListener("click", function (e) {
                e.stopPropagation();
                closeTab(index);
            });

            item.appendChild(label);
            item.appendChild(closeBtn);
            tabstrip.appendChild(item);
        });
    }

    function closeTab(index) {
        if (browserTabs.length <= 1) {
            browserTabs[0] = newTabState();
            activeTabIndex = 0;
        } else {
            browserTabs.splice(index, 1);
            if (activeTabIndex >= index) {
                activeTabIndex = Math.max(0, activeTabIndex - 1);
            }
        }
        loadActiveTabIntoUI(true);
        renderBrowserTabs();
    }

    function openNewTab() {
        saveActiveTab();
        var nt = newTabState();
        browserTabs.push(nt);
        activeTabIndex = browserTabs.length - 1;
        loadActiveTabIntoUI(true);
        renderBrowserTabs();
        omnibar.focus();
    }

    function clearAllTabs() {
        browserTabs = [newTabState("t0")];
        activeTabIndex = 0;
        loadActiveTabIntoUI(true);
        renderBrowserTabs();
        omnibar.focus();
    }

    function enterFullscreen() {
        var el = browserWindow;
        if (!el) {
            return;
        }
        var req =
            el.requestFullscreen ||
            el.webkitRequestFullscreen ||
            el.webkitRequestFullScreen ||
            el.msRequestFullscreen;
        if (req) {
            req.call(el);
        }
    }

    function exitFullscreen() {
        var doc = document;
        var exit =
            doc.exitFullscreen ||
            doc.webkitExitFullscreen ||
            doc.webkitCancelFullScreen ||
            doc.msExitFullscreen;
        if (exit) {
            exit.call(doc);
        }
    }

    function submitNavigation() {
        var raw = omnibar.value.trim();
        if (!raw) {
            omnibar.focus();
            return;
        }
        saveActiveTab();
        var url = normalizeUrl(raw);
        if (url) {
            navigateTo(url);
            return;
        }
        var q = raw;
        var engineKey = searchEngineSelect ? searchEngineSelect.value : "duckduckgo";
        var built = searchUrlForQuery(q, engineKey);
        navigateTo(built);
    }

    if (btnNewTab) {
        btnNewTab.addEventListener("click", function () {
            openNewTab();
        });
    }
    if (trafficFs) {
        trafficFs.addEventListener("click", enterFullscreen);
    }
    if (trafficExitFs) {
        trafficExitFs.addEventListener("click", exitFullscreen);
    }
    if (trafficClose) {
        trafficClose.addEventListener("click", clearAllTabs);
    }
    
    // DevTools toggle button
    var devtoolsBtn = document.getElementById("devtools-btn");
    if (devtoolsBtn && window.electronShell && window.electronShell.toggleDevTools) {
        devtoolsBtn.addEventListener("click", function() {
            window.electronShell.toggleDevTools();
        });
    }
    
    // Search box functionality
    var searchBox = document.getElementById("search-box");
    var searchBtn = document.getElementById("search-btn");
    var searchEngineSelect = document.getElementById("search-engine-select");
    
    function performSearch() {
        if (!searchBox || !searchEngineSelect) return;
        var query = searchBox.value.trim();
        if (!query) return;
        var engine = searchEngineSelect.value;
        var url = searchUrlForQuery(query, engine);
        navigateTo(url);
    }
    
    if (searchBtn) {
        searchBtn.addEventListener("click", performSearch);
    }
    
    if (searchBox) {
        searchBox.addEventListener("keypress", function(e) {
            if (e.key === "Enter") {
                performSearch();
            }
        });
    }
    
    if (navBack) {
        navBack.addEventListener("click", goBack);
    }
    if (navForward) {
        navForward.addEventListener("click", goForward);
    }
    if (navRefresh) {
        navRefresh.addEventListener("click", reloadExternal);
    }

    omnibar.addEventListener("input", saveActiveTab);
    if (select) {
        select.addEventListener("change", saveActiveTab);
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        submitNavigation();
    });

    renderBrowserTabs();
    loadActiveTabIntoUI(false);
})();
