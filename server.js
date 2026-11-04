const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

let currentTargetHost = 'https://www.amazon.com';

app.use(basicAuth({
    users: { 'admin': 'MySecretPassword123' },
    challenge: true
}));

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
            <title>Secure Proxy Portal</title>
            <style>
                * { box-sizing: border-box; }
                body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; }
                #nav { height: 52px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); display: flex; align-items: center; padding: 0 16px; gap: 10px; border-bottom: 1px solid #334155; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); }
                #urlInput { flex: 1; padding: 8px 14px; background: #1e293b; color: #f8fafc; border: 1px solid #475569; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s; }
                #urlInput:focus { border-color: #38bdf8; box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2); }
                button { padding: 8px 18px; background: #0284c7; color: white; border: none; border-radius: 8px; font-weight: 500; cursor: pointer; font-size: 14px; transition: background 0.2s; }
                button:hover { background: #0369a1; }
                .frame-container { width: 100%; height: calc(100% - 52px); background: #ffffff; position: relative; }
                iframe { width: 100%; height: 100%; border: none; background: #fff; }
            </style>
        </head>
        <body>
            <div id="nav">
                <input type="text" id="urlInput" value="${targetUrl}" placeholder="Enter website address (e.g. https://amazon.com)..." />
                <button onclick="navigate()">Browse</button>
            </div>
            <div class="frame-container">
                <iframe id="siteFrame" src="/fetch?url=${encodeURIComponent(targetUrl)}"></iframe>
            </div>
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
            </script>
        </body>
        </html>
    `);
});

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
            onProxyReq: (proxyReq) => {
                proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
                proxyReq.setHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8');
                proxyReq.setHeader('Accept-Language', 'en-US,en;q=0.5');
                proxyReq.removeHeader('Sec-Ch-Ua');
                proxyReq.removeHeader('Sec-Ch-Ua-Mobile');
                proxyReq.removeHeader('Sec-Ch-Ua-Platform');
            },
            onProxyRes: (proxyRes) => {
                delete proxyRes.headers['x-frame-options'];
                delete proxyRes.headers['content-security-policy'];
                delete proxyRes.headers['frame-ancestors'];
            },
            onError: (err, req, res) => {
                res.status(502).send('Proxy connection failed or site refused connection.');
            }
        });
        return proxy(req, res, next);
    } catch (e) {
        res.status(400).send('Invalid URL format');
    }
});

app.use((req, res, next) => {
    if (req.url.startsWith('/search') || req.url.startsWith('/s?')) {
        let fullSearchUrl = currentTargetHost + req.originalUrl;
        return res.redirect('/fetch?url=' + encodeURIComponent(fullSearchUrl));
    }

    createProxyMiddleware({
        target: currentTargetHost,
        changeOrigin: true,
        secure: false,
        onProxyReq: (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            proxyReq.setHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8');
        },
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
