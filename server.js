const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

let currentTargetHost = 'https://html.duckduckgo.com';

// Secure Password Protection (Username: admin, Password: MySecretPassword123)
app.use(basicAuth({
    users: { 'admin': 'MySecretPassword123' },
    challenge: true
}));

app.get('/', (req, res) => {
    let targetUrl = req.query.url || 'https://html.duckduckgo.com/html/';
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
            <title>Secure Private Browser</title>
            <style>
                * { box-sizing: border-box; }
                body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #090d16; }
                #nav { height: 54px; background: #111827; display: flex; align-items: center; padding: 0 12px; gap: 8px; border-bottom: 1px solid #1f2937; }
                #urlInput { flex: 1; padding: 8px 14px; background: #030712; color: #f3f4f6; border: 1px solid #374151; border-radius: 6px; font-size: 14px; outline: none; }
                #urlInput:focus { border-color: #3b82f6; }
                button { padding: 8px 14px; background: #1f2937; color: #f3f4f6; border: 1px solid #374151; border-radius: 6px; font-weight: 500; cursor: pointer; font-size: 13px; transition: background 0.15s; }
                button:hover { background: #374151; }
                #goBtn { background: #2563eb; border-color: #1d4ed8; color: #ffffff; }
                #goBtn:hover { background: #1d4ed8; }
                .frame-container { width: 100%; height: calc(100% - 54px); background: #ffffff; position: relative; }
                iframe { width: 100%; height: 100%; border: none; background: #fff; }
            </style>
        </head>
        <body>
            <div id="nav">
                <button onclick="loadPreset('https://html.duckduckgo.com/html/')">🔒 DuckDuckGo</button>
                <button onclick="loadPreset('https://www.wikipedia.org')">📖 Wikipedia</button>
                <button onclick="loadPreset('https://news.ycombinator.com')">📰 Tech News</button>
                <input type="text" id="urlInput" value="${targetUrl}" placeholder="Search securely or enter URL..." />
                <button id="goBtn" onclick="navigate()">Go</button>
            </div>
            <div class="frame-container">
                <iframe id="siteFrame" src="/fetch?url=${encodeURIComponent(targetUrl)}"></iframe>
            </div>
            <script>
                function loadPreset(url) {
                    document.getElementById('urlInput').value = url;
                    document.getElementById('siteFrame').src = '/fetch?url=' + encodeURIComponent(url);
                }

                function navigate() {
                    let input = document.getElementById('urlInput').value.trim();
                    if (!input) return;
                    
                    if (!input.includes('.') && !input.startsWith('http://') && !input.startsWith('https://')) {
                        input = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(input);
                    } else if (!input.startsWith('http://') && !input.startsWith('https://')) {
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
                proxyReq.setHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
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
