import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApplicationReference } from './api/apli/sansho/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(__dirname, 'dist');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function sendFile(response, filePath) {
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
      return;
    }

    const contentType = contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(response);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method Not Allowed');
    return;
  }

  const requestPath = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
  if (requestPath === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (await handleApplicationReference(requestPath, response)) {
    return;
  }

  const relativePath = decodeURIComponent(requestPath).replace(/^\/+/, '');
  const requestedFile = path.resolve(publicDirectory, relativePath || 'index.html');
  if (!requestedFile.startsWith(`${publicDirectory}${path.sep}`) && requestedFile !== publicDirectory) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  fs.stat(requestedFile, (error, stats) => {
    if (!error && stats.isFile()) {
      if (request.method === 'HEAD') {
        response.writeHead(200, { 'Content-Type': contentTypes[path.extname(requestedFile).toLowerCase()] || 'application/octet-stream' });
        response.end();
        return;
      }
      sendFile(response, requestedFile);
      return;
    }

    if (request.method === 'HEAD') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end();
      return;
    }
    sendFile(response, path.join(publicDirectory, 'index.html'));
  });
});

const port = Number(process.env.PORT || 8080);
server.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${port}`);
});