import { IRequest } from "itty-router";
import { AccountRegistrationBody, UserProfile, RequestCredentials, CFAccessAuthProps } from "./types";
import { homeapis } from "../../../sdk";
import Env from "../env";
import { JwtData } from "../jwt";
import * as tokens from "./token-issuance";

const retrieveAccessIdentity = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    let cloudflare_access_header = request.headers.get('cf-access-jwt-assertion');

    if (!cloudflare_access_header) {
        return homeapis.edge.handler.throwError(request, 'CannotReadAccessJwt', 401);
    }

    return homeapis.edge.handler.createResponse(request, { decoded_jwt: homeapis.edge.jwt.decode(cloudflare_access_header), is_verified: false }, 200, { headers: { 'X-HomeAPIs-Secure-IdP': 'ACTIVE' } })
}

// Preferred method for accessing logged-in user props
const getAccessUserAccountProps = async (request: IRequest, env: Env) => {
    let cloudflare_access_header = request.headers.get('cf-access-jwt-assertion');

    if (!cloudflare_access_header) {
        return null;
    }

    const user_profile: any = homeapis.edge.jwt.decode(cloudflare_access_header);
    return user_profile;
}

const validateCloudflareAccessJwt = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    let cloudflare_access_header = request.headers.get('cf-access-jwt-assertion');

    if (!cloudflare_access_header) {
        return homeapis.edge.handler.throwError(request, 'CannotReadAccessJwt', 401);
    }

    let jwt = homeapis.edge.jwt.decode(cloudflare_access_header);

    return homeapis.edge.handler.createResponse(request, { success: true, jwt }, 200);
}

/**
 * Access CF-protected APIs using Access JWTs
 * @param request 
 * @param env 
 * @param ctx 
 * @returns 
 */
const accessMiddleware = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    let cloudflare_access_header = request.headers.get('cf-access-jwt-assertion');

    if (!cloudflare_access_header) {
        return homeapis.edge.handler.throwError(request, ["CannotReadAccessJwt","https://staging.docs.homeapis.com/video/identity"], 401);
    }
    
    // do not allow Fastly CDN to answer requests using Access
    let url = new URL (request.url);
    let domain_shawdowlist = ['prod.bssott.s3.homeapis.com', 'bss-vod-bssc-shield.prod.fastly.homeapis.com']
    
    const is_unauthorized_origin = domain_shawdowlist.includes(url.hostname);
    if (is_unauthorized_origin) {
        return homeapis.edge.handler.throwError(request, 'UnauthorizedEdgeDomain', 401);
    }
}

const generateUserAccess = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    let cloudflare_access_header = request.headers.get('cf-access-jwt-assertion');

    if (!cloudflare_access_header) {
        return homeapis.edge.handler.throwError(request, 'CannotReadAccessJwt', 401);
    }

    return homeapis.edge.handler.createResponse(request, { decoded_jwt: homeapis.edge.jwt.decode(cloudflare_access_header), is_verified: false }, 200, { headers: { 'X-HomeAPIs-Secure-IdP': 'ACTIVE' } })
}

const createSha256HashHex = async (text: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');

    return hashHex;
}

const checkAuthValidity = async (email: string, password: string, env: Env) => {
    const hashedPassword = await createSha256HashHex(password);

    const accountQuery: UserProfile = await env.HOMEAPIS_USERS_DB.prepare(
        "SELECT * FROM users WHERE email = ?1 AND password = ?2"
    )
        .bind(email, hashedPassword)
        .first();

    if (accountQuery !== null) {
        return accountQuery;
    } else {
        return false
    }
}

const refreshUserJwt = async (req: IRequest, env: Env) => {
    return homeapis.edge.handler.throwError(req, "Unavailable")
}

const signInWithEmailAndPassword = async (req: IRequest, env: Env) => {
    // Get password from body
    const initPayload: any = await req.json();
    const credentials: RequestCredentials = initPayload.credentials;

    // First check Authentication validity
    const edgeAuthenticationStatus = await checkAuthValidity(credentials.email, credentials.password, env);

    // Handle wrong or absent authentication
    if (!edgeAuthenticationStatus) {
        let errorAuthResponse = {
            success: false,
            errors: [
                "This endpoint requires valid credentials in order to issue a JWT. See https://staging.docs.homeapis.com/video/identity"
            ]
        }

        return new Response(JSON.stringify(errorAuthResponse, null, 2), {
            status: 401, // Requires authentication
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            }
        })
    }

    // Issue 2H JWT when authentication is valid
    else {
        const avatar = await homeapis.edge.sonar.createAuthorizedUrl(edgeAuthenticationStatus._id, edgeAuthenticationStatus.avatar, env);

        // assign aud to the token
        const payload = {
            user_metadata: {
                ...edgeAuthenticationStatus,
                avatar,
                password: undefined,
                preferences: JSON.parse(edgeAuthenticationStatus.preferences.replace(/\\/g, "")),
            },
            exp: Math.floor(Date.now() / 1000) + (2 * (60 * 60)), // Expires: Now + 2h
            aud: `${edgeAuthenticationStatus._id}@prod-cloud-platform.iam.homeapis.com`,
            iss: "api.cloud.homeapis.com",
            refresh: false,
        }
        // sign the token
        const token = await homeapis.edge.jwt.sign(payload, env.HOMEAPIS_OPENSSL_JWT_SECRET);
        // Sign a refresh-only token that lasts 7 days
        const refreshToken = await homeapis.edge.jwt.sign({ ...payload, refresh: true, exp: Math.floor((Date.now() / 1000) + (7 * 24 * 60 * 60)) }, env.HOMEAPIS_OPENSSL_JWT_SECRET)

        return new Response(JSON.stringify({ success: true, token, refreshToken }, null, 2), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            }
        })
    }
}

const verifyJwtValidy = async (req: IRequest, env: Env) => {
    const authHeader = req.headers.get("authorization") || "undefined";
    const token = authHeader?.substring(6)

    const isValid = await homeapis.edge.jwt.verify(token, env.HOMEAPIS_OPENSSL_JWT_SECRET) // false

    // Check for validity
    if (!isValid) {
        let errorAuthResponse = {
            success: false,
            errors: [
                "This endpoint requires valid credentials in order to issue a JWT. See https://support.homeapis.com/identity/authorization"
            ]
        }

        return new Response(JSON.stringify(errorAuthResponse, null, 2), {
            status: 401, // Requires a valid JWT
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            }
        })
    }

    // Decoding token
    const payload = homeapis.edge.jwt.decode(token)

    return new Response(JSON.stringify({ success: true, ...payload }, null, 2), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        }
    })
}

// DO NOT EXPORT THIS API
const handleAccountRegistration = async (account: any, env: Env): Promise<any> => {
    // Check that link does not exist yet
    const checkAccountRegistry = await env.HOMEAPIS_USERS_DB.prepare(
        "SELECT * FROM users WHERE email = ?1 OR username = ?2"
    )
        .bind(account.email, account.username)
        .first();

    if (checkAccountRegistry !== null) {
        return false;
    }

    // Register link
    const registrationAttemp = await env.HOMEAPIS_USERS_DB.prepare('INSERT INTO users (_id, created_at, name, username, email, password) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
        .bind(account._id, account.created_at, account.name, account.username, account.email, account.password)
        .run()

    if (registrationAttemp.success) {
        return account;
    } else {
        return false
    }
}

const createUserWithEmailAndPassword = async (req: IRequest, env: Env) => {
    // Uses a "hidden" Foresight API
    const createAccountBody: AccountRegistrationBody | any = await req.json();

    const accountRegistrationData = {
        _id: crypto.randomUUID(),
        created_at: Date.now(),
        name: createAccountBody.name,
        username: createAccountBody.username,
        email: createAccountBody.email,
        password: await createSha256HashHex(createAccountBody.password),
    }

    console.log(accountRegistrationData)

    const dbResponse = await handleAccountRegistration(accountRegistrationData, env);

    if (!dbResponse) {
        return homeapis.edge.handler.throwError(req, "User registration with internal systems failed, check request payload. See requirements: https://staging.docs.homeapis.com/video/endpoints", 500)
    } else {
        // Respond with user profile
        let auth_response = { ...accountRegistrationData, password: undefined };
        return homeapis.edge.handler.createResponse(req, auth_response, 200)
    }
}

/**
 * homeapis.Edge Middleware responsible for authentication of all requests
 * before they reach the actual APIs
 * @param req the request payload
 * @param env the environment variables object
 * @returns proxies the request to the next handler if valid
 */
const middleware = async (req: IRequest, env: Env) => {
    const authHeader = req.headers.get("authorization") || null;
    const token = authHeader?.substring(7) || req.query.access_token?.toString();

    // handle empty token error
    if (!token) return homeapis.edge.handler.throwError(req, "InvalidAuthenticationToken", 401);

    const is_valid = await homeapis.edge.jwt.verify(token, env.HOMEAPIS_OPENSSL_JWT_SECRET);
    const is_refresh = await homeapis.edge.jwt.decode(token).payload.refresh;

    // handle invalid token error
    if (!is_valid) {
        return homeapis.edge.handler.throwError(req, "InvalidAuthenticationToken", 401)
    }

    // check for refresh token
    if (is_refresh) {
        return homeapis.edge.handler.throwError(req, "IllegalRefreshToken", 403)
    }
}

/**
 * Retrieves the full profile of the currently logged-in user
 * @param req the request payload
 * @param env environment variables
 * @returns a user profile
 */
const getCurrentUserProfile = async (req: IRequest, env: Env) => {
    var bearerToken: string | any = req.headers.get("authorization");
    bearerToken = bearerToken?.slice(7) || req.query.access_token;

    if (!bearerToken) {
        return homeapis.edge.handler.throwError(req, "InvalidAuthenticationToken", 403);
    }

    const isValid = await homeapis.edge.jwt.verify(bearerToken, env.HOMEAPIS_OPENSSL_JWT_SECRET) // false

    // Send qualified response
    if (!isValid) return homeapis.edge.handler.throwError(req, "InvalidAuthenticationToken", 403);

    // Respond with data stored in JWT
    let decodedPayload = homeapis.edge.jwt.decode(bearerToken);
    return homeapis.edge.handler.createResponse(req, decodedPayload.payload.user_metadata);
}

async function getPublicUserProfile (req: IRequest, env: Env, ctx: ExecutionContext) {
    const cacheUrl = req.url;

    // Construct the cache key from the cache URL
    const cacheKey = new Request(cacheUrl.toString(), req);
    const cache = caches.default;

    // Check whether the value is already available in the cache
    // if not, you will need to fetch it from origin, and store it in the cache

    let response = await cache.match(cacheKey);

    if (!response) {
        console.log(`Cache miss for: ${req.url}.`);

        const username = req.params.username;

        let profile: UserProfile = await env.HOMEAPIS_USERS_DB.prepare('SELECT * FROM users WHERE username = ?1').bind(username).first();

        if (!profile) {
            response = homeapis.edge.handler.throwError(req, "ProfileDoesNotExist", 404)
        } else {
            let db_profile = {
                success: true,
                id: profile._id,
                name: profile.name,
                username: profile.username,
                picture: await homeapis.edge.sonar.createAuthorizedUrl(profile._id, profile.avatar, env),
                joined: new Date(profile.created_at).toJSON(),
            }

            response = homeapis.edge.handler.createResponse(req, db_profile, 200)
        }

        response.headers.set("Cache-Control", "s-maxage=3600");

        ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } else {
        console.log(`Cache hit for: ${req.url}.`);
    }

    return response;
}

export {
    middleware,
    getAccessUserAccountProps,
    accessMiddleware,
    signInWithEmailAndPassword,
    checkAuthValidity,
    createUserWithEmailAndPassword,
    verifyJwtValidy,
    refreshUserJwt,
    getCurrentUserProfile,
    getPublicUserProfile,
    validateCloudflareAccessJwt,
    retrieveAccessIdentity,
    createSha256HashHex,
    tokens
}