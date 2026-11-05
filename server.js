import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import basicAuth from 'express-basic-auth';
import { createBareServer } from '@tomphttp/bare-server-node';
import fetch from 'node-fetch'; // Or we can use native fetch since Node supports it

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const bare = createBareServer('/bare/');

// Basic Authentication configuration
const authMiddleware = basicAuth({
    users: { 'admin': 'MySecretPassword123' },
    challenge: true,
    realm: 'Custom Browser Portal'
});

// Serve local service worker by proxying the official CDN build so it matches the same-origin policy
app.get('/uv/sw.js', async (req, res) => {
    try {
        const response = await fetch('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.7/dist/uv.sw.js');
        const body = await response.text();
        res.setHeader('Content-Type', 'application/javascript');
        res.send(body);
    } catch (err) {
        res.status(500).send('Error loading service worker');
    }
});

// Protect the main frontend static files with Basic Auth
app.use('/', authMiddleware, express.static(path.join(__dirname, 'public')));

// Handle Bare server routing for proxy traffic
app.use((req, res, next) => {
    if (bare.shouldRoute(req)) {
        bare.routeRequest(req, res);
    } else {
        next();
    }
});

server.on('upgrade', (req, socket, head) => {
    if (bare.shouldRoute(req)) {
        bare.routeUpgrade(req, socket, head);
    } else {
        socket.destroy();
    }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
