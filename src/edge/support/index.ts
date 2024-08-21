import { IRequest } from 'itty-router';
import Env from '../env';
import { edge } from '../..';

const getSupportThread = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
  const cacheUrl = request.url;

  // Construct the cache key from the cache URL
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cache = caches.default;

  // Check whether the value is already available in the cache
  // if not, you will need to fetch it from origin, and store it in the cache

  let response = await cache.match(cacheKey) as Response;

  if (!response) {
    // get ticket ID
    const ticket_id = request.params.ticket_id;

    // get ticket from DB
    const ticket: D1Ticket | null = await env.SUPPORT_DB.prepare('SELECT * FROM tickets WHERE ticket_id = ?1')
      .bind(ticket_id)
      .first();

    // when ticket exists
    if (!ticket) return edge.handler.throwError(request, ['Error', 'NoTicketWithID'], 404);

    // query DB for thread messages
    const messages = await env.SUPPORT_DB.prepare('SELECT * FROM messages WHERE ticket_id = ?1').bind(ticket_id).all();

    response = edge.handler.createResponse(request, {
      success: true,
      errors: [],
      ticket: {
        ...ticket,
        thread: messages.results
      },
      cache: 'ENABLED',
      isOwnTicket: false,
      owner: ticket.customer_email
    });

    response.headers.set('Cache-Control', 's-maxage=1800');
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  } else {
    console.log(`Cache hit for: ${request.url}.`);
  }

  return response;
};

const getSupportThreadsForAccount = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
  const cacheUrl = request.url;

  // Construct the cache key from the cache URL
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cache = caches.default;

  // Check whether the value is already available in the cache
  // if not, you will need to fetch it from origin, and store it in the cache

  let response = (await cache.match(cacheKey)) as Response;

  if (!response) {
    const authuser = await edge.video.readOrkaJwtPayload(request, env);
    if (!authuser) return edge.handler.throwError(request, ['Preview_CFAuthError', 'NoAccessProfileFound'], 401);

    // get ticket ID
    const ticket_email = authuser.payload.email;
    console.log(ticket_email);

    // get ticket from DB
    const tickets = await env.SUPPORT_DB.prepare('SELECT * FROM tickets WHERE customer_email = ?1')
      .bind(ticket_email)
      .all();

    // when ticket exists
    if (!tickets.success) return edge.handler.throwError(request, ['Error', 'NoTicketWithID'], 404);

    response = edge.handler.createResponse(request, {
      success: true,
      errors: [],
      tickets: tickets.results,
      cache: 'ENABLED',
      isOwnTicket: true,
      owner: ticket_email
    });

    response.headers.set('Cache-Control', 's-maxage=1800');
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  } else {
    console.log(`Cache hit for: ${request.url}.`);
  }

  return response;
};

const supportKit = {
  getSupportThread,
  getSupportThreadsForAccount
};

export default supportKit;
