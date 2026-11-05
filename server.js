import express from 'express';
import http from 'http';
import { createBareServer } from '@tomphttp/bare-server-node';
import { uvPath } from '@mercuryworkshop/ultraviolet';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { libcurlPath } from '@mercuryworkshop/libcurl-transport';
import { baremuxPath } from '@mercuryworkshop/bare-mux';
import basicAuth from 'express-basic-auth';

const app = express();
const server = http.createServer(app);
const bare = createBareServer('/bare/');

// Secure Password Protection (Username: admin, Password: MySecretPassword123)
app.use(basicAuth({
    users: { 'admin': 'MySecretPassword123' },
    challenge: true
}));

// Serve Ultraviolet and transport assets directly from node_modules
app.use('/uv/', express.static(uvPath));
app.use('/epoxy/', express.static(epoxyPath));
app.use('/libcurl/', express.static(libcurlPath));
app.use('/baremux/', express.static(baremuxPath));

// Main Portal UI with Service Worker and UV Rewriting Engine
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Math2Learn Portal</title>
            <style>
                * { box-sizing: border-box; }
                body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; color: #f3f4f6; }
                #nav { height: 56px; background: #111827; display: flex; align-items: center; padding: 0 14px; gap: 8px; border-bottom: 1px solid #1f2937; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
                .nav-group { display: flex; gap: 6px; }
                #urlInput { flex: 1; padding: 9px 14px; background: #030712; color: #f3f4f6; border: 1px solid #374151; border-radius: 8px; font-size: 14px; outline: none; }
                #urlInput:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
                button { padding: 9px 14px; background: #1f2937; color: #f3f4f6; border: 1px solid #374151; border-radius: 8px; font-weight: 500; cursor: pointer; font-size: 13px; transition: background 0.15s; }
                button:hover { background: #374151; }
                #goBtn { background: #2563eb; border-color: #1d4ed8; color: #ffffff; }
                #goBtn:hover { background: #1d4ed8; }
                .frame-container { width: 100%; height: calc(100% - 56px); background: #ffffff; position: relative; }
                iframe { width: 100%; height: 100%; border: none; background: #fff; }
            </style>
        </head>
        <body>
            <div id="nav">
                <div class="nav-group">
                    <button onclick="loadSite('https://search.brave.com')">🦁 Brave</button>
                    <button onclick="loadSite('https://duckduckgo.com')">🦆 DuckDuckGo</button>
                    <button onclick="loadSite('https://en.wikipedia.org')">📖 Wikipedia</button>
                </div>
                <input type="text" id="urlInput" placeholder="Search web or enter URL..." />
                <button id="goBtn" onclick="navigate()">Go</button>
            </div>
            <div class="frame-container">
                <iframe id="siteFrame"></iframe>
            </div>

            <!-- Ultraviolet Core Scripts -->
            <script src="/uv/uv.bundle.js"></script>
            <script src="/uv/uv.config.js"></script>
            <script>
                // Initialize UV configuration
                window.__uv$config = {
                    prefix: '/service/',
                    bare: '/bare/',
                    encodeUrl: Ultraviolet.codec.xor.encode,
                    decodeUrl: Ultraviolet.codec.xor.decode,
                    handler: '/uv/uv.handler.js',
                    bundle: '/uv/uv.bundle.js',
                    config: '/uv/uv.config.js',
                    sw: '/uv/uv.sw.js',
                };

                // Register Service Worker for full DOM rewriting
                async function registerSW() {
                    if (!navigator.serviceWorker) return;
                    try {
                        await navigator.serviceWorker.register('/uv/uv.sw.js', { scope: __uv$config.prefix });
                    } catch (e) {
                        console.error('SW registration failed:', e);
                    }
                }

                registerSW();

                function loadSite(url) {
                    document.getElementById('urlInput').value = url;
                    // Encode URL through UV prefix so it rewrites traffic safely
                    let proxiedUrl = __uv$config.prefix + __uv$config.encodeUrl(url);
                    document.getElementById('siteFrame').src = proxiedUrl;
                }

                function navigate() {
                    let input = document.getElementById('urlInput').value.trim();
                    if (!input) return;

                    let targetUrl = input;
                    if (!input.includes('.') && !input.startsWith('http://') && !input.startsWith('https://')) {
                        targetUrl = 'https://search.brave.com/search?q=' + encodeURIComponent(input);
                    } else if (!input.startsWith('http://') && !input.startsWith('https://')) {
                        targetUrl = 'https://' + input;
                    }

                    loadSite(targetUrl);
                }

                document.getElementById('urlInput').addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') navigate();
                });

                // Default initial load
                window.onload = () => {
                    loadSite('https://search.brave.com');
                };
            </script>
        </body>
        </html>
    `);
});

// Route HTTP requests and socket upgrades to the Bare Server backend
server.on('request', (req, res) => {
    if (bare.shouldRoute(req)) {
        bare.routeRequest(req, res);
    } else {
        app(req, res);
    }
});

server.on('upgrade', (req, socket, head) => {
    if (bare.shouldRoute(req)) {
        bare.routeUpgrade(req, socket, head);
    } else {
        socket.destroy();
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Math2Learn Ultraviolet proxy engine running on port ${PORT}`);
});
