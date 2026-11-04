const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

let currentTargetHost = 'https://www.google.com';

// 1. Password Protection
app.use(basicAuth({
    users: { 'admin': 'MySecretPassword123' },
    challenge: true
}));

// 2. Main Portal Shell with Navigation & Interceptor Script
app.get('/', (req, res) => {
    let targetUrl = req.query.url || currentTargetHost;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }
    try {
        currentTargetHost = new URL(targetUrl).origin;
    } catch (e) {}

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>My Portal</title>
            <style>
                * { box-sizing: border-box; }
                body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; font-family: system-ui, sans-serif; background: #111; }
                #nav { height: 44px; background: #1a1a1a; display: flex; align-items: center; padding: 0 12px; gap: 8px; border-bottom: 1px solid #333; }
                #urlInput { flex: 1; padding: 7px 12px; background: #2a2a2a; color: #fff; border: 1px solid #444; border-radius: 6px; font-size: 14px; outline: none; }
                #urlInput:focus { border-color: #007bff; }
                button { padding: 7px 16px; background: #007bff; color: white; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; font-size: 14px; }
                button:hover { background: #0056b3; }
                iframe { width: 100%; height: calc(100% - 44px); border: none; background: #fff; }
            </style>
        </head>
        <body>
            <div id="nav">
                <input type="text" id="urlInput" value="${targetUrl}" placeholder="Enter website address..." />
                <button onclick="navigate()">Go</button>
            </div>
            <iframe id="siteFrame" src="/fetch?url=${encodeURIComponent(targetUrl)}"></iframe>
            <script>
                function navigate() {
                    let input = document.getElementById('urlInput').value.trim();
                    if (!input) return;
                    if (!input.startsWith('http://') && !input.startsWith('https://')) {
                        input = 'https://' + input;
                    }
                    document.getElementById('urlInput').value = input;
                    document.getElementById('siteFrame').src = '/fetch?url=' + encodeURIComponent(input);
                }

                document.getElementById('urlInput').addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') navigate();
                });

                // Sync top bar address when iframe navigates internally
                const iframe = document.getElementById('siteFrame');
                iframe.addEventListener('load', function() {
                    try {
                        // Attempt to update input box if same-origin / proxied
                        let iframeWindow = iframe.contentWindow;
                        // If cross-origin restrictions block inner URL reading, we fallback gracefully
                    } catch (e) {}
                });
            </script>
        </body>
        </html>
    `);
});

// 3. Dedicated Proxy Route for Main Navigation & Full URLs
app.use('/fetch', (req, res, next) => {
    let targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('No target URL provided');

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }

    try {
        const parsed = new URL(targetUrl);
        currentTargetHost = parsed.origin;
        
        const proxy = createProxyMiddleware({
            target: parsed.origin,
            changeOrigin: true,
            secure: false,
            pathRewrite: () => parsed.pathname + parsed.search,
            onProxyRes: (proxyRes) => {
                delete proxyRes.headers['x-frame-options'];
                delete proxyRes.headers['content-security-policy'];
            },
            onError: (err, req, res) => {
                res.status(502).send('Proxy connection failed.');
            }
        });
        return proxy(req, res, next);
    } catch (e) {
        return res.status(400).send('Invalid URL format');
    }
});

// 4. Fallback Proxy for Assets and Relative Sub-Paths
app.use((req, res, next) => {
    // If someone tries to search directly via a relative path query, redirect them cleanly to Google search through /fetch
    if (req.url.startsWith('/search') || req.url.startsWith('/s?')) {
        let fullSearchUrl = currentTargetHost + req.originalUrl;
        return res.redirect('/fetch?url=' + encodeURIComponent(fullSearchUrl));
    }

    createProxyMiddleware({
        target: currentTargetHost,
        changeOrigin: true,
        secure: false,
        onProxyRes: (proxyRes) => {
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
        },
        onError: (err, req, res) => {
            res.status(404).send('Resource not found.');
        }
    })(req, res, next);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server successfully running on port ${PORT}`);
});
