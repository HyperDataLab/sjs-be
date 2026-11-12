import { ScholarlySourceError } from './scholarly-source.errors.js';
import { createResearchSourceService } from './research-sources.service.js';

export const searchWorks = async (request, reply) => {
  const { source, query, limit = 25, cursor } = request.query;

  try {
    const service = createResearchSourceService({ env: process.env });
    const result = await service.searchWorks({ source, query, limit, cursor });

    return reply.code(200).send({
      success: true,
      code: 'RESEARCH_WORKS_SEARCH_SUCCESS',
      data: {
        source,
        query: query.trim(),
        works: result.works,
        pagination: {
          limit,
          hasMore: Boolean(result.nextCursor),
          nextCursor: result.nextCursor,
        },
      },
    });
  } catch (error) {
    if (error instanceof ScholarlySourceError) {
      if (/^\d+$/.test(error.retryAfter ?? '')) {
        reply.header('retry-after', error.retryAfter);
      }
      request.log.warn({
        source,
        code: error.code,
        upstreamStatus: error.upstreamStatus,
      }, 'Scholarly source request failed');

      return reply.code(error.statusCode).send({
        success: false,
        code: error.code,
        message: error.message,
      });
    }

    request.log.error({ err: error, source }, 'Unexpected scholarly source error');
    return reply.code(502).send({
      success: false,
      code: 'UPSTREAM_SOURCE_ERROR',
      message: 'A scholarly data source could not complete the request.',
    });
  }
};
