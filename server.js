const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Password Protection
app.use(basicAuth({
    users: { 'admin': 'MySecretPassword123' },
    challenge: true
}));

// 2. Main Web Interface (Loads target site inside an iframe)
app.get('/', (req, me) => {
    const targetUrl = req.query.url || 'https://www.google.com';
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>My App</title>
            <style>
                body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; font-family: sans-serif; }
                #nav { height: 40px; background: #222; color: #fff; display: flex; align-items: center; padding: 0 10px; }
                #nav input { flex: 1; padding: 5px 10px; margin-right: 10px; border-radius: 4px; border: none; }
                #nav button { padding: 5px 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
                iframe { width: 100%; height: calc(100% - 40px); border: none; }
            </style>
        </head>
        <body>
            <div id="nav">
                <input type="text" id="urlInput" value="${targetUrl}" placeholder="Enter website URL..." />
                <button onclick="navigate()">Go</button>
            </div>
            <iframe id="siteFrame" src="/fetch?url=${encodeURIComponent(targetUrl)}"></iframe>
            <script>
                function navigate() {
                    let url = document.getElementById('urlInput').value;
                    if (!url.startsWith('http')) url = 'https://' + url;
                    document.getElementById('siteFrame').src = '/fetch?url=' + encodeURIComponent(url);
                }
            </script>
        </body>
        </html>
    `);
});

// 3. Dynamic Proxy Middleware
app.use('/fetch', (req, res, next) => {
    const target = req.query.url;
    if (!target) return res.status(400).send('No target URL provided');
    
    createProxyMiddleware({
        target: target,
        changeOrigin: true,
        pathRewrite: (path, req) => '',
        onProxyRes: (proxyRes) => {
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
        }
    })(req, res, next);
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on port ${PORT}`));
