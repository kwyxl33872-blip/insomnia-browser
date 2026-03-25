/**
 * Browser UI Controller - Real Browser Implementation
 * Manages tabs, navigation, and webview interactions
 */
const { ipcRenderer } = require('electron');

class BrowserController {
    constructor() {
        this.tabs = new Map();
        this.activeTabId = 1;
        this.nextTabId = 2;
        this.init();
    }

    init() {
        this.setupElements();
        this.setupEventListeners();
        this.createTab(1);
        this.loadStartPage();
    }

    setupElements() {
        // Navigation
        this.backBtn = document.getElementById('back-btn');
        this.forwardBtn = document.getElementById('forward-btn');
        this.refreshBtn = document.getElementById('refresh-btn');
        this.homeBtn = document.getElementById('home-btn');
        
        // Address bar
        this.addressBar = document.getElementById('address-bar');
        this.goBtn = document.getElementById('go-btn');
        
        // Tabs
        this.tabStrip = document.getElementById('tab-strip');
        this.newTabBtn = document.getElementById('new-tab-btn');
        
        // Status
        this.statusText = document.getElementById('status-text');
        this.urlDisplay = document.getElementById('url-display');
    }

    setupEventListeners() {
        // Navigation buttons
        this.backBtn.addEventListener('click', () => this.goBack());
        this.forwardBtn.addEventListener('click', () => this.goForward());
        this.refreshBtn.addEventListener('click', () => this.refresh());
        this.homeBtn.addEventListener('click', () => this.loadStartPage());
        
        // Address bar
        this.addressBar.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.navigate(this.addressBar.value);
            }
        });
        
        this.goBtn.addEventListener('click', () => {
            this.navigate(this.addressBar.value);
        });
        
        // New tab
        this.newTabBtn.addEventListener('click', () => this.createNewTab());
        
        // Tab strip events
        this.tabStrip.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-close')) {
                const tabElement = e.target.closest('.tab');
                const tabId = parseInt(tabElement.dataset.tabId);
                this.closeTab(tabId);
            } else if (e.target.classList.contains('tab') || e.target.parentElement?.classList.contains('tab')) {
                const tabElement = e.target.classList.contains('tab') ? e.target : e.target.parentElement;
                const tabId = parseInt(tabElement.dataset.tabId);
                this.switchToTab(tabId);
            }
        });
    }

    createTab(tabId) {
        const tabData = {
            id: tabId,
            title: 'New Tab',
            url: 'about:blank',
            webview: null,
            tabElement: null,
            contentElement: null
        };

        // Create tab element
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.dataset.tabId = tabId;
        tabElement.innerHTML = `
            <span class="tab-title">New Tab</span>
            <button class="tab-close">×</button>
        `;

        // Create content element
        const contentElement = document.createElement('div');
        contentElement.className = 'tab-content';
        contentElement.dataset.tabId = tabId;
        
        // Create webview
        const webview = document.createElement('webview');
        webview.className = 'webview';
        webview.id = `webview-${tabId}`;
        webview.setAttribute('src', 'about:blank');
        webview.setAttribute('nodeintegration', 'false');
        webview.setAttribute('websecurity', 'false');
        webview.setAttribute('allowpopups', 'true');
        webview.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        contentElement.appendChild(webview);
        
        // Add to DOM
        this.tabStrip.appendChild(tabElement);
        document.querySelector('.content-area').appendChild(contentElement);

        // Setup webview events
        this.setupWebviewEvents(webview, tabData);

        // Store tab data
        tabData.webview = webview;
        tabData.tabElement = tabElement;
        tabData.contentElement = contentElement;
        this.tabs.set(tabId, tabData);

        return tabData;
    }

    setupWebviewEvents(webview, tabData) {
        // Navigation events
        webview.addEventListener('did-start-loading', () => {
            this.updateStatus('Loading...');
            this.updateNavigationButtons(tabData);
        });

        webview.addEventListener('did-stop-loading', () => {
            this.updateStatus('Ready');
            this.updateNavigationButtons(tabData);
            this.updateUrlDisplay(tabData);
        });

        webview.addEventListener('did-fail-load', (event) => {
            this.updateStatus(`Failed: ${event.errorDescription}`);
        });

        webview.addEventListener('page-title-updated', (event) => {
            tabData.title = event.title;
            this.updateTabTitle(tabData);
        });

        webview.addEventListener('did-navigate', (event) => {
            tabData.url = event.url;
            if (tabData.id === this.activeTabId) {
                this.addressBar.value = event.url;
            }
            this.updateUrlDisplay(tabData);
        });

        webview.addEventListener('did-navigate-in-page', (event) => {
            tabData.url = event.url;
            if (tabData.id === this.activeTabId) {
                this.addressBar.value = event.url;
            }
            this.updateUrlDisplay(tabData);
        });

        // New window handling
        webview.addEventListener('new-window', (event) => {
            event.preventDefault();
            this.createNewTab(event.url);
        });

        // Context menu
        webview.addEventListener('context-menu', (event) => {
            event.preventDefault();
            // Could implement custom context menu here
        });
    }

    createNewTab(url = null) {
        const tabId = this.nextTabId++;
        const tabData = this.createTab(tabId);
        
        this.switchToTab(tabId);
        
        if (url) {
            this.navigateInTab(tabData, url);
        } else {
            this.loadStartPageInTab(tabData);
        }
    }

    switchToTab(tabId) {
        // Update active tab
        this.activeTabId = tabId;
        
        // Update tab UI
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', parseInt(tab.dataset.tabId) === tabId);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', parseInt(content.dataset.tabId) === tabId);
        });
        
        // Update address bar
        const tabData = this.tabs.get(tabId);
        if (tabData) {
            this.addressBar.value = tabData.url === 'about:blank' ? '' : tabData.url;
            this.updateNavigationButtons(tabData);
            this.updateUrlDisplay(tabData);
        }
    }

    closeTab(tabId) {
        if (this.tabs.size <= 1) {
            // Don't close the last tab
            return;
        }

        const tabData = this.tabs.get(tabId);
        if (!tabData) return;

        // Remove from DOM
        tabData.tabElement.remove();
        tabData.contentElement.remove();

        // Remove from storage
        this.tabs.delete(tabId);

        // Switch to another tab if this was active
        if (this.activeTabId === tabId) {
            const remainingTabs = Array.from(this.tabs.keys());
            if (remainingTabs.length > 0) {
                this.switchToTab(remainingTabs[0]);
            }
        }
    }

    navigate(url) {
        const tabData = this.tabs.get(this.activeTabId);
        if (tabData) {
            this.navigateInTab(tabData, url);
        }
    }

    navigateInTab(tabData, url) {
        if (!url) return;

        // Process URL
        let processedUrl = url.trim();
        
        if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
            if (processedUrl.includes('.') && !processedUrl.includes(' ')) {
                // Likely a domain
                processedUrl = 'https://' + processedUrl;
            } else {
                // Likely a search query
                processedUrl = `https://www.google.com/search?q=${encodeURIComponent(processedUrl)}`;
            }
        }

        tabData.webview.src = processedUrl;
    }

    loadStartPage() {
        const tabData = this.tabs.get(this.activeTabId);
        if (tabData) {
            this.loadStartPageInTab(tabData);
        }
    }

    loadStartPageInTab(tabData) {
        const startPage = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>New Tab</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    color: white;
                }
                .logo {
                    font-size: 48px;
                    font-weight: 700;
                    margin-bottom: 20px;
                    text-shadow: 0 2px 10px rgba(0,0,0,0.2);
                }
                .search-container {
                    width: 600px;
                    max-width: 90%;
                }
                .search-box {
                    width: 100%;
                    padding: 16px 24px;
                    font-size: 16px;
                    border: none;
                    border-radius: 50px;
                    background: rgba(255,255,255,0.9);
                    color: #333;
                    outline: none;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    transition: all 0.3s ease;
                }
                .search-box:focus {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 30px rgba(0,0,0,0.2);
                }
                .shortcuts {
                    margin-top: 40px;
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 20px;
                    width: 600px;
                    max-width: 90%;
                }
                .shortcut {
                    text-align: center;
                    padding: 20px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-decoration: none;
                    color: white;
                }
                .shortcut:hover {
                    background: rgba(255,255,255,0.2);
                    transform: translateY(-2px);
                }
                .shortcut-icon {
                    font-size: 24px;
                    margin-bottom: 8px;
                }
                .shortcut-name {
                    font-size: 14px;
                    font-weight: 500;
                }
            </style>
        </head>
        <body>
            <div class="logo">Browser</div>
            <div class="search-container">
                <input type="text" class="search-box" placeholder="Search or enter URL..." autofocus>
            </div>
            <div class="shortcuts">
                <a href="https://chatgpt.com" class="shortcut">
                    <div class="shortcut-icon">💬</div>
                    <div class="shortcut-name">ChatGPT</div>
                </a>
                <a href="https://google.com" class="shortcut">
                    <div class="shortcut-icon">🔍</div>
                    <div class="shortcut-name">Google</div>
                </a>
                <a href="https://github.com" class="shortcut">
                    <div class="shortcut-icon">📦</div>
                    <div class="shortcut-name">GitHub</div>
                </a>
                <a href="https://youtube.com" class="shortcut">
                    <div class="shortcut-icon">📺</div>
                    <div class="shortcut-name">YouTube</div>
                </a>
            </div>
            <script>
                document.querySelector('.search-box').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        const query = e.target.value.trim();
                        if (query) {
                            let url = query;
                            if (!query.startsWith('http://') && !query.startsWith('https://')) {
                                if (query.includes('.') && !query.includes(' ')) {
                                    url = 'https://' + query;
                                } else {
                                    url = 'https://www.google.com/search?q=' + encodeURIComponent(query);
                                }
                            }
                            window.location.href = url;
                        }
                    }
                });
                document.querySelectorAll('.shortcut').forEach(shortcut => {
                    shortcut.addEventListener('click', (e) => {
                        e.preventDefault();
                        window.location.href = shortcut.href;
                    });
                });
            </script>
        </body>
        </html>`;
        
        tabData.webview.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(startPage);
    }

    goBack() {
        const tabData = this.tabs.get(this.activeTabId);
        if (tabData && tabData.webview.canGoBack()) {
            tabData.webview.goBack();
        }
    }

    goForward() {
        const tabData = this.tabs.get(this.activeTabId);
        if (tabData && tabData.webview.canGoForward()) {
            tabData.webview.goForward();
        }
    }

    refresh() {
        const tabData = this.tabs.get(this.activeTabId);
        if (tabData) {
            tabData.webview.reload();
        }
    }

    updateTabTitle(tabData) {
        const titleElement = tabData.tabElement.querySelector('.tab-title');
        if (titleElement) {
            titleElement.textContent = tabData.title || 'New Tab';
        }
    }

    updateNavigationButtons(tabData) {
        this.backBtn.disabled = !tabData.webview.canGoBack();
        this.forwardBtn.disabled = !tabData.webview.canGoForward();
    }

    updateStatus(status) {
        this.statusText.textContent = status;
    }

    updateUrlDisplay(tabData) {
        this.urlDisplay.textContent = tabData.url || '';
    }
}

// Initialize browser when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new BrowserController();
});
