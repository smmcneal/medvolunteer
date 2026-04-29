// server.js — Phusion Passenger entry point for SiteGround Node.js hosting.
// Next.js `output: 'standalone'` copies this project's dependencies into
// .next/standalone. Passenger starts the app by requiring this file.
//
// After `npm run build`, copy/upload the following to the server root:
//   .next/standalone/   → entire directory
//   .next/static/       → public/_next/static/
//   public/             → public/
//
// Set the Passenger startup file to: server.js

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
