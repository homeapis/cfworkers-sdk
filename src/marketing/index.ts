import { IRequest } from "itty-router";
import { WorkerEnv as Env } from "..";
import { MarketingEmailD1, MarketingEmailQuery } from "./types";
import { homeapis } from "../../sdk";

class MarketingCustomer {
    email_hash: string;
    env: Env;

    constructor(email_hash: string, env: Env) {
        this.email_hash = email_hash;
        this.env = env;
    }

    async getProfile() {
        // Query DB for data
        const mkt_profile: MarketingEmailD1 = await this.env.MARKETING_DB.prepare('SELECT * FROM email_collection WHERE email_hash_sha256 = ?1').bind(this.email_hash).first();

        return mkt_profile;
    }
}

const collectPostEmailAddress = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    let cp_request = new Response(request.body);
    let rPayloadPreview: any = await cp_request.json();
    let rPayload: any = rPayloadPreview.payload;
    var cloudflare_colo_id = typeof request.cf?.colo === 'string' ? request.cf?.colo : "CDG"

    // Implement bot-verification features
    // avoid DDoS and check real traffic is received

    // check rPayload
    if (!rPayload?.mkt_campaign || !rPayload.mkt_channel || !rPayload.mkt_medium || !rPayload.email) {
        return homeapis.edge.handler.throwError(request, ["MarketingDataNotSpecified"], 500);
    }

    let query: MarketingEmailQuery = rPayload;


    let em_hash = await homeapis.edge.auth.createSha256HashHex(query.email);
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
        mkt_linked_account_id: null,
    }

    // check that email is new
    const emailExists: MarketingEmailD1 = await env.MARKETING_DB.prepare('SELECT * FROM email_collection WHERE email_hash_sha256 = ?1').bind(data.email_hash_sha256).first()

    if (emailExists && emailExists?.email) {
        // email exists
        return homeapis.edge.handler.throwError(request, ["MktError", { email: em_hash }], 401);
    }

    try {
        // register claims to database
        await env.MARKETING_DB
            .prepare('INSERT INTO email_collection (email, email_hash_sha256, mkt_medium, mkt_campaign, mkt_channel, email_uuid, created_at, allows_email, is_account_linked, is_disabled, has_requested_deletion, mkt_region, mkt_last_intouch, deletion_requested_date, mkt_linked_account_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)')
            .bind(data.email, data.email_hash_sha256, data.mkt_medium, data.mkt_campaign, data.mkt_channel, data.email_uuid, data.created_at, data.allows_email, data.is_account_linked, data.is_disabled, data.has_requested_deletion, data.mkt_region, data.mkt_last_intouch, data.deletion_requested_date, data.mkt_linked_account_id).run().catch(err => console.error(err));

        console.log("handleRegister", "Attempting data registration");
        // console.log("handleRegister", registration);
    } catch (err: any) {
        console.error("D1BackendError", err.message);
        return homeapis.edge.handler.throwError(request, ["com.homeapis.schemas/err", "cf/D1Error", err.message, data], 200);
    }

    // return response
    return homeapis.edge.handler.createResponse(request, {
        success: true,
        errors: [],
        registration_event: data,
    })
}

const getEmailRegistrationData = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    const email_hash = request.params.email_hash;

    // check DB for response
    const customer = new MarketingCustomer(email_hash, env);
    const profile = await customer.getProfile();

    if (!profile) return homeapis.edge.handler.throwError(request, ["Profile doesn't exist."], 404);

    return homeapis.edge.handler.createResponse(request, {
        success: true,
        errors: [],
        profile,
    })
}

const marketingKit = {
    collectPostEmailAddress,
    getEmailRegistrationData
}

export default marketingKit;