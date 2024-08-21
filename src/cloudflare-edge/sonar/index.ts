import { IRequest } from "itty-router";
import { D1UploadMetadata, PhotosJWTPayload } from "./types";
import Env from "../env";
import { homeapis } from "../../../sdk";

const createAuthorizedUrl = async (user_id: string, file_id: string | null, env: Env) => {
    if (!file_id) return null;

    const expTimestamp = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7); // Expires: A week from now
    const tokenData = `${file_id}-${expTimestamp}`;

    const hmacKey = new TextEncoder().encode(env.HOMEAPIS_OPENSSL_JWT_SECRET_PHOTOS);
    const signature = await generateHMAC(hmacKey, tokenData);
    const signatureBase64 = btoa(signature);

    return `https://s-webmedia.bo.homeapis.com/boxoffice/uc/${file_id}?exp=${expTimestamp}&token=${signatureBase64}`;
}

/**
 * Embedding external content
 */

async function sha256(message: string) {
    // encode as UTF-8
    const msgBuffer = new TextEncoder().encode(message);

    // hash the message
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);

    // convert ArrayBuffer to Array
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // convert bytes to hex string
    const hashHex = hashArray.map(b => ('00' + b.toString(16)).slice(-2)).join('');
    console.log(hashHex);
    return hashHex;
}

async function createProxyAuthorizedUrl(request: IRequest, env: Env, ctx: ExecutionContext) {
    const cacheUrl = request.url;

    // Construct the cache key from the cache URL
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache = caches.default;

    // Check whether the value is already available in the cache
    // if not, you will need to fetch it from origin, and store it in the cache

    let response = await cache.match(cacheKey);

    if (!response) {
        console.log(`Cache miss for: ${request.url}.`);

        let original_url = request.query.original?.toString();

        if (!original_url) {
            response = homeapis.edge.handler.throwError(request, ['NoResponse', "NoOriginUrlProvided"], 403);
        } else {
            original_url = decodeURIComponent(original_url);

            const min_id = await sha256(original_url);
            const storage_key = `external/tmp-${min_id}`;

            // Generate CDN token
            const expTimestamp = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7); // Expires: A week from now when the file gets cleared from the bucket
            const tokenData = `${min_id}`;

            const hmacKey = new TextEncoder().encode(env.HOMEAPIS_OPENSSL_JWT_SECRET_PHOTOS);
            const signature = await generateHMAC(hmacKey, tokenData);
            const signatureBase64 = btoa(signature);

            // Actually download the content
            const content_res = await fetch(original_url, {
                headers: {
                    "X-Compass-Client-Application": "com.homeapis.cf.compass-proxy",
                    "X-Compass-Request-ID": request.headers.get('cf-ray') || crypto.randomUUID(),
                    // "Authorization" : For homeapis.com SSO-supported properties
                },
                method: "GET",
            })

            // Save to R2
            const object = await env.R2_EXTERNAL.get(storage_key);

            // Check for object
            if (!object) {
                await env.R2_EXTERNAL.put(storage_key, content_res.body, {
                    httpMetadata: {
                        contentType: content_res.headers.get('Content-Type') || "application/json; charset=utf-8",
                        cacheExpiry: new Date(expTimestamp * 1000),
                    },
                    customMetadata: {
                        "x-upload-url": original_url,
                        "x-upload-ip": request.headers.get('CF-Connecting-IP') || "null",
                        "x-upload-ray-id": request.headers.get('cf-ray') || "null",
                    },
                })
            }

            let sonar_url = `https://compass-proxy.cf.sonar.homeapis.com/t/${signature}/${min_id}`;
            let fastly_url = `https://sonar.homeapis.com/t/${signature}/${min_id}`;

            response = homeapis.edge.handler.createResponse(request, {
                success: true,
                object: {
                    public_url: sonar_url,
                    fastly_url,
                    access: {
                        signature: signature,
                        signature_base64: signatureBase64,
                    },
                    metadata: {
                        key: storage_key,
                        cache_expiry: new Date(expTimestamp * 1000),
                        proxy: {
                            canonical: original_url,
                            is_proxied_media: true,
                        }
                    },
                }
            });
        }

        response.headers.set("Cache-Control", "s-maxage=3600");
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } else {
        console.log(`Cache hit for: ${request.url}.`);
    }

    return response;
}

async function generateHMAC(key: Uint8Array, data: any) {
    const hmacKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const encodedData = new TextEncoder().encode(data);
    const signature = await crypto.subtle.sign('HMAC', hmacKey, encodedData);

    return Array.from(new Uint8Array(signature))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

async function getMediaById(request: IRequest, env: Env) {
    const media_id = request.params.media_id;

    const mediaFile: any = await env.HOMEAPIS_MEDIA_DB.prepare('SELECT * FROM public WHERE id = ?1 AND visibility = ?2').bind(media_id, "public").first()

    if (!mediaFile) {
        homeapis.edge.handler.throwError(request, ['Media does not exist or was deleted', "PublicMediaNotFound"], 404)
    } else {
        // Look Up the user's profile
        const creator_profile: any = await env.HOMEAPIS_USERS_DB.prepare('SELECT * FROM users WHERE _id = ?1').bind(mediaFile.user_id).first();

        if (!creator_profile) {
            homeapis.edge.handler.throwError(request, ["Uploader profile does not exist or was deleted", "PublicProfileNotFound"], 404)
        }

        var response_body = {
            success: true,
            media: {
                // Use PW links for now
                id: media_id,
                url: await createAuthorizedUrl(mediaFile.user_id, media_id, env),
                metadata: {
                    datacenter: homeapis.edge.network.getEdgeLocation(mediaFile.region)?.colo_city,
                    datacenterIataCode: mediaFile.region,
                    title: mediaFile.title,
                    isAiGeneratedMetadata: Boolean(mediaFile.ai_generated_metadata),
                    description: {
                        userProvided: mediaFile.alt
                    },
                    createdAt: mediaFile.created_at,
                    updatedAt: mediaFile.updated_at,
                    visibility: mediaFile.visibility,
                },
            },
            creator: {
                userId: creator_profile._id,
                displayName: creator_profile.name,
                username: creator_profile.username,
                createdAt: new Date(creator_profile.created_at).toISOString(),
                avatar: {
                    avatarUrl: await createAuthorizedUrl(creator_profile._id, creator_profile.avatar, env),
                },
            }
        }

        var request_id = request.headers.get('x-sd-client-request-id') || crypto.randomUUID();

        return new Response(JSON.stringify(response_body), {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Language": "en-US",
                "Access-Control-Allow-Origin": '*',
                "x-sd-correlation-id": request_id,
                "x-sd-request-id": request_id,
            }
        })
    }
}


/**
 * Generate Sonar Access Key for public media only
 * @param request the request object
 * @param env Environment Variables
 * @param ctx Exectution Context
 * @returns Sonar Access Key
 */
async function getPublicMediaById(request: IRequest, env: Env, ctx: ExecutionContext) {
    const cacheUrl = request.url;

    // Construct the cache key from the cache URL
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache = caches.default;

    // Check whether the value is already available in the cache
    // if not, you will need to fetch it from origin, and store it in the cache

    let response = await cache.match(cacheKey);

    if (!response) {
        const media_id = request.params.media_id;

        const mediaFile: any = await env.HOMEAPIS_MEDIA_DB.prepare('SELECT * FROM public WHERE id = ?1 AND visibility = ?2').bind(media_id, "public").first()

        if (!mediaFile) {
            response = homeapis.edge.handler.throwError(request, ['Media does not exist or was deleted', "PublicMediaNotFound"], 404)
        } else {
            // Look Up the user's profile
            const creator_profile: any = await env.HOMEAPIS_USERS_DB.prepare('SELECT * FROM users WHERE _id = ?1').bind(mediaFile.user_id).first();

            if (!creator_profile) {
                response = homeapis.edge.handler.throwError(request, ["Uploader profile does not exist or was deleted", "PublicProfileNotFound"], 404)
            }

            var response_body = {
                success: true,
                resource: {
                    // Use PW links for now
                    resource_id: media_id,
                    type: "media",
                    url: await createAuthorizedUrl(mediaFile.user_id, media_id, env),
                },
                metadata: {
                    object: {
                        datacenter: homeapis.edge.network.getEdgeLocation(mediaFile.region)?.colo_city,
                        datacenter_iata_code: mediaFile.region,
                        entities: [
                            {
                                ui_title: "User-generated description",
                                type: "string",
                                key: "user_provided_description",
                                value: mediaFile.alt,
                            },
                            {
                                ui_title: "AI-generated description",
                                type: "boolean",
                                key: "ai_generated_description",
                                value: Boolean(mediaFile.ai_generated_metadata),
                            },
                            {
                                ui_title: "User-provided title",
                                type: "string",
                                key: "user_provided_title",
                                value: mediaFile.title,
                            },
                        ],
                        created_at: mediaFile.created_at,
                        updated_at: mediaFile.updated_at,
                        visibility: mediaFile.visibility,
                    },
                    resource_owner: {
                        user_uuid: creator_profile._id,
                        display_name: creator_profile.name,
                        handle: creator_profile.username,
                        created_at: new Date(creator_profile.created_at).toISOString(),
                        profile_picture: {
                            profile_picture_normal: await createAuthorizedUrl(creator_profile._id, creator_profile.avatar, env),
                        },
                    }
                },
            }

            response = homeapis.edge.handler.createResponse(request, response_body, 200, {
                headers: {
                    "Access-Control-Allow-Origin": '*',
                }
            })
        }

        response.headers.set("Cache-Control", "s-maxage=3600");
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
    } else {
        console.log(`Cache hit for: ${request.url}.`);
    }

    return response
}

const mediaWrapper = async (photos: Array<any> | undefined, env: Env) => {
    if (photos === undefined) return [];

    const temp_photos: Array<any> = [];

    // Use Promise.all to wait for all promises to resolve
    await Promise.all(photos.map(async photo => {
        const photo_url = await homeapis.edge.sonar.createAuthorizedUrl(photo.user_id, photo.id, env);

        temp_photos.push({
            // Use PW links for now
            media: {
                id: photo.id,
                url: photo_url,
                metadata: {
                    datacenter: homeapis.edge.network.getEdgeLocation(photo.region)?.colo_city,
                    datacenterIataCode: photo.region,
                    isAiGeneratedMetadata: Boolean(photo.ai_generated_metadata),
                    title: photo.title,
                    description: {
                        userProvided: photo.alt
                    },
                    createdAt: photo.created_at,
                    updatedAt: photo.updated_at,
                    visibility: photo.visibility,
                },
            },

            // Update client applications for Web and iOS
            // and remove the following properties
            ...photo,
            ip: undefined,
            url: photo_url,
            region: homeapis.edge.network.getEdgeLocation(photo.region)?.colo_alias || "unknown",
        });
    }));

    return temp_photos;
};

const getAuthUserMedia = async (req: IRequest, env: Env) => {
    const access_token = req.headers.get('authorization')?.substring(7) || req.query.access_token?.toString();

    if (access_token === undefined) return new Response(JSON.stringify({ error: "Token was not provided or is incorrectly formatted.", help: "https://cloud.homeapis.com/identity" }, null, 2), {
        status: 401,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Language": "en-US"
        }
    })

    // Verify the user's token
    const isValid = await homeapis.edge.jwt.verify(access_token, env.HOMEAPIS_OPENSSL_JWT_SECRET);

    if (!isValid) {
        return new Response(JSON.stringify({ error: "Unauthorized. User does not have permission to perform the current action.", help: "https://cloud.homeapis.com/identity" }, null, 2), {
            status: 403,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Language": "en-US"
            }
        })
    }

    // Parse the token using decode
    const jwt_payload: PhotosJWTPayload = homeapis.edge.jwt.decode(access_token).payload;

    // Abort upload in case token is missing required properties
    if (jwt_payload.user_metadata === undefined) throw new Error("User metadata missing from token payload. Aborting upload.")

    // Get user photos
    let my_photos = await env.HOMEAPIS_MEDIA_DB.prepare('SELECT * FROM public WHERE user_id = ?1').bind(jwt_payload.user_metadata._id).all();

    if (!my_photos.success) {
        return new Response(JSON.stringify({ success: false }), {
            status: 404,
            headers: {
                "Access-Control-Allow-Origin": '*',
                "Content-Type": `application/json; charset=utf-8;`,
                "Content-Language": 'en-US',
            }
        })
    } else {
        const totalPhotosBytes = await env.HOMEAPIS_MEDIA_DB.prepare('SELECT SUM(size) AS total_bytes_uploaded FROM public WHERE user_id = ?1').bind(jwt_payload.user_metadata._id).first('total_bytes_uploaded');
        const totalAllowedBytes: any = await env.HOMEAPIS_USERS_DB.prepare('SELECT * FROM users WHERE _id = ?1').bind(jwt_payload.user_metadata._id).first();

        return new Response(JSON.stringify({
            success: true,
            id: jwt_payload.user_metadata._id,
            username: jwt_payload.user_metadata.username,
            displayName: jwt_payload.user_metadata.name,
            storage: {
                usage: totalPhotosBytes,
                maxAvailable: totalAllowedBytes.storage_capacity || 10 ** 9,
                current_storage_plan: 'free',
            },
            photos: await homeapis.edge.sonar.mediaWrapper(my_photos.results?.slice(0, 20), env)
        }), {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": '*',
                "Content-Type": `application/json; charset=utf-8;`,
            }
        })
    }
}

const getPublicUserMedia = async (request: IRequest, env: Env) => {
    // Client has to fetch user id beforehand
    const creator_id = request.params.username;

    // Inferred from usage
    const creator_profile: any = await env.HOMEAPIS_USERS_DB.prepare('SELECT * FROM users WHERE _id = ?1').bind(creator_id).first();

    if (!creator_profile._id) {
        homeapis.edge.handler.throwError(request, ['User ID does not link to an active profile', "UserProfileNotFound"], 404)
    }

    // Get user photos
    const requested_visibility = 'public';

    let public_photos = await env.HOMEAPIS_MEDIA_DB.prepare('SELECT * FROM public WHERE user_id = ?1 AND visibility = ?2').bind(creator_id, requested_visibility).all();

    if (!public_photos.success) {
        return homeapis.edge.handler.throwError(request, "CouldNotLoadLibrary", 404, { headers: { "x-registered-service": "com.homeapis.sonar-net" } })
    } else {
        const photos = await homeapis.edge.sonar.mediaWrapper(public_photos.results?.slice(0, 20), env);

        const pre_resp = {
            success: true,
            actionType: "publicPhotosLookup",
            id: creator_profile._id,
            username: creator_profile.username,
            displayName: creator_profile.name,
            photos,
            metadata: {
                resultsTotalLength: public_photos.results?.length,
            }
        };

        return homeapis.edge.handler.createResponse(request, pre_resp, 200, { cacheTtl: 3600 })
    }
}

const uploadNewPublicMedia = async (request: IRequest, env: Env) => {
    let access_token = request.headers.get('authorization')?.substring(7);

    // Set uploadType to media if not requested
    let uploadType: string = request.query.uploadType?.toString() || "media";

    // Declare var as a string
    var cloudflare_colo_id = typeof request.cf?.colo === 'string' ? request.cf?.colo : "CDG"

    if (access_token === undefined) return new Response(JSON.stringify({ error: "Token was not provided or is incorrectly formatted.", help: "https://docs.homeapis.com/identity" }, null, 2), {
        status: 401,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Language": "en-US"
        }
    })

    // Verify the user's token
    const isValid = await homeapis.edge.jwt.verify(access_token, env.HOMEAPIS_OPENSSL_JWT_SECRET);

    if (!isValid) {
        return new Response(JSON.stringify({ error: "Unauthorized. User does not have permission to perform the current action.", help: "https://docs.homeapis.com/blog/tags/identity" }, null, 2), {
            status: 403,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Language": "en-US"
            }
        })
    }

    // Parse the token using decode
    const jwt_payload: PhotosJWTPayload = homeapis.edge.jwt.decode(access_token).payload;

    // Abort upload in case token is missing required properties
    if (jwt_payload.user_metadata === undefined) throw new Error("User metadata missing from token payload. Aborting upload.")

    // Parse request
    const request_body = await request.formData();
    const request_metadata = {
        title: request.headers.get('X-File-Disposition') || "Untitled",
        contentType: request.headers.get('X-File-Content-Type'),
    }

    // Save file to R2 before saving metadata to D1
    // oopsies, we'll need to change that part

    const upload: D1UploadMetadata = {
        id: crypto.randomUUID(),
        ip: request.headers.get('X-Forwarded-For') || request.headers.get('CF-Connecting-IP') || "1.1.1.1",
        // In case request is proxied through Fastly, log the real client IP (Sonar)
        region: cloudflare_colo_id,
        user_id: jwt_payload.user_metadata?._id,
        created_at: Date.now(),
        updated_at: null,
        alt: null,
        title: request_metadata.title.slice(0, 50), // Max length for a media title is now 50 characters
        visibility: "public",
        ai_generated_metadata: false,
    }


    const file = {
        body: request_body.get('file'),
        httpMetadata: {
            contentType: request_metadata.contentType,
            contentLength: request_body instanceof Blob ? request_body.size : request.blob.length,
        }
    }

    let allowed_types = [
        "image/jpeg",
        "image/png",
    ]

    if (!file.httpMetadata.contentType || !allowed_types.includes(file.httpMetadata.contentType)) {
        return homeapis.edge.handler.throwError(request, ["Content-Type header was not specified or is not supported.", "UnsupportedContentType"], 500)
    }

    console.log(upload.alt);

    var object_size = 0;

    // Upload to R2 — Now
    await env.HOMEAPIS_MEDIA_R2_BUCKET.put(`public/${upload.id}`, file.body, {
        customMetadata: {
            'x-user-id': upload.user_id,
        }, httpMetadata: {
            contentType: file.httpMetadata.contentType,
        }
    }).then(result => object_size = result.size)

    // Save D1 statement
    const registerData = await env.HOMEAPIS_MEDIA_DB.prepare(`INSERT INTO public (id, user_id, created_at, updated_at, alt, region, ip, size, visibility, title, ai_generated_metadata) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    ).bind(upload.id, upload.user_id, upload.created_at, upload.updated_at, upload.alt, upload.region, upload.ip, object_size, upload.visibility, upload.title, (upload.ai_generated_metadata ? 1 : 0)).run()

    // Return a signed download URL
    if (registerData.success) {
        return new Response(JSON.stringify({
            success: true,
            content: await homeapis.edge.sonar.createAuthorizedUrl(upload.user_id, upload.id, env),
            upload_metadata: upload,
            object_metadata: file.httpMetadata
        }), {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Language": "en-US"
            }
        })
    } else {
        throw new Error('Registration with D1 failed.')
    }
}

export {
    createAuthorizedUrl,
    getAuthUserMedia,
    getMediaById,
    getPublicMediaById,
    getPublicUserMedia,
    uploadNewPublicMedia,
    mediaWrapper,
    createProxyAuthorizedUrl,
    generateHMAC
}