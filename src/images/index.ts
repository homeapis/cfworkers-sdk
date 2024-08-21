import { IRequest } from "itty-router";
import Env from "../../@homeapis/cloudflare-edge/env";
import { auth0, edge, platform } from "../d";

interface ImageBody {
    image: {
        url: string;
    },
}

interface DBImage {
    id: string;
    created_at: number;
    updated_at: number | null;
    original_image_url: string;
    original_image_hash: string;
    original_size: number;
    account_uid: string;
    account_uid_sha256: string;
    is_moderated: number;
    is_deleted: number;
    moderation_challenge_score: number | null;
};

/**
 * Doesn't require DB access
 */
const signImageViewUrlLite = async (image_id: string, account_uid_sha256: string, env: Env, time: number = 86400) => {
    const expTimestamp = Math.floor(Date.now() / 1000) + time; // Expires: A day from now
    const tokenData = `${image_id}-${expTimestamp}`;

    const hmacKey = new TextEncoder().encode(env.HOME_PHOTOS_SECRET);
    const signature = await edge.sonar.generateHMAC(hmacKey, tokenData);
    // const signatureBase64 = btoa(signature);

    return `https://scontent.homeapis.com/v1/images/${account_uid_sha256}/${image_id}?hmac_token=${signature}&token_exp=${expTimestamp}`;
};
/**
 * New function to sign images on scontent* CDN
 * @param image 
 * @param time 
 * @param env 
 * @returns 
 */
const signImageViewUrl = async (image: DBImage, env: Env, time: number = 86400) => {
    const expTimestamp = Math.floor(Date.now() / 1000) + time; // Expires: A day from now
    const tokenData = `${image.id}-${expTimestamp}`;

    const hmacKey = new TextEncoder().encode(env.HOME_PHOTOS_SECRET);
    const signature = await edge.sonar.generateHMAC(hmacKey, tokenData);
    // const signatureBase64 = btoa(signature);

    return `https://scontent.homeapis.com/v1/images/${image.account_uid_sha256}/${image.id}?hmac_token=${signature}&token_exp=${expTimestamp}`;
};
/**
 * Generate image hash
 * @param body 
 * @returns 
 */
const generateImageHash = async (body: ReadableStream) => {
    const digestStream = new crypto.DigestStream('SHA-256')

    await body.pipeTo(digestStream)

    const digest = await digestStream.digest;

    const hexString = [...new Uint8Array(digest)]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

    return hexString;
};
/**
 * Fetch public URL
 * @param request 
 * @param env 
 * @param ctx 
 * @returns 
 */
const uploadPublicImage = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    const { image }: ImageBody = await request.json();

    const user = auth0.parseJwtClaims(request).payload;

    let canUploadImages = auth0.verifyAuthorizationClaims(request, ["read:photos", "write:photos"]);

    const imageResource = await fetch(image.url, {
        method: 'GET',
    })

    let imageResponseData = imageResource.clone()
    let imageDataFinal = imageResource.clone()

    const uidMapping = await edge.auth.createSha256HashHex(user.sub as string);
    const imageVersionHash = await generateImageHash(imageResource.body as ReadableStream<any>)

    const versionAlreadyExists: DBImage | null = await env.imagesDB.prepare('SELECT * FROM images WHERE original_image_hash = ?1 AND account_uid_sha256 = ?2').bind(imageVersionHash, uidMapping).first();

    if (versionAlreadyExists !== null) {
        return edge.handler.createResponse(request, {
            success: false,
            errors: [
                "The exact same file was already uploaded to your account.",
            ],
            image: {
                url: await signImageViewUrl(versionAlreadyExists, env),
                ...versionAlreadyExists
            },
        })
    }

    let imageProperties: DBImage = {
        id: crypto.randomUUID(),
        created_at: Date.now(),
        updated_at: null,
        original_image_url: image.url,
        original_image_hash: imageVersionHash,
        original_size: (await imageResponseData.arrayBuffer()).byteLength,
        account_uid: user.sub as string,
        account_uid_sha256: uidMapping,
        is_moderated: 0,
        moderation_challenge_score: null,
        is_deleted: 0,
    }

    console.log("[SAVE]", imageProperties)

    const d1MetadataUpload = await env.imagesDB.prepare('INSERT INTO images (id, created_at, updated_at, original_image_url, original_image_hash, original_size, account_uid, account_uid_sha256, is_moderated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)').bind(imageProperties.id, imageProperties.created_at, imageProperties.updated_at, imageProperties.original_image_url, imageProperties.original_image_hash, imageProperties.original_size, imageProperties.account_uid, imageProperties.account_uid_sha256, imageProperties.is_moderated).run();

    if (!d1MetadataUpload.success) {
        return edge.handler.createResponse(request, {
            success: false,
            errors: [
                "Illegal request. Upload registration failed."
            ],
        }, 403)
    }

    const objectKey = `usercontent/${imageProperties.account_uid_sha256}/${imageProperties.id}`

    await env.imagesBucket.put(objectKey, imageDataFinal.body, {
        httpMetadata: {
            contentType: imageDataFinal.headers.get('Content-Type') || "NULL",
        },
        customMetadata: {
            "X-IMG-SOURCE": "proxy"
        },
        sha256: imageProperties.original_image_hash,
    }).then(upload => {
        // Successful upload
        console.log('[upload]', "File was successfully saved to user account.")
    })
        .catch(error => {
            console.error("Error uploading image:", error);
            // Handle the error based on its type or message
            return edge.handler.throwError(request, ["CouldNotSaveImage", "Failed to fetch from distant origin."])
        });

    return edge.handler.createResponse(request, {
        image: {
            ...imageProperties,
            url: await signImageViewUrl(imageProperties, env),
        },
        account: {
            canUploadImages,
            user
        }
    }, 200);
}

const getAccountImages = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
    const user = auth0.parseJwtClaims(request).payload;

    const offset = parseInt(request.query.start as string) || 0;

    // make sure the user is allowed to [read:photos]
    auth0.verifyAuthorizationClaims(request, ["read:photos"]);

    const response: D1Result<DBImage> = await env.imagesDB.prepare("SELECT * FROM images WHERE account_uid = ?1 LIMIT 10 OFFSET ?2").bind(user.sub, offset).all()

    const getSignedImages = async (images: DBImage[]) => await Promise.all(images.map(async (image): Promise<any> => {
        return {
            ...image,
            url: await signImageViewUrl(image, env),
        };
    }));

    return edge.handler.createResponse(request, {
        success: true,
        images: await getSignedImages(response.results),
        user: {
            ...user,
        },
        messages: [
            {
                locale: "en-US",
                title: "Storage",
                type: "info",
                text: "An cloud storage limit of 1 GB per account will now apply to Photos. Content uploaded before August 5, 2024 does not count towards that limit, unless it is deleted and reuploaded. Paid plans will be available for additional storage capacity.",
                time: new Date("August 2, 2024").toISOString(),
            }
        ]
    })
}

/**
 * Delete image
 */
const deleteAccountImage = async (request: IRequest, env: Env) => {
    const { account_id, image_id } = request.params;

    const user = auth0.parseJwtClaims(request).payload;

    // check that user can read and write (hence, delete too) to the account ID namespace
    auth0.verifyAuthorizationClaims(request, ["read:photos", "write:photos"]);

    // locate the object in R2
    const objectKey = `usercontent/${account_id}/${image_id}`;

    // remove the object from R2, then from D1 to avoid ghost file storage
    const r2RemovalRequest = await env.imagesBucket.delete(objectKey);
    try {
        r2RemovalRequest;
    } catch (error: any) {
        console.log("[r2]", error)
        console.log("[r2]", "couldn't remove file from R2. Maybe it has never been uploaded but regardless D1 saved it.")
    }

    // set is_deleted to 1 from D1 and update updated_at
    const d1RemovalRequest = await env.imagesDB.prepare("UPDATE images SET is_deleted = ?1, updated_at = ?2 WHERE account_uid_sha256 = ?3 AND original_image_hash = ?4").bind(1, Date.now(), account_id, image_id).run();
    try {
        d1RemovalRequest
    } catch (error: any) {
        console.log("[d1]", error);
        console.log("[d1]", "couldn't mark image as deleted through is_deleted. The image was still likely removed from R2");
    }

    // send the success response
    return edge.handler.createResponse(request, {
        success: true,
        operation: {
            message: "Image and metadata retained for up to 90 days for compliance.",
            operationType: request.method,
        },
        image: d1RemovalRequest.results,
        user
    })
}

const getAccountImageMetadata = async (request: IRequest, env: Env) => {
    const { image_uid } = request.params;
    auth0.verifyAuthorizationClaims(request, ["read:photos"]);
    const { sub } = auth0.parseJwtClaims(request).payload;
    const imageMetadata: DBImage | null = await env.imagesDB.prepare("SELECT * FROM images WHERE id = ?1 AND account_uid = ?2").bind(image_uid, sub).first();
    if (!imageMetadata) {
        let err = new platform.SupportResource(request, "D1_ERROR", 404, {
            description: "The image either does not exist, or belongs to another account."
        });
        return err.throwError();
    };
    let url: string = await signImageViewUrl(imageMetadata, env);
    return edge.handler.createResponse(request, {
        success: true,
        image: {
            ...imageMetadata,
            url,
        },
        user: {
            sub,
        }
    });
}

export {
    uploadPublicImage,
    getAccountImages,
    getAccountImageMetadata,
    deleteAccountImage,
    signImageViewUrl,
    signImageViewUrlLite
}