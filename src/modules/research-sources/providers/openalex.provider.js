import { ScholarlySourceError } from '../scholarly-source.errors.js';
import { asInteger, fetchJson, normalizeDoi } from './provider-http.js';

const OPENALEX_WORKS_URL = 'https://api.openalex.org/works';
const OPENALEX_MAX_PER_PAGE = 100;
const OPENALEX_BASIC_PAGING_LIMIT = 10000;

function normalizeWork(work) {
  const sourceId = typeof work.id === 'string' ? work.id : null;
  const location = work.primary_location ?? work.best_oa_location ?? null;
  const source = location?.source ?? null;

  return {
    source: 'openalex',
    sourceId,
    doi: normalizeDoi(work.doi),
    title: typeof work.title === 'string' ? work.title : null,
    publicationYear: asInteger(work.publication_year),
    type: typeof work.type === 'string' ? work.type : null,
    venue: typeof source?.display_name === 'string' ? source.display_name : null,
    citationCount: asInteger(work.cited_by_count),
    url: location?.landing_page_url ?? work.doi ?? null,
    authors: (Array.isArray(work.authorships) ? work.authorships : [])
      .map(({ author }) => ({
        name: typeof author?.display_name === 'string' ? author.display_name : null,
        orcid: typeof author?.orcid === 'string' ? author.orcid : null,
      }))
      .filter((author) => author.name || author.orcid),
  };
}

export function createOpenAlexProvider({ apiKey = '', fetchImpl = globalThis.fetch } = {}) {
  const normalizedApiKey = typeof apiKey === 'string' ? apiKey.trim() : '';

  return {
    async searchWorks({ query, limit, cursor }) {
      const url = new URL(OPENALEX_WORKS_URL);
      url.searchParams.set('search', query);
      url.searchParams.set('per_page', String(Math.min(limit, OPENALEX_MAX_PER_PAGE)));
      url.searchParams.set(
        'select',
        'id,doi,title,publication_year,type,primary_location,best_oa_location,cited_by_count,authorships',
      );

      let page = 1;
      if (normalizedApiKey) {
        url.searchParams.set('api_key', normalizedApiKey);
        url.searchParams.set('cursor', cursor || '*');
      } else {
        page = cursor === undefined ? 1 : Number(cursor);
        if (!Number.isSafeInteger(page) || page < 1) {
          throw new ScholarlySourceError({
            source: 'openalex',
            statusCode: 400,
            code: 'INVALID_CURSOR',
            message: 'The OpenAlex continuation cursor is invalid.',
          });
        }
        url.searchParams.set('page', String(page));
      }

      const payload = await fetchJson(url, 'openalex', fetchImpl);
      const results = Array.isArray(payload?.results) ? payload.results : [];
      const meta = payload?.meta ?? {};
      let nextCursor = null;

      if (normalizedApiKey) {
        nextCursor = typeof meta.next_cursor === 'string' && meta.next_cursor
          ? meta.next_cursor
          : null;
      } else {
        const count = asInteger(meta.count);
        const nextPage = page + 1;
        const accessibleResults = Math.min(count ?? 0, OPENALEX_BASIC_PAGING_LIMIT);
        if (count !== null && nextPage * limit <= accessibleResults) {
          nextCursor = String(nextPage);
        }
      }

      return {
        works: results.map(normalizeWork),
        nextCursor,
      };
    },
  };
}
