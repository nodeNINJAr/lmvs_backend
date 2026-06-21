import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error';
import { router } from './routes';
import { swaggerSpec } from './swagger';

export function createApp() {
  const app = express();
  app.use(cors());
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