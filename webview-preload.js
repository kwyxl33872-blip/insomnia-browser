// Webview preload script - injects CSS to fix iframe height
(function() {
    // Create style element
    const style = document.createElement('style');
    style.textContent = `
        html, body {
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
        }
        
        body > iframe,
        body > div > iframe,
        #root iframe,
        [class*="iframe"] iframe,
        iframe[src*="chatgpt"] {
            height: 100vh !important;
            width: 100% !important;
            border: 0 !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
        }
    `;
    
    // Inject on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            document.head.appendChild(style);
        });
    } else {
        document.head.appendChild(style);
    }
    
    // Also inject immediately
    if (document.head) {
        document.head.appendChild(style);
    }
})();
