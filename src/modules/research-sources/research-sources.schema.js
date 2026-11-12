export const searchWorksQuerySchema = {
  type: 'object',
  required: ['source', 'query'],
  additionalProperties: false,
  properties: {
    source: { type: 'string', enum: ['openalex', 'crossref'] },
    query: { type: 'string', minLength: 2, maxLength: 500 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
    cursor: { type: 'string', minLength: 1, maxLength: 8192 },
  },
};

export const searchWorksResponseSchema = {
  200: {
    type: 'object',
    required: ['success', 'code', 'data'],
    properties: {
      success: { type: 'boolean' },
      code: { type: 'string' },
      data: {
        type: 'object',
        required: ['source', 'query', 'works', 'pagination'],
        properties: {
          source: { type: 'string', enum: ['openalex', 'crossref'] },
          query: { type: 'string' },
          works: {
            type: 'array',
            items: {
              type: 'object',
              required: ['source', 'sourceId', 'doi', 'title', 'publicationYear', 'type', 'venue', 'citationCount', 'url', 'authors'],
              properties: {
                source: { type: 'string', enum: ['openalex', 'crossref'] },
                sourceId: { type: ['string', 'null'] },
                doi: { type: ['string', 'null'] },
                title: { type: ['string', 'null'] },
                publicationYear: { type: ['integer', 'null'] },
                type: { type: ['string', 'null'] },
                venue: { type: ['string', 'null'] },
                citationCount: { type: ['integer', 'null'] },
                url: { type: ['string', 'null'] },
                authors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['name', 'orcid'],
                    properties: {
                      name: { type: ['string', 'null'] },
                      orcid: { type: ['string', 'null'] },
                    },
                  },
                },
              },
            },
          },
          pagination: {
            type: 'object',
            required: ['limit', 'hasMore'],
            properties: {
              limit: { type: 'integer' },
              hasMore: { type: 'boolean' },
              nextCursor: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
  },
};
