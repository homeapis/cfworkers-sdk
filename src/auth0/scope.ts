/**
 * Defines the accepted scopes for the different APIs
 * available through gateway
 */
const scopes = [
    'openid',
    'profile',
    'offline_access',
    'email',
    'read:subscriptions',
    'read:photos',
    'write:photos',
    'read:links',
    'write:links'
] as const


export type ApiScope = typeof scopes[number];