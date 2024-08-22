import { IRequest } from 'itty-router';
import { MarketingEmailD1, MarketingEmailQuery } from './types';
import { cryptoKit, handler } from '..';

/**
 * Constructor for the `MarketingCustomer` class
 * to support generating customer profiles in e-mail collection
 * database, `supportDB`
 */
class MarketingCustomer {
  email_hash: string;
  env: Env;

  constructor(email_hash: string, env: Env) {
    this.email_hash = email_hash;
    this.env = env;
  }

  /**
   * Retrieve base profile for email hash
   * @returns
   */
  async getProfile() {
    // Query DB for data
    const mkt_profile: MarketingEmailD1 | null = await this.env.supportDB
      .prepare('SELECT * FROM email_collection WHERE email_hash_sha256 = ?1')
      .bind(this.email_hash)
      .first();
    return mkt_profile;
  }
}
/**
 * Handle POST requests and save customer data to database.
 * Only process requests when user has consented to email collection
 * as well as your privacy policy.
 * @param request
 * @param env
 * @returns
 */
const collectPostEmailAddress = async (request: IRequest, env: Env) => {
  let cp_request = new Response(request.body);
  let rPayloadPreview: any = await cp_request.json();
  let rPayload: any = rPayloadPreview.payload;
  var cloudflare_colo_id = typeof request.cf?.colo === 'string' ? request.cf?.colo : 'CDG';

  // Implement bot-verification features
  // avoid DDoS and check real traffic is received

  // check rPayload
  if (!rPayload?.mkt_campaign || !rPayload.mkt_channel || !rPayload.mkt_medium || !rPayload.email) {
    return handler.throwError(request, ['MarketingDataNotSpecified'], 500);
  }

  let query: MarketingEmailQuery = rPayload;

  let em_hash = await cryptoKit.hashSha256(query.email);
  let now = Date.now();

  const data: MarketingEmailD1 = {
    email: query.email,
    email_hash_sha256: em_hash,
    mkt_medium: query.mkt_medium,
    mkt_campaign: query.mkt_campaign,
    mkt_channel: query.mkt_channel,
    email_uuid: crypto.randomUUID(),
    created_at: now,
    allows_email: 1,
    is_account_linked: 0,
    is_disabled: 0,
    has_requested_deletion: 0,
    mkt_region: cloudflare_colo_id || null,
    mkt_last_intouch: now,
    deletion_requested_date: null,
    mkt_linked_account_id: null
  };

  // check that email is new
  const emailExists: MarketingEmailD1 | null = await env.supportDB
    .prepare('SELECT * FROM email_collection WHERE email_hash_sha256 = ?1')
    .bind(data.email_hash_sha256)
    .first();

  // handle already saved email
  if (emailExists && emailExists?.email) {
    // email exists
    return handler.throwError(request, ['MktError', { email: em_hash }], 401);
  }

  try {
    // register claims to database
    await env.MARKETING_DB.prepare(
      'INSERT INTO email_collection (email, email_hash_sha256, mkt_medium, mkt_campaign, mkt_channel, email_uuid, created_at, allows_email, is_account_linked, is_disabled, has_requested_deletion, mkt_region, mkt_last_intouch, deletion_requested_date, mkt_linked_account_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)'
    )
      .bind(
        data.email,
        data.email_hash_sha256,
        data.mkt_medium,
        data.mkt_campaign,
        data.mkt_channel,
        data.email_uuid,
        data.created_at,
        data.allows_email,
        data.is_account_linked,
        data.is_disabled,
        data.has_requested_deletion,
        data.mkt_region,
        data.mkt_last_intouch,
        data.deletion_requested_date,
        data.mkt_linked_account_id
      )
      .run()
      .catch((err: any) => console.error(err));

    console.log('handleRegister', 'Attempting data registration');
    // console.log("handleRegister", registration);
  } catch (err: any) {
    console.error('D1BackendError', err.message);
    return handler.throwError(request, [err.message, data], 200);
  }

  // return response
  return handler.createResponse(request, {
    success: true,
    errors: [],
    event: data
  });
};
/**
 * Return email profile. Useful for when users wish to unsubscribe
 * from parts of your newsletter and you wish to request their current
 * level of subscription.
 * @param request
 * @param env
 * @returns
 */
const getEmailRegistrationData = async (request: IRequest, env: Env) => {
  const email_hash = request.params.email_hash;

  // check DB for response
  const customer = new MarketingCustomer(email_hash, env);
  const profile = await customer.getProfile();

  if (!profile) return handler.throwError(request, ["Profile doesn't exist."], 404);

  return handler.createResponse(request, {
    success: true,
    errors: [],
    profile
  });
};

const marketingKit = {
  collectPostEmailAddress,
  getEmailRegistrationData
};

export default marketingKit;
