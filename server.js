const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Track active target host session
let currentTargetHost = 'https://www.google.com';

// 1. Password Protection
app.use(basicAuth({
    users: { 'admin': 'MySecretPassword123' },
    challenge: true
}));

// 2. Main Portal Shell (Single Top Bar + iframe)
app.get('/', (req, res) => {
    let targetUrl = req.query.url || currentTargetHost;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
    }
    currentTargetHost = new URL(targetUrl).origin;

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>My App</title>
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
                <input type="text" id="urlInput" value="${targetUrl}" placeholder="Enter website address (e.g. amazon.com)..." />
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
                    document.getElementById('siteFrame').src = '/fetch?url=' + encodeURIComponent(input);
                }
                document.getElementById('urlInput').addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') navigate();
                });
            </script>
        </body>
        </html>
    `);
});

// 3. Dynamic Proxy Route
app.use('/fetch', (req, res, next) => {
    let target = req.query.url;
    
    if (target) {
        if (!target.startsWith('http://') && !target.startsWith('https://')) {
            target = 'https://' + target;
        }
        try {
            currentTargetHost = new URL(target).origin;
        } catch (e) {}
    } else {
        target = currentTargetHost;
    }

    createProxyMiddleware({
        target: target,
        changeOrigin: true,
        router: (req) => {
            if (req.query && req.query.url) {
                let u = req.query.url;
                if (!u.startsWith('http')) u = 'https://' + u;
                return new URL(u).origin;
            }
            return currentTargetHost;
        },
        pathRewrite: (path, req) => {
            if (req.query && req.query.url) {
                try {
                    let parsed = new URL(req.query.url.startsWith('http') ? req.query.url : 'https://' + req.query.url);
                    return parsed.pathname + parsed.search;
                } catch(e) {
                    return '';
                }
            }
            return path.replace(/^\/fetch/, '');
        },
        onProxyRes: (proxyRes) => {
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['frame-ancestors'];
        },
        onError: (err, req, res) => {
            res.status(500).send('Proxy error encountered. Try refreshing or re-entering the address.');
        }
    })(req, res, next);
});

// 4. Catch-All Route for Relative Site Assets/Sub-paths
app.use('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/fetch')) return next();
    
    createProxyMiddleware({
        target: currentTargetHost,
        changeOrigin: true,
        onProxyRes: (proxyRes) => {
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
        }
    })(req, res, next);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
