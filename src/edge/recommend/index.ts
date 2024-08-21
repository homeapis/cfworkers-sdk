import { IRequest } from 'itty-router';
import { auth0, edge } from '../..';
import Env from '../env';
import { D1OrkaCloudVideo } from '../orka/types';

class VideoDataFormatter {
  videos: Array<D1OrkaCloudVideo>;

  constructor(videos: Array<D1OrkaCloudVideo>) {
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

    this.videos.map((video: D1OrkaCloudVideo, __index: number) => {
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
 * Retrieve content for the trending tab
 * @param env environment variables
 */
const getRandomOrkaEntries = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
  const cacheUrl = request.url;

  // Construct the cache key from the cache URL
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cache = caches.default;

  // Check whether the value is already available in the cache
  // if not, you will need to fetch it from origin, and store it in the cache

  let response = (await cache.match(cacheKey)) as Response;
  let videos: Array<D1OrkaCloudVideo> | any = [];

  // load user profile
  const authuser = auth0.parseJwtClaims(request);

  if (!response) {
    // Establish connection to the DB
    const db_statement: D1Result<D1OrkaCloudVideo> = await env.ORKA_VIDEO_DB.prepare(
      'SELECT * FROM videos WHERE RANDOM() LIMIT 10'
    ).all();

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
            ...authuser.payload
          },
          ...db_statement.meta
        }
      });
    }

    response.headers.set('Cache-Control', 's-maxage=60');
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  } else {
    console.log(`Cache hit for: ${request.url}.`);
  }

  return response;
};

export { getRandomOrkaEntries, VideoDataFormatter };
