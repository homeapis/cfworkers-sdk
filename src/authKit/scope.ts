const scopes = [
  'openid',
  'profile',
  'offline_access',
  'email',
  'read:subscriptions',
  'read:photos',
  'write:photos',
  'read:links',
  'write:links',
  'read:support',
  'write:support'
] as const;

/**
 * Defines the accepted scopes for the different APIs
 * available through gateway.
 */
export type ApiScope = (typeof scopes)[number];
