import { IRequestStrict } from 'itty-router';
import { GenericTraps } from 'itty-router/types/GenericTraps';

/**
 * The Cloudflare Workers runtime requires some specific type definitions, which are artificially used for this package to function.
 */
declare global {
  /**
   * The Cloudflare-specific [`caches.default`](https://developers.cloudflare.com/workers/runtime-apis/cache/#accessing-cache) object, providing a non-standard `CacheStorage` interface.
   */
  interface CacheStorage {
    default: {
      put(request: Request | string, response: Response): Promise<undefined>;
      match(request: Request | string): Promise<Response | undefined>;
      delete(request: Request | string, options?: any): Promise<Response | undefined>;
    };
  }

  /**
   * See the [Env](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/#parameters) parameter in Cloudflare Workers.
   */
  interface Env {
    /**
     * The [D1 database binding](https://developers.cloudflare.com/d1/get-started/) used for storing images in Cloudflare R2.
     */
    imagesDB: D1Database;
    mediaDB: D1Database;
    supportDB: D1Database;
    // Hostname
    SUPPORT_WEBSITE_BASE_URL: string;
    WORKER_PUBLIC_HOSTNAME: string;
    WORKER_PUBLIC_STORAGE_HOSTNAME: string;
    // Environment Secrets
    // to use with the wrangler secrets API
    // Never write your secrets in plaintext in Wrangler.toml
    /**
     * **VIDEO_DELIVERY_SIGNATURE_SECRET**
     *
     * Generate a 32-byte hex secret with `openssl rand -hex 32`
     * to sign video hmac tokens for secure `.m3u8` HLS video delivery.
     */
    VIDEO_DELIVERY_SIGNATURE_SECRET: string;
    [key: string]: any;
  }

  /**
   * List of public Cloudflare colocations.
   * You can access the current one through the
   * `request.cf` special object in Workers.
   */
  interface DataColocation {
    colo_id?: number;
    colo_name?: string;
    colo_alias?: string;
    colo_city?: string;
    colo_state?: string;
    colo_note?: string;
    colo_status?: string;
    colo_region?: string;
    colo_code?: string;
    isp_id?: string;
    tier?: string;
    edge?: string;
  }

  /**
   * [ittyRouter](https://itty.dev)'s `IRequest` type definition
   * describing what information the router passes to submodules
   * and `internal-cfworkers-sdk` functions.
   */
  type IRequest = IRequestStrict & GenericTraps;
}
