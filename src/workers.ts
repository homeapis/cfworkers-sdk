import { IRequestStrict } from "itty-router";
import { GenericTraps } from "itty-router/types/GenericTraps";

export { };

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
        [key: string]: any;
    }

    /**
     * [ittyRouter](https://itty.dev)'s `IRequest` type definition
     * describing what information the router passes to submodules
     * and `internal-cfworkers-sdk` functions.
     */
    type IRequest = IRequestStrict & GenericTraps;
}
