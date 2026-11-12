import { verifyTokenFastify } from '../auth/auth.middleware.js';
import { searchWorks } from './research-sources.controller.js';
import { searchWorksQuerySchema, searchWorksResponseSchema } from './research-sources.schema.js';

export default async function researchSourcesRoutes(fastify) {
  fastify.get('/works', {
    preHandler: verifyTokenFastify,
    schema: {
      tags: ['Research'],
      summary: 'Search works from an external scholarly metadata provider',
      querystring: searchWorksQuerySchema,
      response: searchWorksResponseSchema,
    },
  }, searchWorks);
}
