const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const basicAuth = require('express-basic-auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(basicAuth({
    users: { 'admin': 'MySecretPassword123' },
    challenge: true,
    realm: 'CustomBrowserRestricted'
}));

app.get('/', (req, res) => {
    res.send(
        '<!DOCTYPE html>' +
        '<html>' +
        '<head><title>My Custom Browser</title></head>' +
        '<body style="font-family: Arial; padding: 40px; background: #121212; color: #fff;">' +
        '<h2>My Secure Custom Browser</h2>' +
        '<form action="/browse" method="GET">' +
        '<input type="text" name="url" placeholder="Enter URL (e.g., https://www.wikipedia.org)" style="width: 70%; padding: 10px; font-size: 16px;" required>' +
        '<button type="submit" style="padding: 10px 20px; font-size: 16px;">Go</button>' +
        '</form>' +
        '</body>' +
        '</html>'
    );
});

app.use('/proxy', (req, res, next) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.send('Please provide a URL.');
    
    createProxyMiddleware({
        target: targetUrl,
        changeOrigin: true,
        secure: false,
        onProxyRes: (proxyRes) => {
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
        },
        pathRewrite: { '^/proxy': '' },
    })(req, res, next);
});

app.get('/browse', (req, res) => {
    res.redirect('/proxy?url=' + encodeURIComponent(req.query.url));
});

app.listen(PORT, () => {
    console.log('Server running on port ' + PORT);
});
