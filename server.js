import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import basicAuth from 'express-basic-auth';
import { createBareServer } from '@tomphttp/bare-server-node';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import { baremuxPath } from '@mercuryworkshop/bare-mux';

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

// Serve Ultraviolet core assets from node_modules
app.use('/uv/', express.static(uvPath));
app.use('/epoxy/', express.static(epoxyPath));
app.use('/baremux/', express.static(baremuxPath));

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
