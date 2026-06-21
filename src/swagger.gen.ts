import fs from 'fs';
import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'LMVS API', version: '1.0.0', description: 'Labor Migration Verification System' },
    servers: [{ url: process.env.PUBLIC_BASE_URL || 'http://localhost:4000' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // runs at BUILD time, where ./src/* DOES exist
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
});

fs.writeFileSync(path.join(__dirname, 'swagger.json'), JSON.stringify(spec, null, 2));
console.log('[swagger] generated swagger.json');