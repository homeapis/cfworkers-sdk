import { authKit, cryptoKit, handler } from '..';
import { SupportResource } from '../networkKit';
import { D1HlsVideo, QueryParams } from './types';

/**
 * `VideoDataFormatter` Constructor
 */
class VideoDataFormatter {
  videos: Array<D1HlsVideo>;

  constructor(videos: Array<D1HlsVideo>) {
    this.videos = videos;
  }

  getFormattedVideoData() {
    let mainVideoFeedCurator: {
      id: string;
      title: string;
      short_id: string;
      master_playlist_type: string;
      channel_id: string;
      video_length: BigInt | null;
      created_at: string;
      updated_at: string | null;
      owner: string;
      storyboard: {
        snapshot_count: number;
        feature_url: string;
        feature_url_optimized: string;
        formats: string[];
      };
      description: string;
      adaptive: boolean;
      enable_downloads: boolean;
      algorithm: {
        sorting_type: string;
        position: number;
        is_workers_ai: boolean;
        is_inference: boolean;
        score: number;
      };
    }[] = [];

    this.videos.map((video: D1HlsVideo, __index: number) => {
      // video
      let item = {
        id: video.id,
        title: video.title,
        short_id: video.short_id,
        master_playlist_type: video.master_playlist_type,
        channel_id: video.channel_id,
        video_length: video.video_length,
        created_at: video.created_at,
        updated_at: video.updated_at,
        owner: video.owner,
        storyboard: {
          snapshot_count: video.storyboard_image_count,
          feature_url: `https://prod-media-emea.static.homeapis.com/media/storyboards/${video.id}/vframe_${video.storyboard_feature}.jpg`,
          feature_url_optimized: `https://theater.imgix.net/media/storyboards/${video.id}/vframe_${video.storyboard_feature}.jpg?h=720&ar=16%3A9&auto=compress&fm=webp`,
          formats: ['jpg', 'webp']
        },
        description: video.description,
        adaptive: Boolean(video.adaptive),
        enable_downloads: Boolean(video.enable_downloads),
        algorithm: {
          sorting_type: 'random',
          position: __index,
          is_workers_ai: false,
          is_inference: false,
          score: 0 // 0 means data was just randomized
        }
      };

      // push to array
      mainVideoFeedCurator.push(item);
    });

    return mainVideoFeedCurator;
  }
}
/**
 * Create a CDN URL for your user on
 * the `env.WORKER_PUBLIC_STORAGE_HOSTNAME` domain.
 *
 * ONLY WORKS FOR `/images`, use `signVideoPlaybackUrl` to generate
 * signed HLS video URLs.
 * @param user_id
 * @param file_id
 * @param env
 * @returns
 */
const createAuthorizedUrl = async (user_id: string, file_id: string, env: Env) => {
  if (!file_id) return null;

  const expTimestamp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // Expires: A week from now
  const tokenData = `${file_id}-${expTimestamp}`;

  const hmacKey = new TextEncoder().encode(env.HOMEAPIS_OPENSSL_JWT_SECRET_PHOTOS);
  const signature = await cryptoKit.generateSha256Hmac(hmacKey, tokenData);
  const signatureBase64 = btoa(signature);

  return `https://${env.WORKER_PUBLIC_STORAGE_HOSTNAME}/v1/images/${user_id}/${file_id}?exp=${expTimestamp}&hmac_token=${signatureBase64}`;
};
/**
 * Sign a video playback URL on your Public Storage Hostname.
 * Note Cloudflare only allows streaming non-HTML content
 * through its network when purchased
 * as an additional service such as Cloudflare R2,
 * or Cloudflare Stream.
 * @param videoId
 * @param time
 * @param env
 * @returns
 */
const signVideoPlaybackUrl = async (userId: string, videoId: string, time: number, env: Env) => {
  const expTimestamp = Math.floor(Date.now() / 1000) + time; // Expires: A week from now
  const tokenData = `${videoId}-${expTimestamp}`;

  const hmacKey = new TextEncoder().encode(env.VIDEO_DELIVERY_SIGNATURE_SECRET);
  const signature = await cryptoKit.generateSha256Hmac(hmacKey, tokenData);

  return `https://${env.WORKER_PUBLIC_STORAGE_HOSTNAME}/v1/videos/${userId}/${videoId}/output.m3u8?hmac_token=${signature}&token_exp=${expTimestamp}`;
};
/**
 * Send a Video Streaming response to the requesting browser
 * in HLS and fetch the actual video segments and manifest
 * through a secure connection between your Worker and the
 * Custom Domain assigned to your R2 bucket.
 *
 * Your worker should be the same as your bucket's custom domain
 * (`env.WORKER_PUBLIC_STORAGE_HOSTNAME`) and a route should be set up
 * in your `wrangler.toml` file to prevent unauthorized bucket access
 * and only allow requests signed by your Worker.
 * @param request
 * @param env
 * @returns
 */
const createPlaybackResponse = async (request: IRequest, env: Env): Promise<Response> => {
  // gather video credentials in use
  let credentials = {
    hmac: request.params.hmac_token,
    exp: request.params.token_exp,
    videoId: request.params.video_id,
    filename: request.params.file_id
  };

  // Reconstruct the HMAC key using the secure context's
  // WebCrypto API and `SubtleCrypto`
  const tokenData = `${credentials.videoId}-${credentials.exp}`;
  const hmacKey = new TextEncoder().encode(env.VIDEO_DELIVERY_SIGNATURE_SECRET);
  const signature = await cryptoKit.generateSha256Hmac(hmacKey, tokenData);

  // Compare Keys
  if (signature !== credentials.hmac || credentials.exp == undefined) {
    return handler.throwError(
      request,
      ['InvalidHmac', "This video URL isn't signed properly or the signature was revoked."],
      403
    );
  }

  // Signed requests expire.
  // Note that this value should depend on your specific use case
  if (Date.now() / 1000 > parseInt(credentials.exp.toString())) {
    return handler.throwError(
      request,
      [
        'InvalidTimestamp',
        `URL expired at ${new Date(parseInt(credentials.exp) * 1000).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'medium' })}`
      ],
      403
    );
  }

  let request_domain = new URL(request.url).hostname;

  console.log(request_domain);

  let response_url = `https://${env.WORKER_PUBLIC_STORAGE_HOSTNAME}/v1/videos/outputs/${credentials.videoId}/${credentials.filename}`;

  // fetch the video from your R2 bucket's
  // custom domain endpoint (`env.WORKER_PUBLIC_STORAGE_HOSTNAME`)
  // protected by Cloudflare Workers
  // Doesn't require Cloudflare Access.
  const response = await fetch(response_url, {
    method: 'GET',
    headers: {
      'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID,
      'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET,
      ...request.headers
    }
  });
  return response;
};
/**
 * Request video data
 * @param request
 * @param env
 * @returns
 */
const getVideoMetadata = async (request: IRequest, env: Env) => {
  // get auth0 user ID
  let { sub } = authKit.auth0.parseJwtClaims(request).payload;
  let video_id = request.params.show_id;
  let dateNow = Math.floor(Date.now() / 1e3);
  // sign a token expiring in half an hour in seconds
  let token_lifetime = 3600;

  const video: D1HlsVideo | null = await env.mediaDB
    .prepare('SELECT * FROM videos WHERE id = ?1')
    .bind(video_id)
    .first();

  if (!video) {
    return new SupportResource(request, 'D1_ERROR').throwError(env);
  }

  // construct the response
  const metadataResponse = {
    success: true,
    video,
    access: {
      playback_url: await signVideoPlaybackUrl(sub, video.id, token_lifetime, env),
      playback_frame: {
        start: dateNow,
        end: dateNow + token_lifetime // 3600 seconds by default for playback
      }
    }
  };

  return handler.createResponse(request, metadataResponse, 200);
};
/**
 * ## Search feature
 * Find videos by using custom client-set parameters
 */
const filterVideosByParams = async (request: IRequest, env: Env) => {
  // retrieve current user JWT from the Auth0 Access Token
  const user = authKit.auth0.parseJwtClaims(request).payload;

  let newResObject = new Response(request.body);

  const query: QueryParams = await newResObject.json();
  if (!query || !query.fields) return handler.throwError(request, 'PostErr', 500);

  // precise you want to filter by channel_id
  let field = query.fields.find((field) => field.field == 'channel_id');
  if (!field) return handler.throwError(request, 'ChannelNotFound', 404);

  // get videos with `channel_id`
  const db_statement: D1Result<D1HlsVideo> = await env.mediaDB
    .prepare('SELECT * FROM videos WHERE channel_id = ?1')
    .bind(field.value)
    .all();

  if (!db_statement.success) return handler.throwError(request, 'DBWrongQuery', 500);

  // return videos
  const videos = db_statement.results;
  const curator = new VideoDataFormatter(videos);

  return handler.createResponse(request, {
    success: true,
    errors: [],
    results: curator.getFormattedVideoData(),
    user
  });
};
/**
 * Returns a random subset of videos in your `mediaDB` D1 database.
 * Defaults to 10 random entries.
 *
 * This is NOT a standalone router-compatible function as it simply
 * queries the database and passes the results to the caller function.
 * @param env `Env`
 * @param quantity `number`
 * @returns `Promise<D1HlsVideo[]>`
 */
const getRandomVideos = async (env: Env, quantity: number = 10): Promise<D1HlsVideo[]> => {
  const videos: D1Result<D1HlsVideo> = await env.mediaDB
    .prepare('SELECT * FROM videos WHERE RANDOM() LIMIT ?1')
    .bind(quantity)
    .all();
  return videos.results;
};

export {
  createAuthorizedUrl,
  createPlaybackResponse,
  filterVideosByParams,
  getRandomVideos,
  getVideoMetadata,
  signVideoPlaybackUrl,
  VideoDataFormatter
};
