const path = require('path');
const express = require('express');
const compression = require('compression');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PORT = process.env.PORT || 4000;
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';
const BACKEND_URL = process.env.BACKEND_URL || 'http://crm-backend:8080';
const DIST_DIR = path.join(__dirname, 'dist');

const app = express();
app.disable('x-powered-by');
app.use(compression());

// Anything under /api/* is a backend concern — proxy it, never fall back to index.html.
// Mounted at root (not app.use('/api', ...)) so Express doesn't strip the /api
// prefix from req.url before the proxy sees it — the backend's Spring context-path
// is /api/v1, so it needs the full original path forwarded unchanged.
app.use(
  createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true,
    pathFilter: '/api',
    logger: console,
    on: {
      error: (err, req, res) => {
        console.error(`[proxy] ${req.method} ${req.originalUrl} -> ${BACKEND_URL}: ${err.message}`);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({ error: 'Bad Gateway', message: 'Upstream API is unreachable' }));
      },
    },
  })
);

// There is no service worker in this build; say so explicitly instead of
// silently handing back index.html, which breaks SW registration/caching semantics.
app.get('/sw.js', (req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

// Static assets (JS/CSS/images/etc). `fallthrough: true` lets unmatched paths
// (e.g. Angular client-side routes) continue to the SPA handler below instead
// of 404ing here, but any path that IS a real file on disk is served as-is
// with the correct Content-Type/caching — never rewritten to index.html.
app.use(
  express.static(DIST_DIR, {
    index: false,
    fallthrough: true,
    setHeaders: (res, filePath) => {
      if (path.basename(filePath) === 'index.html') {
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  })
);

// True SPA fallback: only for GET requests that accept HTML (i.e. browser
// navigations to Angular routes like /dashboard or /customers/123).
app.get('*', (req, res, next) => {
  if (!req.accepts('html')) {
    return next();
  }
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.use((req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

app.listen(PORT, HOSTNAME, () => {
  console.log(`bento-crm server listening on http://${HOSTNAME}:${PORT}`);
  console.log(`Proxying /api -> ${BACKEND_URL}`);
});
