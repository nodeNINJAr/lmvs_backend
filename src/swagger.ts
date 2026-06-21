import swaggerJsdoc from 'swagger-jsdoc';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'LMVS API', version: '1.0.0', description: 'Labor Migration Verification System' },
    servers: [{ url: process.env.PUBLIC_BASE_URL || 'http://localhost:4000' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT',  },
      },
      
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'], // where to read JSDoc from
});