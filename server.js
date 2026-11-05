import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBareServer } from '@tomphttp/bare-server-node';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import basicAuth from 'express-basic-auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const bare = createBareServer('/bare/');

// Password Protection (Username: admin, Password: MySecretPassword123)
app.use(basicAuth({
    users: { 'admin': 'MySecretPassword123' },
    challenge: true
}));

// Serve Ultraviolet core files from node_modules
app.use('/uv/', express.static(uvPath));

// Serve the frontend files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Unified server routing
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
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Math2Learn portal running on port ${PORT}`);
});
