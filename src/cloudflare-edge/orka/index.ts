import { homeapis } from "../../../sdk";
import { edge, platform } from "../../../sdk/d";
import { IRequest } from "itty-router";
import Env from "../env";
import { D1OrkaCloudVideo } from "./types";
import { CFAccessAuthProps, OneApplicationJwtPayload } from "../auth/types";
import { VideoDataFormatter } from "../recommend";
import { SupportResource } from "../../../sdk/platform";

const validateJwt = async (req: IRequest, env: Env, ctx: ExecutionContext) => {
    // uses the new SupportResource class to handle errors
    const authError = new platform.SupportResource(req, 1336);

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.substring(7) || req.query.access_token?.toString();

    if (!token) return authError.throwError();

    const isValid = await homeapis.edge.jwt.verify(token, env.ORKA_DEMO_SIGNING_KEY) // false

    // Check for validity
    if (!isValid) return authError.throwError();
}

const readOrkaJwtPayload = async (req: IRequest, env: Env, ctx?: ExecutionContext) => {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.substring(7) || req.query.access_token?.toString();

    if (!token) return null;

    const isValid = await homeapis.edge.jwt.verify(token, env.ORKA_DEMO_SIGNING_KEY) // false

    // Check for validity
    if (!isValid) return null

    return homeapis.edge.jwt.decode(token);
}

const signVideoPlaybackURL = async (videoId: string, time: number, env: Env) => {
    const expTimestamp = Math.floor(Date.now() / 1000) + time; // Expires: A week from now
    const tokenData = `${videoId}-${expTimestamp}`;

    const hmacKey = new TextEncoder().encode(env.ORKA_DEMO_SIGNING_KEY);
    const signature = await homeapis.edge.sonar.generateHMAC(hmacKey, tokenData);
    // const signatureBase64 = btoa(signature);

    return `https://bss-vod-bssc-shield.prod.fastly.homeapis.com/outputs/${videoId}/output.m3u8?hmac_token=${signature}&token_exp=${expTimestamp}`;
}

const signSecureVideoPlaybackURL = async (videoId: string, time: number, env: Env) => {
    const expTimestamp = Math.floor(Date.now() / 1000) + time; // Expires: A week from now
    const tokenData = `${videoId}-${expTimestamp}`;

    const hmacKey = new TextEncoder().encode(env.ORKA_DEMO_SIGNING_KEY);
    const signature = await edge.sonar.generateHMAC(hmacKey, tokenData);
    // const signatureBase64 = btoa(signature);

    return `https://bss-vod-bssc-shield.prod.fastly.homeapis.com/v/${expTimestamp}/${signature}/${videoId}/master.m3u8`;
}

const generateUserToken = async (request: IRequest, env: Env) => {
    // retrieve access identity
    const authuser: CFAccessAuthProps | null = await edge.auth.getAccessUserAccountProps(request, env);
    if (!authuser) return edge.handler.throwError(request, ["Preview_CFAuthError", "CouldNotSignPlatformToken"], 401)

    // Get permissions
    // const authuser_jwt_payload = {
    //     iss: "bssott-sso.iam.homeapis.com",
    //     aud: authuser.payload.aud,
    //     sub: authuser.payload.sub,
    //     ...authuser.payload,
    //     name: "bssott",
    //     email: authuser.payload,
    // }
    
    const authuser_jwt_payload: OneApplicationJwtPayload = {
        aud: authuser.payload.aud.toString(),
        email: authuser.payload.email,
        nbf: Math.floor(Date.now() / 10 ** 3),
        iat: Math.floor(Date.now() / 10 ** 3),
        exp: Math.floor(Date.now() / 10 ** 3) + (60 * 60),
        iss: "gateway.homeapis.com",
        // SPECIFY THE NATURE OF THE TOKEN
        type: "USER_ACCESS_TOKEN",
        identity_nonce: authuser.payload.identity_nonce,
        sub: authuser.payload.sub,
        country: authuser.payload.country,
        name: "One User Access Token",
        props: {
            is_premium: true,
            subscribption: {
                is_active: true,
            },
            session_id: crypto.randomUUID(),
            device_id: crypto.randomUUID(),
        }
    }

    // sign platform token
    const token = await edge.jwt.sign(authuser_jwt_payload, env.ORKA_DEMO_SIGNING_KEY);

    return edge.handler.createResponse(request, {
        jwt: token,
        payload: authuser_jwt_payload,
    })
}

/**
 * Generate application-specific tokens
 * method: GET
 * @param request 
 * @param env 
 * @returns 
 */
const generateApplicationToken = async (request: IRequest, env: Env) => {
    const service_id = request.params.service_id;

    // uses the new SupportResource class to handle errors
    const authError = new platform.SupportResource(request, 1337);

    // retrieve access identity
    const authuser: any = await readOrkaJwtPayload(request, env);
    if (!authuser) return authError.throwError();

    // Get permissions
    const authuser_jwt_payload = {
        email: authuser.payload.email,
        iss: "gateway.homeapis.com",
        aud: ([`${service_id}.iam.homeapis.com`].concat(authuser.payload.aud)).toString(),
        sub: authuser.payload.sub,
        nbf: Math.floor(Date.now() / 10 ** 3),
        iat: Math.floor(Date.now() / 10 ** 3),
        exp: Math.floor(Date.now() / 10 ** 3) + (60 * 60),
        name: `${service_id}-medium`,
        props: {
            is_premium: true,
            subscribption: {
                is_active: true,
                renewal: Math.floor(Date.now() / 10 ** 3) + (60 * 60 * 24 * 31),
            },
        },
    }

    // sign platform token
    const token = await edge.jwt.sign(authuser_jwt_payload, env.ORKA_DEMO_SIGNING_KEY);

    return edge.handler.createResponse(request, {
        jwt: token,
        payload: authuser_jwt_payload,
    })
}

// Play video stream in browser
const unwrap = async (request: IRequest, env: Env) => {
    let credentials = {
        hmac: request.query.hmac_token,
        exp: request.query.token_exp,
        videoId: request.params.video_id,
        filename: request.params.file_id,
    };

    // Generate Key
    const expTimestamp = Math.floor(Date.now() / 1000) + 3600; // Expires: 30 minutes from now
    const tokenData = `${credentials.videoId}-${credentials.exp}`;
    const hmacKey = new TextEncoder().encode(env.ORKA_DEMO_SIGNING_KEY);
    const signature = await edge.sonar.generateHMAC(hmacKey, tokenData);

    // Compare Keys
    if (signature !== credentials.hmac || credentials.exp == undefined) {
        return edge.handler.throwError(request, ["This video URL isn't signed properly or the signature was revoked.", 'InvalidHmac'], 403);
    }

    // Signed requests expire after one minute. Note that this value should depend on your specific use case
    if (Date.now() / 1000 > parseInt(credentials.exp.toString()) + expTimestamp) {
        return edge.handler.throwError(request, [`URL expired at ${new Date((parseInt(credentials.exp.toString()) + expTimestamp) * 1000)}`, 'InvalidTimestamp'], 403)
    }

    const response = await fetch(request);
    return response;
}

// Play video stream in browser
const unwrapSecure = async (request: IRequest, env: Env) => {
    let credentials = {
        hmac: request.params.hmac_token,
        exp: request.params.token_exp,
        videoId: request.params.video_id,
        filename: request.params.file_id,
    };

    // Generate Key
    const expTimestamp = Math.floor(Date.now() / 1000) + 3600; // Expires: 30 minutes from now
    const tokenData = `${credentials.videoId}-${credentials.exp}`;
    const hmacKey = new TextEncoder().encode(env.ORKA_DEMO_SIGNING_KEY);
    const signature = await edge.sonar.generateHMAC(hmacKey, tokenData);

    // Compare Keys
    if (signature !== credentials.hmac || credentials.exp == undefined) {
        return edge.handler.throwError(request, ["This video URL isn't signed properly or the signature was revoked.", 'InvalidHmac'], 403);
    }

    // Signed requests expire after one minute. Note that this value should depend on your specific use case
    if (Date.now() / 1000 > parseInt(credentials.exp.toString())) {
        return edge.handler.throwError(request, [`URL expired at ${new Date((parseInt(credentials.exp.toString()) + expTimestamp) * 1000)}`, 'InvalidTimestamp'], 403)
    }

    let request_domain = new URL(request.url).hostname;
    let response_url = `https://${request_domain}/outputs/${credentials.videoId}/${credentials.filename}`;

    const response = await fetch(response_url, request);
    return response;
}

// Play video stream in browser
const fastlyPlayback = async (request: IRequest, env: Env) => {
    let credentials = {
        hmac: request.params.hmac_token,
        exp: request.params.token_exp,
        videoId: request.params.video_id,
        filename: request.params.file_id,
    };

    // Generate Key
    const expTimestamp = Math.floor(Date.now() / 1000) + 3600; // Expires: 30 minutes from now
    const tokenData = `${credentials.videoId}-${credentials.exp}`;
    const hmacKey = new TextEncoder().encode(env.ORKA_DEMO_SIGNING_KEY);
    const signature = await edge.sonar.generateHMAC(hmacKey, tokenData);

    // Compare Keys
    if (signature !== credentials.hmac || credentials.exp == undefined) {
        return edge.handler.throwError(request, ["This video URL isn't signed properly or the signature was revoked.", 'InvalidHmac'], 403);
    }

    // Signed requests expire after one minute. Note that this value should depend on your specific use case
    if (Date.now() / 1000 > parseInt(credentials.exp.toString())) {
        return edge.handler.throwError(request, ["InvalidTimestamp", `URL expired at ${new Date((parseInt(credentials.exp) * 1000)).toLocaleString('en-US', { dateStyle: "long", timeStyle: "medium" })}`], 403)
    }

    let request_domain = new URL(request.url).hostname;

    console.log(request_domain)

    let response_url = `https://prod.bssott.s3.homeapis.com/outputs/${credentials.videoId}/${credentials.filename}`;

    const prodDisable = new platform.SupportResource(request, 999, 501, {
        resource_uri: response_url,
        visibility: "PRIVATE",
        message: "HMAC-only access URIs are reserved for public videos. Please use a newer endpoint that supports IAM access tokens."
    });

    // disable domain access
    return prodDisable.throwError();

    const response = await fetch(response_url, {
        method: 'GET',
        headers: {
            'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID,
            'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET,
            ...request.headers,
        },
    });
    return response;
}

const getVideoManifest = async (request: IRequest, env: Env) => {
    const videoId = request.params.video_id;
    const filename = request.params.filename;

    let manifest_key = `outputs/${videoId}/${filename}.m3u8`;

    const R2_manifest = await env.ORKA_VIDEO_R2.get(manifest_key);

    if (!R2_manifest) return edge.handler.throwError(request, 'VideoNotFound');

    return new Response(R2_manifest.body, {
        status: 200,
        headers: {
            "Content-Type": R2_manifest.httpMetadata?.contentType || 'application/vnd.apple.mpegurl',
        },
    })
}

const getVideoData = async (request: IRequest, env: Env) => {
    let video_id = request.params.show_id;
    let date = Math.floor(Date.now() / 1e3);
    let token_lifetime = 3600; // half an hour in secondes

    const data: D1OrkaCloudVideo | null = await env.ORKA_VIDEO_DB.prepare('SELECT * FROM videos WHERE id = ?1').bind(video_id).first();

    if (!data) {
        return new SupportResource(request, "D1_ERROR").throwError()
    }

    let content_response = {
        video: {
            metadata: {
                id: data.id,
                short_id: data.short_id,
                title: data.title,
                adaptive: Boolean(data.adaptive),
                master_playlist_type: data.master_playlist_type,
                channel_id: data.channel_id,
                created_at: data.created_at,
                updated_at: data.updated_at,
                owner: data.owner,
                description: data.description,
                enable_downloads: Boolean(data.enable_downloads),
                storyboard: {
                    snapshot_count: data.storyboard_image_count,
                    feature_url: `https://prod-media-emea.static.homeapis.com/media/storyboards/${data.id}/vframe_${data.storyboard_feature}.jpg`,
                    feature_url_optimized: `https://theater.imgix.net/media/storyboards/${data.id}/vframe_${data.storyboard_feature}.jpg?h=720&ar=16%3A9&auto=compress&fm=webp`,
                    formats: ['jpg'],
                },
                storage: {
                    object_length: data.video_length,
                },
            },
            access: {
                playback_url: await signSecureVideoPlaybackURL(data.id, token_lifetime, env),
                frame: {
                    start: date,
                    end: date + (60 * 60),
                },
                type: 'public',
                subscribers: {
                    watch_on_plus: `https://music.homeapis.com/fr-fr/playlists/${data.id}?utm_source=orka_web&utm_campaign=apiv3&utm_medium=recommend`
                },
            },
        },
    }

    return edge.handler.createResponse(request, content_response, 200);
}

// POST Query API
interface APIQueryTitle {
    query: {
        parameter: "short_id" | "id",
        type: "exact_match", // only exact_match is supported as of the latest version
        value: string,
        market: string,
    },
}

/**
 * POST API Function
 * @param request 
 * @param env 
 * @param ctx 
 * @returns 
 */
const queryShowData = async (request: IRequest, env: Env): Promise<Response> => {
    let newResObject = new Response(request.body);

    let date = Math.floor(Date.now() / 1e3);
    let token_lifetime = 3600; // an hour in secondes

    const query: APIQueryTitle = await newResObject.json();
    if (!query) return edge.handler.throwError(request, "PostErr", 500)

    let data: D1OrkaCloudVideo | null = null;

    if (query.query.parameter == "short_id") {
        data = await env.ORKA_VIDEO_DB.prepare(`SELECT * FROM videos WHERE short_id = ?1`).bind(query.query.value).first();
    } else {
        data = await env.ORKA_VIDEO_DB.prepare(`SELECT * FROM videos WHERE id = ?1`).bind(query.query.value).first();
    }

    if (!data) return edge.handler.throwError(request, "ShowNotFound", 404)

    // get authuser profile
    const authuser = await readOrkaJwtPayload(request, env);
    if (!authuser) return edge.handler.throwError(request, ["Preview_CFAuthError", "NoAccessProfileFound"], 401)

    let content_response = {
        success: true,
        errors: [],
        data: {
            brand: {
                brand_id: data.channel_id,
                networks: ["originals"],
                original_network: null,
                copyright_owner: data.owner,
            },
            show: {
                id: data.short_id,
                uuid: data.id,
                display_title: data.title,
                created_at: data.created_at,
                updated_at: data.updated_at,
                description: data.description,
                enable_downloads: Boolean(data.enable_downloads),
                storyboard: {
                    snapshot_count: data.storyboard_image_count,
                    feature_url: `https://scontent.homeapis.com/media/storyboards/${data.id}/vframe_${data.storyboard_feature}.jpg`,
                    feature_url_optimized: `https://theater.imgix.net/media/storyboards/${data.id}/vframe_${data.storyboard_feature}.jpg?h=720&ar=16%3A9&auto=compress&fm=webp`,
                    formats: ['jpg'],
                },
            },
            seasons: [
                {
                    season_id: "1",
                    season_uuid: "8a39d427-130a-425c-8dfc-0b7894056a60",
                    season_name: "Season 1",
                    description: "Season 1 Description",
                    episodes: [
                        {
                            title: "Episode 1",
                            available_streams: [
                                {
                                    id: "hls_adaptive",
                                    is_default: true,
                                    playback_url: await signSecureVideoPlaybackURL(data.id, token_lifetime, env),
                                    timeframe: {
                                        iat: date,
                                        nbf: date,
                                        exp: date + (20 * 60),
                                    },
                                },
                            ],
                        }
                    ],
                },
                {
                    season_id: "2",
                    season_uuid: "ce3a1357-ee34-4c52-9ec7-26d0172ec6ea",
                    season_name: "Season 2",
                    description: "Season 2 Description",
                    episodes: [],
                },
            ],
            subscriber: {
                ...authuser.payload,
                market_country: query.query.market,
                market_country_match: (query.query.market == authuser.payload.country),
            },
        },
    }

    return edge.handler.createResponse(request, content_response, 200);
}

const getVideoDataUsingShortId = async (request: IRequest, env: Env) => {
    let video_id = request.params.video_id;
    let date = Math.floor(Date.now() / 1e3);
    let token_lifetime = 1800; // half an hour in secondes

    const data: D1OrkaCloudVideo | null = await env.ORKA_VIDEO_DB.prepare('SELECT * FROM videos WHERE short_id = ?1').bind(video_id).first();

    if (!data) {
        return 
    }

    let content_response = {
        video: {
            metadata: {
                id: data.id,
                short_id: data.short_id,
                title: data.title,
                adaptive: Boolean(data.adaptive),
                master_playlist_type: data.master_playlist_type,
                channel_id: data.channel_id,
                created_at: data.created_at,
                updated_at: data.updated_at,
                owner: data.owner,
                description: data.description,
                enable_downloads: Boolean(data.enable_downloads),
                storyboard: {
                    snapshot_count: data.storyboard_image_count,
                    feature_url: `https://prod-media-emea.static.homeapis.com/media/storyboards/${data.id}/vframe_${data.storyboard_feature}.jpg`,
                    feature_url_optimized: `https://theater.imgix.net/media/storyboards/${data.id}/vframe_${data.storyboard_feature}.jpg?h=720&ar=16%3A9&auto=compress&fm=webp`,
                    feature_url_optimized_min_hd: `https://theater.imgix.net/media/storyboards/${data.id}/vframe_${data.storyboard_feature}.jpg?h=360&ar=16%3A9&auto=compress&fm=webp`,
                    formats: ['jpg'],
                },
                storage: {
                    object_length: data.video_length,
                },
            },
            access: {
                playback_url: await signSecureVideoPlaybackURL(data.id, token_lifetime, env),
                frame: {
                    start: date,
                    end: date + (20 * 60),
                },
                type: 'public',
                subscribers: {
                    watch_on_plus: `https://plus.homeapis.com/fr-fr/browse/${data.id}?utm_source=orka_web&utm_campaign=apiv3&utm_medium=recommend`
                },
            },
        },
    }

    return edge.handler.createResponse(request, content_response, 200);
}

interface QueryParams {
    fields: { field: string, value: string | number }[]
}

/**
 * Find videos by using custom client-set parameters
 */
const findVideosByParams = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    const cacheUrl = request.url;

    // Construct the cache key from the cache URL
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache = caches.default;

    // Check whether the value is already available in the cache
    // if not, you will need to fetch it from origin, and store it in the cache

    let response = await cache.match(cacheKey);
    let videos: Array<D1OrkaCloudVideo> | any = [];

    // load user profile
    const authuser = await edge.video.readOrkaJwtPayload(request, env);
    if (!authuser) return edge.handler.throwError(request, ["Preview_CFAuthError", "NoAccessProfileFound"], 401)

    if (!response) {
        let newResObject = new Response(request.body);

        const query: QueryParams = await newResObject.json();
        if (!query || !query.fields) return edge.handler.throwError(request, "PostErr", 500)

        let field = query.fields.find(field => field.field == "channel_id");

        if (!field) return edge.handler.throwError(request, "NoChannelFound", 404);

        // Establish connection to the DB
        const db_statement: D1Result<D1OrkaCloudVideo> = await env.ORKA_VIDEO_DB.prepare('SELECT * FROM videos WHERE channel_id = ?1').bind(field.value).all();

        if (!db_statement.success) {
            response = edge.handler.throwError(request, 'DBWrongQuery', 500);
        } else {
            videos = db_statement.results;
            const curator = new VideoDataFormatter(videos);

            response = edge.handler.createResponse(request, {
                success: true,
                errors: [],
                results: curator.getFormattedVideoData(),
                metadata: {
                    subscriber: {
                        ...authuser.payload.access.payload,
                        is_premium: true,
                    },
                    access_type: "GRANT",
                    query,
                    ...db_statement.meta
                },
            })
        }

        response.headers.set("Cache-Control", "s-maxage=60");
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } else {
        console.log(`Cache hit for: ${request.url}.`);
    }

    return response
}

const deprecated = (request: IRequest) => {
    let error = new platform.SupportResource(request, "VIDEO_SERVICE_DEPRECATED", 404);
    return error.throwError();
}

export {
    generateUserToken,
    generateApplicationToken,
    getVideoData,
    getVideoDataUsingShortId,
    getVideoManifest,
    validateJwt,
    unwrap,
    fastlyPlayback,
    unwrapSecure,
    queryShowData,
    readOrkaJwtPayload,
    findVideosByParams,
    deprecated
}