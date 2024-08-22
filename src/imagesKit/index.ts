import { authKit, cryptoKit, handler } from '..';
import { SupportResource } from '../networkKit';

/**
 * Signs an Image URL for use with your storage Worker
 * for the client to use for up to a week (defaults
 * to a day).
 */
const signImageViewUrlLite = async (
  image_id: string,
  account_uid_sha256: string,
  env: Env,
  time: number = 86400
): Promise<String> => {
  const expTimestamp = Math.floor(Date.now() / 1000) + time; // Expires: A day from now
  const tokenData = `${image_id}-${expTimestamp}`;

  const hmacKey = new TextEncoder().encode(env.HOME_PHOTOS_SECRET);
  const signature = await cryptoKit.generateSha256Hmac(hmacKey, tokenData);
  // const signatureBase64 = btoa(signature);

  return `https://${env.WORKER_PUBLIC_STORAGE_HOSTNAME}/v1/images/${account_uid_sha256}/${image_id}?hmac_token=${signature}&token_exp=${expTimestamp}`;
};
/**
 * New function to sign images for use with your
 * Storage Worker (`env.WORKER_PUBLIC_STORAGE_HOSTNAME`).
 *
 * Storage workers use another `@homeapis/storage-worker`
 * package, or `npx create @homeapis/storage-worker` to generate
 * and deploy a boilerplate worker.
 * @param image
 * @param time
 * @param env
 * @returns
 */
const signImageViewUrl = async (image: DBImage, env: Env, time: number = 86400) => {
  const expTimestamp = Math.floor(Date.now() / 1000) + time; // Expires: A day from now
  const tokenData = `${image.id}-${expTimestamp}`;

  const hmacKey = new TextEncoder().encode(env.HOME_PHOTOS_SECRET);
  const signature = await cryptoKit.generateSha256Hmac(hmacKey, tokenData);
  // const signatureBase64 = btoa(signature);

  return `https://${env.WORKER_PUBLIC_STORAGE_HOSTNAME}/v1/images/${image.account_uid_sha256}/${image.id}?hmac_token=${signature}&token_exp=${expTimestamp}`;
};
/**
 * Fetch public URL and upload it to R2, while
 * saving metadata to `imagesDB` D1 database
 * @param request
 * @param env
 * @param ctx
 * @returns
 */
const uploadPublicImage = async (request: IRequest, env: Env) => {
  const { image }: ImageBody = await request.json();

  const user = authKit.auth0.parseJwtClaims(request).payload;
  let canUploadImages = authKit.auth0.verifyAuthorizationClaims(request, env, ['read:photos', 'write:photos']);

  const imageResource = await fetch(image.url, {
    method: 'GET'
  });

  let imageResponseData = imageResource.clone();
  let imageDataFinal = imageResource.clone();

  const uidMapping = await cryptoKit.hashSha256(user.sub as string);
  const imageVersionHash = await cryptoKit.digest.hashReadableStreamSha256(imageResource.body as ReadableStream<any>);

  const versionAlreadyExists: DBImage | null = await env.imagesDB
    .prepare('SELECT * FROM images WHERE original_image_hash = ?1 AND account_uid_sha256 = ?2')
    .bind(imageVersionHash, uidMapping)
    .first();

  if (versionAlreadyExists !== null) {
    return handler.createResponse(request, {
      success: false,
      errors: ['The exact same file was already uploaded to your account.'],
      image: {
        url: await signImageViewUrl(versionAlreadyExists, env),
        ...versionAlreadyExists
      }
    });
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
    is_deleted: 0
  };

  console.log('[SAVE]', imageProperties);

  const d1MetadataUpload = await env.imagesDB
    .prepare(
      'INSERT INTO images (id, created_at, updated_at, original_image_url, original_image_hash, original_size, account_uid, account_uid_sha256, is_moderated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)'
    )
    .bind(
      imageProperties.id,
      imageProperties.created_at,
      imageProperties.updated_at,
      imageProperties.original_image_url,
      imageProperties.original_image_hash,
      imageProperties.original_size,
      imageProperties.account_uid,
      imageProperties.account_uid_sha256,
      imageProperties.is_moderated
    )
    .run();

  if (!d1MetadataUpload.success) {
    return handler.createResponse(
      request,
      {
        success: false,
        errors: ['Illegal request. Upload registration failed.']
      },
      403
    );
  }

  const objectKey = `usercontent/${imageProperties.account_uid_sha256}/${imageProperties.id}`;

  await env.imagesBucket
    .put(objectKey, imageDataFinal.body, {
      httpMetadata: {
        contentType: imageDataFinal.headers.get('Content-Type') || 'NULL'
      },
      customMetadata: {
        'X-IMG-SOURCE': 'proxy',
        'X-IMG-CANONICAL': imageProperties.original_image_url
      },
      sha256: imageProperties.original_image_hash
    })
    .then(() => {
      // Successful upload
      console.log('[upload]', 'File was successfully saved to user account.');
    })
    .catch((error: any) => {
      console.error('Error uploading image:', error);
      // Handle the error based on its type or message
      return handler.throwError(request, ['CouldNotSaveImage', 'Failed to fetch from distant origin.']);
    });

  return handler.createResponse(
    request,
    {
      image: {
        ...imageProperties,
        url: await signImageViewUrl(imageProperties, env)
      },
      account: {
        canUploadImages,
        user
      }
    },
    200
  );
};

const getAccountImages = async (request: IRequest, env: Env) => {
  const user = authKit.auth0.parseJwtClaims(request).payload;
  const offset = parseInt(request.query.start as string) || 0;

  // make sure the user is allowed to [read:photos]
  authKit.auth0.verifyAuthorizationClaims(request, env, ['read:photos']);

  const response: D1Result<DBImage> = await env.imagesDB
    .prepare('SELECT * FROM images WHERE account_uid = ?1 LIMIT 10 OFFSET ?2')
    .bind(user.sub, offset)
    .all();

  const getSignedImages = async (images: DBImage[]) =>
    await Promise.all(
      images.map(async (image): Promise<any> => {
        return {
          ...image,
          url: await signImageViewUrl(image, env)
        };
      })
    );

  return handler.createResponse(request, {
    success: true,
    images: await getSignedImages(response.results),
    user: {
      ...user
    },
    messages: [
      {
        locale: 'en-US',
        title: 'Storage',
        type: 'info',
        text: 'An cloud storage limit of 1 GB per account will now apply to Photos. Content uploaded before August 5, 2024 does not count towards that limit, unless it is deleted and reuploaded. Paid plans will be available for additional storage capacity.',
        time: new Date().toISOString()
      }
    ]
  });
};
/**
 * Handle authorized `DELETE` requests and proceed
 * by removing the image from storage, then deactivating
 * futher access to it in D1.
 */
const deleteAccountImage = async (request: IRequest, env: Env) => {
  const { account_id, image_id } = request.params;

  const user = authKit.auth0.parseJwtClaims(request).payload;

  // check that user can read and write (hence, delete too) to the account ID namespace
  authKit.auth0.verifyAuthorizationClaims(request, env, ['read:photos', 'write:photos']);

  // locate the object in R2
  const objectKey = `usercontent/${account_id}/${image_id}`;

  // remove the object from R2, then from D1 to avoid ghost file storage
  const r2RemovalRequest = await env.imagesBucket.delete(objectKey);
  try {
    r2RemovalRequest;
  } catch (error: any) {
    console.log('[r2]', error);
    console.log('[r2]', "couldn't remove file from R2. Maybe it has never been uploaded but regardless D1 saved it.");
  }

  // set is_deleted to 1 from D1 and update updated_at
  const d1RemovalRequest = await env.imagesDB
    .prepare(
      'UPDATE images SET is_deleted = ?1, updated_at = ?2 WHERE account_uid_sha256 = ?3 AND original_image_hash = ?4'
    )
    .bind(1, Date.now(), account_id, image_id)
    .run();
  try {
    d1RemovalRequest;
  } catch (error: any) {
    console.log('[d1]', error);
    console.log(
      '[d1]',
      "couldn't mark image as deleted through is_deleted. The image was still likely removed from R2"
    );
  }

  // send the success response
  return handler.createResponse(request, {
    success: true,
    operation: {
      message: 'Image and metadata retained for up to 90 days for compliance.',
      operationType: request.method
    },
    image: d1RemovalRequest.results,
    user
  });
};
/**
 * Returns metadata for a given `image_hash`
 * @param request
 * @param env
 * @returns
 */
const getAccountImageMetadata = async (request: IRequest, env: Env) => {
  const { image_uid } = request.params;
  authKit.auth0.verifyAuthorizationClaims(request, env, ['read:photos']);
  const { sub } = authKit.auth0.parseJwtClaims(request).payload;
  const imageMetadata: DBImage | null = await env.imagesDB
    .prepare('SELECT * FROM images WHERE id = ?1 AND account_uid = ?2')
    .bind(image_uid, sub)
    .first();
  if (!imageMetadata) {
    let err = new SupportResource(request, 'D1_ERROR', 404, {
      description: 'The image either does not exist, or belongs to another account.'
    });
    return err.throwError(env);
  }
  let url: string = await signImageViewUrl(imageMetadata, env);
  return handler.createResponse(request, {
    success: true,
    image: {
      ...imageMetadata,
      url
    },
    user: {
      sub
    }
  });
};

export {
  uploadPublicImage,
  getAccountImages,
  getAccountImageMetadata,
  deleteAccountImage,
  signImageViewUrl,
  signImageViewUrlLite
};
