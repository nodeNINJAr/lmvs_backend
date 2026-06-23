import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/error';
import { generalLimiter } from './middleware/rateLimit';
import { router } from './routes';
import { swaggerSpec } from './swagger';

// Origins allowed to call this API from a browser. Exact FRONTEND_BASE_URL match, plus any
// *.vercel.app subdomain (covers preview deployments) and localhost for development.
const ALLOWED_ORIGIN_PATTERNS = [
  process.env.FRONTEND_BASE_URL,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
].filter(Boolean) as (string | RegExp)[];

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGIN_PATTERNS.some((p) => (p instanceof RegExp ? p.test(origin) : p === origin));
}

export function createApp() {
  const app = express();
  // CSP disabled: this is a JSON API, and the one HTML page it serves (/docs) loads
  // swagger-ui from a CDN that a default CSP would block. Other helmet protections stay on.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header = non-browser caller (curl, server-to-server, health checks) — allow.
        if (!origin || isAllowedOrigin(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
      },
    })
  );
  app.use(generalLimiter);
  app.use(express.json({ limit: '5mb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'lmvs-backend' }));

  // --- Swagger: MUST be before app.use('/', router) ---
  app.get('/docs.json', (_req, res) => res.json(swaggerSpec));

  app.get('/docs', (_req, res) => {
    res.send(`
      <!DOCTYPE html><html><head>
        <title>LMVS API Docs</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
      </head><body>
        <div id="swagger-ui"></div>
        <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
        <script>
          window.onload = () => SwaggerUIBundle({
            url: '/docs.json',
            dom_id: '#swagger-ui',
            persistAuthorization: true
          });
        </script>
      </body></html>
    `);
  });

  // main router comes AFTER docs
  app.use('/', router);

  app.use(errorHandler);
  return app;
}