import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error';
import { router } from './routes';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'lmvs-backend' }));

  app.use('/', router);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    swaggerOptions: { persistAuthorization: true },
  }));
   app.get('/docs.json', (_req, res) => res.json(swaggerSpec));
  app.use(errorHandler);
  return app;
}