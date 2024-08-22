import { authKit } from '..';
import { D1Ticket, D1TicketMessage, SupportThread } from './types';

/**
 * Return a complete message thread
 * with support@{yourdomain} emails
 * and through website support widgets.
 * @param request
 * @param env
 * @returns
 */
const getSupportThread = async (request: IRequest, env: Env): Promise<SupportThread | null> => {
  const { ticket_id } = request.params;

  // retrieve ticket from DB
  const ticket: D1Ticket | null = await env.supportDB
    .prepare('SELECT * FROM tickets WHERE ticket_id = ?1')
    .bind(ticket_id)
    .first();

  if (!ticket) return null;
  // if the thread exists,
  // query DB for thread messages
  const messages: D1Result<D1TicketMessage> = await env.supportDB
    .prepare('SELECT * FROM messages WHERE ticket_id = ?1')
    .bind(ticket_id)
    .all();

  return {
    ticket,
    messages: messages.results
  };
};
/**
 * Get all support threads started through email / support website
 * for the current `authuser`
 * @param request
 * @param env
 * @returns
 */
const getSupportThreadsForAccount = async (request: IRequest, env: Env): Promise<D1Ticket[]> => {
  // only allow if rw access is granted to `supportDB` in Auth0 API endpoint
  authKit.auth0.verifyAuthorizationClaims(request, env, ['read:support', 'write:support']);
  const { email } = authKit.auth0.parseJwtClaims(request).payload;
  // get ticket from DB
  const tickets: D1Result<D1Ticket> = await env.supportDB
    .prepare('SELECT * FROM tickets WHERE customer_email = ?1')
    .bind(email)
    .all();
  return tickets.results;
};

export { getSupportThread, getSupportThreadsForAccount };
