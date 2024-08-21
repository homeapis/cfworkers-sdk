import { IRequest } from "itty-router";

/**
 * Handle runtime errors
 * @param req request payload
 * @param message error message
 * @param code internal error code
 * @param status response HTTP status
 * @param options additional response settings like HTTP headers
 * @returns the response at the edge
 */
export function throwError (req: IRequest, code: Array<any> | string, status?: number, options?: {
    headers?: HeadersInit
}): Response {
    let error_body = {
        success: false,
        errors: code,
        version: "4.0.0-beta"
    }

    return createResponse(req, error_body, status, { headers: { "Content-Language": 'en-US' }, ...options?.headers })
}

function defaultApiResponseHeaders(request: IRequest, headers?: HeadersInit) {
    return {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": `application/json; charset=utf-8`,
        "X-BSS-Playback-Region-Scheme": (`${(request.cf?.colo || "").toString()}.${(request.cf?.country || "").toString()}.edge.blkdwrf.net`).toLowerCase(),
        "X-BSS-Playback-Region-Timezone": (request.cf?.timezone || "").toString(),
        ...headers
    }
}

export function createResponse(request: IRequest, response: any, statusCode?: number,
    options?: {
        cacheTtl?: number; // Time to cache responses on CF
        headers?: HeadersInit; // Additional Headers
    }): Response {

    if (request.query.debug !== undefined) {
        return new Response(JSON.stringify(response, null, 2), {
            status: statusCode || 200,
            headers: defaultApiResponseHeaders(request, { "Content-Language": "en-US", "X-HomeAPIs-Neat-Debug": "Neat-UI" })
        });
    } else {
        return new Response(JSON.stringify(response), {
            status: statusCode || 200,
            headers: defaultApiResponseHeaders(request, options?.headers)
        });
    }
}