interface ServiceError { code: number | string, type: string, url: string, message?: string }

const supportCodes: Array<ServiceError> = [
    {
        code: "ResourceNotFound", // trying string codes
        type: "SMARTLINKS",
        url: "/platform/smartlinks",
        message: "We could not find the requested smartlink.",
    },
    {
        code: "DestinationNotSpecified", // trying string codes
        type: "PARAMETERS",
        url: "/platform/smartlinks",
        message: "Creating a smartlink requires at least a valid destination URL.",
    },
    {
        code: "ShortIdReserved", // trying string codes
        type: "PARAMETERS",
        url: "/platform/smartlinks",
        message: "The smartlink Short URL you requested is already in use. A random one will be assigned.",
    },
    {
        code: "JWTBearerExpired", // trying string codes
        type: "AUTHORIZATION",
        url: "/platform/identity",
        message: "The provided JWT token expired a while ago.",
    },
    {
        code: "JWTBearerInvalid", // trying string codes
        type: "AUTHORIZATION",
        url: "/platform/identity",
        message: "The provided JWT claims could not be cryptographically verified using our public key.",
    },
    {
        code: "JWTBearerNotFound", // trying string codes
        type: "AUTHORIZATION",
        url: "/platform/identity",
        message: "This endpoint expected a signed JWT (JSON Web Token) Bearer token for authorization but could not find it. Check your 'Authorization' header.",
    },
    {
        code: "JWTBearerNotFound", // trying string codes
        type: "AUTHORIZATION",
        url: "/platform/identity",
        message: "This endpoint expected a signed JWT (JSON Web Token) Bearer token for authorization but could not find it. Check your 'Authorization' header.",
    },
    {
        code: 101,
        type: "D1_ERROR",
        url: "/reference/api#cloudflare-database-error"
    },
    {
        code: "D1_ERROR",
        type: "D1_ERROR",
        url: "/reference/api#cloudflare-database-error"
    },
    {
        code: 101,
        type: "D1_ERROR",
        url: "/reference/api#cloudflare-database-error"
    },
    {
        code: 1012,
        type: "SERVICE_ERROR",
        url: "/reference/api"
    },
    {
        code: 1336,
        type: "AUTHENTICATION",
        message: "Token either was missing or rejected as it failed to pass expected security checks.",
        url: "/identity/universal"
    },
    {
        code: 999,
        type: "STREAMING",
        message: "For security reasons, access to this video streaming endpoint is currently limited to internal client IP addresses.",
        url: "/video"
    },
    {
        code: 1337,
        type: "AUTHENTICATION",
        message: "The submitted token failed our automated verification checks. This error can happen when you're using an invalid token to request issuance of a Developer Token",
        url: "/identity/universal"
    },
    {
        code: 1030,
        type: "DEPRECATED_FUNCTION",
        message: "This domain no longer serves previous versions of the Cloud API. Please see the included article for more information.",
        url: "/reference/api/notes#api-v2-deprecated"
    },
    {
        code: "VIDEO_SERVICE_DEPRECATED",
        type: "VIDEO_SERVICE_DEPRECATED",
        message: "This API was part of the Video family of services and is no longer available.",
        url: "/platform/api"
    },
]

export { supportCodes as Errors };
export type { ServiceError };