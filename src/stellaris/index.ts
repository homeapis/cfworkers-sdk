import { GameRom } from './types';
import { edge, platform } from '..';

interface QueryParams {
  query: string;
  limit: number;
  [key: string]: any;
}

/**
 * Find Roms by using custom client-set parameters
 */
const searchRoms = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
  const cacheUrl = request.url;

  // Construct the cache key from the cache URL
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cache = caches.default;
  // Check whether the value is already available in the cache
  // if not, you will need to fetch it from origin, and store it in the cache

  let response = await cache.match(cacheKey) as Response;
  let roms: Array<GameRom> | any = [];

  if (!response) {
    let newResObject = new Response(request.body);

    const clientPayload: QueryParams = await newResObject.json();
    if (!clientPayload || !clientPayload.query || !clientPayload.limit)
      return edge.handler.throwError(request, 'PostErr', 500);

    // Establish connection to the DB
    const db_statement: D1Result<GameRom> = await env.STELLARIS.prepare(
      'SELECT * FROM roms WHERE title LIKE ?1 LIMIT ?2'
    )
      .bind(`%${clientPayload.query}%`, clientPayload.limit)
      .all();

    if (!db_statement.success) {
      response = edge.handler.throwError(request, 'DBWrongQuery', 500);
    } else {
      roms = db_statement.results;

      response = edge.handler.createResponse(request, {
        success: true,
        errors: [],
        results: roms,
        metadata: {
          access_type: 'GRANT',
          payload: clientPayload,
          ...db_statement.meta
        }
      });
    }

    response.headers.set('Cache-Control', 's-maxage=3600');
    response.headers.set('X-Stellaris-Stale', 's-maxage=3600');
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  } else {
    console.log(`Cache hit for: ${request.url}.`);
  }

  return response;
};

/**
 * Find Roms by using custom client-set parameters
 */
const searchRomsByGet = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
  const cacheUrl = request.url;

  // Construct the cache key from the cache URL
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cache = caches.default;

  // Check whether the value is already available in the cache
  // if not, you will need to fetch it from origin, and store it in the cache

  let response = await cache.match(cacheKey) as Response;
  let roms: Array<GameRom> | any = [];

  if (!response) {
    const clientPayload = {
      query: request.query.q,
      limit: request.query.limit
    };

    if (!clientPayload || !clientPayload.query || !clientPayload.limit)
      return edge.handler.throwError(request, 'UnspecifiedParams', 403);

    // Establish connection to the DB
    const db_statement: D1Result<GameRom> = await env.STELLARIS.prepare(
      'SELECT * FROM roms WHERE title LIKE ?1 LIMIT ?2'
    )
      .bind(`%${clientPayload.query}%`, clientPayload.limit)
      .all();

    if (!db_statement.success) {
      response = edge.handler.throwError(request, 'DBWrongQuery', 500);
    } else {
      roms = db_statement.results;

      response = edge.handler.createResponse(request, {
        success: true,
        errors: [],
        results: roms,
        metadata: {
          access_type: 'GRANT',
          payload: clientPayload,
          ...db_statement.meta
        }
      });
    }

    response.headers.set('Cache-Control', 's-maxage=3600');
    response.headers.set('X-Stellaris-Stale', 's-maxage=3600');
    response.headers.set('X-Stellaris-Remaining-Queries', (50 - 1).toString());
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  } else {
    console.log(`Cache hit for: ${request.url}.`);
  }

  return response;
};

const getGameRoms = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
  const cacheUrl = request.url;

  // Construct the cache key from the cache URL
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cache = caches.default;

  // Check whether the value is already available in the cache
  // if not, you will need to fetch it from origin, and store it in the cache

  let response = await cache.match(cacheKey) as Response;

  if (!response) {
    // Pagination
    const page = parseInt(request.query.page?.toString() || '0');

    // Actual step count
    const limit = request.query.limit;
    var actual_limit = !limit || parseInt(limit.toString()) > 100 ? 50 : parseInt(limit.toString());

    // get games
    const roms: D1Result<GameRom> = await env.STELLARIS.prepare('SELECT * FROM roms LIMIT ?1').bind(actual_limit).all();

    // use the brand new JS errorKit
    const DBErr = new platform.SupportResource(request, 'D1_ERROR', 500, {
      message: 'D1 Data could not be read.'
    });
    if (!roms.success || !roms.results) {
      response = DBErr.throwError();
    } else {
      let last_id = roms.results?.[actual_limit];

      // send data when possible
      response = edge.handler.createResponse(request, {
        success: true,
        roms: roms.results,
        metadata: {
          count: roms.results?.length,
          last_item: last_id,
          next_page_url: `https://api.homeapis.com/client/v3/stellaris/archive/roms?limit=${actual_limit}&page=${page + 1}`
        }
      });
    }

    // Data does not change at all for years in most cases
    // Atomic data updates don't bring any added-value to the platform
    response.headers.set('Cache-Control', 's-maxage=86400');
    response.headers.set('X-Stellaris-Stale', 's-maxage=86400');
    response.headers.set('X-Stellaris-Multipage', 'TRUE');

    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  } else {
    console.log(`Cache hit for: ${request.url}.`);
  }

  return response;
};

const getGameRomBySha256 = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
  const cacheUrl = request.url;

  // Construct the cache key from the cache URL
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cache = caches.default;

  // Check whether the value is already available in the cache
  // if not, you will need to fetch it from origin, and store it in the cache

  let response = await cache.match(cacheKey) as Response;

  if (!response) {
    // Actual step count
    const rom_sha256 = request.params.rom_sha256;

    // get games
    const rom: GameRom | null = await env.STELLARIS.prepare('SELECT * FROM roms WHERE sha256 = ?1')
      .bind(rom_sha256)
      .first();

    if (!rom) {
      const DBErr = new platform.SupportResource(request, 'D1_ERROR', 501, {
        message: 'D1 Data could not be read.'
      });
      response = DBErr.throwError();
    } else {
      // send data when possible
      response = edge.handler.createResponse(request, {
        success: true,
        rom,
        metadata: {
          source: 'com.homeapis.datasets',
          copyright: '(c) Copyright 2024 - HomeAPIs.com',
          licensee: "iam_claims['public-supplier']"
        }
      });
    }

    // Data does not change at all for years in most cases
    // Atomic data updates don't bring any added-value to the platform
    response.headers.set('Cache-Control', 's-maxage=86400');
    response.headers.set('X-Stellaris-Stale', 's-maxage=86400');

    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  } else {
    console.log(`Cache hit for: ${request.url}.`);
  }

  return response;
};

export { getGameRoms, getGameRomBySha256, searchRoms, searchRomsByGet };
