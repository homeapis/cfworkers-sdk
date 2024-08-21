import { IRequest } from "itty-router"
import Env from "../../@homeapis/cloudflare-edge/env"
import { auth0, edge, platform } from "../d";

// define allowed patterns
const urlRegex = /^(https?|ftps?):\/\/(([a-z\d]([a-z\d-]*[a-z\d])?\.)+[a-z]{2,}|localhost)(\/[-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?(\#[-a-z\d_]*)?$/i;
const urlSlugRegex = /^[aA-z-Z0-9]+(?:(?:-|_)+[a-z0-9]+)*$/i;

function generateRandomHexString(numBytes: number) {
    const bytes = crypto.getRandomValues(new Uint8Array(numBytes));
    const array = Array.from(bytes);
    const hexPairs = array.map(b => b.toString(16).padStart(2, '0'));
    return hexPairs.join('')
}
export interface ClientShortlink {
    id: string,
    destination: string,
    shortlink: string,
    created_at: string,
    updated_at: string | null,
    account: any,
};
interface ClientShortlinkResponse {
    success: boolean,
    link: ClientShortlink,
};
interface DbShortlink {
    id: string;
    destination: string;
    shortId: string;
    createdAt: number;
    updatedAt?: number;
    accountUid: string;
};
interface ShortlinkRequest {
    link: {
        destination: string;
        customSlug?: string;
    }
};
/**
 * Returns prepared version
 * @param smartlinks
 * @returns 
 */
const parseDBSmartlinks = (smartlinks: DbShortlink[]) => {
    return smartlinks.map(smartlink => {
        return {
            id: smartlink.id,
            destination: smartlink.destination,
            shortlink: `https://lavndr.xyz/${smartlink.shortId}`,
            shortId: smartlink.shortId,
            created_at: new Date(smartlink.createdAt).toISOString(),
            updated_at: new Date(smartlink.updatedAt as number).toISOString() || null,
            account: smartlink.accountUid,
        }
    });
}
/**
 * Register smartlinks
 * @param request 
 * @param env 
 */
const createSmartlink = async (request: IRequest, env: Env) => {
    // check permissions
    auth0.verifyAuthorizationClaims(request, ["read:links", "write:links"]);
    // parse request body
    const payload: ShortlinkRequest = await request.json();
    // check for errors
    let isValid = urlRegex.test(payload.link.destination);
    if (!isValid) {
        const errorHandler = new platform.SupportResource(request, "DestinationNotSpecified", 401, {
            validRegex: isValid,
        });
        // throw auto-generated error
        errorHandler.throwError();
    };
    // get account sub / uid
    const accountUid = auth0.parseJwtClaims(request).payload.sub as string;
    // if valid, create smartlink
    let random6ByteShortId = generateRandomHexString(6);
    let createdAt = Date.now();
    const link: DbShortlink = {
        id: random6ByteShortId,
        shortId: payload.link.customSlug || random6ByteShortId,
        createdAt,
        destination: payload.link.destination,
        accountUid,
    };
    // check availability of slug
    if(!urlSlugRegex.test(link.shortId)) {
        return Response.json({
            success: false,
            errors: [
                "The requested regular expression is denied as per your organization's policy."
            ],
        })
    };
    let isAvailable: boolean = true;
    const availabilityCheck: DbShortlink | null = await env.campaignsDB.prepare('SELECT * FROM Smartlinks WHERE shortId = ?1').bind(link.shortId).first();
    let shortlink: D1Result<ClientShortlink> = await env.campaignsDB.prepare('INSERT INTO Smartlinks (id, destination, shortId, createdAt, accountUid) VALUES (?1, ?2, ?3, ?4, ?5)').bind(link.id, link.destination, link.shortId, link.createdAt, link.accountUid).run();
    if (availabilityCheck?.shortId !== null) {
        // edit short prop
        shortlink = await env.campaignsDB.prepare('INSERT INTO Smartlinks (id, destination, shortId, createdAt, accountUid) VALUES (?1, ?2, ?3, ?4, ?5)').bind(link.id, link.destination, link.id, link.createdAt, link.accountUid).run();
        // set to false
        isAvailable = false;
    };
    // generate it to D1
    if (shortlink.success) {
        let preresponse: ClientShortlinkResponse = {
            success: true,
            link: {
                id: link.id,
                destination: link.destination,
                shortlink: `https://lavndr.xyz/${isAvailable ? link.shortId : link.id}`,
                created_at: new Date().toISOString(),
                updated_at: null,
                account: accountUid,
            }
        };
        return edge.handler.createResponse(request, preresponse, 200);
    } else {
        let err = new platform.SupportResource(request, "D1_ERROR", 401);
        err.throwError();
    }
};
/**
 * List smartlinks
 */
const listSmartlinks = async (request: IRequest, env: Env) => {
    // check authorization
    auth0.verifyAuthorizationClaims(request, ["read:links"]);
    const { sub } = auth0.parseJwtClaims(request).payload;
    // list links
    const { success, results }: D1Result<DbShortlink> = await env.campaignsDB.prepare('SELECT * FROM Smartlinks WHERE accountUid = ?1 LIMIT 50').bind(sub).all();
    if (!success) {
        let err = new platform.SupportResource(request, "D1_ERROR", 401);
        err.throwError();
    }
    return edge.handler.createResponse(request, {
        success: true,
        results: parseDBSmartlinks(results),
    })
};
/**
 * Follow shortlink API
 */
const followSmartlink = async (request: IRequest, env: Env) => {
    const { shortId } = request.params;
    // get shortlink
    const link: DbShortlink | null = await env.campaignsDB.prepare('SELECT * FROM Smartlinks WHERE shortId = ?1').bind(shortId).first();
    if (!link) {
        return new platform.SupportResource(request, "ResourceNotFound", 404).throwError();
    } else {
        // return new Response(link.destination, {
        //     status: 200,
        //     headers: {
        //         "Content-Type": "text/html; charset=utf-8",
        //     }
        // });
        return Response.redirect(link.destination, 302);
    }
};
/**
 * Delete smartlink
 */
const deleteSmartlink = async (request: IRequest, env: Env) => {
    const { shortId } = request.params;
    // check auth claims
    auth0.verifyAuthorizationClaims(request, ["read:links", "write:links"]);
    // delete shortlink
    const link: D1Result = await env.campaignsDB.prepare('DELETE FROM Smartlinks WHERE shortId = ?1').bind(shortId).run();
    if (!link) {
        return new platform.SupportResource(request, "ResourceNotFound", 404).throwError();
    } else {
        return edge.handler.createResponse(request, {
            success: true,
            message: "Link was successfully removed."
        });
    }
};

export {
    createSmartlink,
    listSmartlinks,
    followSmartlink,
    deleteSmartlink
}