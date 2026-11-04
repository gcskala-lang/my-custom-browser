const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

try {
    // 1. Password Protection
    app.use(basicAuth({
        users: { 'admin': 'MySecretPassword123' },
        challenge: true
    }));

    // 2. Main Portal Shell
    app.get('/', (req, res) => {
        let targetUrl = req.query.url || 'https://www.google.com';
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
        }

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
                    <input type="text" id="urlInput" value="${targetUrl}" placeholder="Enter website address (e.g. https://wikipedia.org)..." />
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

    // 3. Dedicated Proxy Route
    app.use('/fetch', (req, res, next) => {
        let targetUrl = req.query.url;
        if (!targetUrl) return res.status(400).send('No target URL provided');

        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
        }

        try {
            const parsed = new URL(targetUrl);
            
            createProxyMiddleware({
                target: parsed.origin,
                changeOrigin: true,
                secure: false,
                pathRewrite: (path, req) => parsed.pathname + parsed.search,
                onProxyRes: (proxyRes) => {
                    delete proxyRes.headers['x-frame-options'];
                    delete proxyRes.headers['content-security-policy'];
                    delete proxyRes.headers['frame-ancestors'];
                },
                onError: (err, req, res) => {
                    res.status(502).send('Proxy connection failed.');
                }
            })(req, res, next);
        } catch (e) {
            res.status(400).send('Invalid URL format');
        }
    });

    // 4. Fallback
    app.use((req, res) => {
        res.status(404).send('Not found.');
    });

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server successfully running on port ${PORT}`);
    });

} catch (startupError) {
    console.error('CRITICAL STARTUP ERROR:', startupError);
    process.exit(1);
}
