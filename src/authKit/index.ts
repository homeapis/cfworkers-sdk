import { handler, jwtKit as jwt } from '..';
import { SupportResource } from '../networkKit';
import { ApiScope } from './scope';
/**
 * Automatically validate the authentication
 * and authorization of a user through their
 * Auth0 access token. Then access the next function.
 * @param request
 * @returns
 */
const middleware = async (request: IRequest, env: Env) => {
  /**
   * Check wether the request includes a proper JWT
   * Allows passing token in URL for dev purpose
   * via the access_token parameter
   */
  let auth0Jwt = request.headers.get('authorization')?.substring(7) || request.query.access_token?.toString();
  if (!auth0Jwt) {
    let troubleshoot = new SupportResource(request, 'JWTBearerNotFound', 401, {
      isAuth0Backend: true
    });
    return troubleshoot.throwError(env);
  }

  /**
   * Perform authorization
   * Please note some security features are to be implemented
   * such as access based on audience claims
   */
  const isValid = await verifyAuth(auth0Jwt);
  if (!isValid) {
    let troubleshoot = new SupportResource(request, 'JWTBearerInvalid', 401, {
      isAuth0: true
    });
    return troubleshoot.throwError(env);
  }

  /**
   * Check the exp time to see if it has already expired
   */
  const isLive = Math.floor(Date.now() / 1e3) <= (jwt.decode(auth0Jwt).payload.exp as number);
  if (!isLive) {
    let troubleshoot = new SupportResource(request, 'JWTBearerExpired', 403, {
      isAuth0: true
    });
    return troubleshoot.throwError(env);
  }
  /**
   * else, the auth is to be considered valid
   * Next functions can now consider the token valid
   * However, they must ensure the user has proper access
   * to the different requested functions
   * by checking for the scope param of the token header
   */
  return;
};
/**
 * retrieve your auth0 signing key from
 * `https://{your_domain}.auth0.com/.well-known/jwks.json`
 * @param authorizationBearer
 * @returns
 */
const getPublicSigningKey = async (authorizationBearer: string) => {
  /**
   * get the Key Id (kid) from the JWT header
   */
  const kid = jwt.decode(authorizationBearer).header.kid;
  /**
   * Retrieve the current keys from the JWKs endpoint on Auth0.com
   * And cache it within CF for an hour to avoid rate limiting issues
   */
  let jwksEndpoint = 'https://homeapis.eu.auth0.com/.well-known/jwks.json';
  const res = await fetch(jwksEndpoint, {
    cf: {
      cacheTtl: 3600,
      cacheKey: jwksEndpoint
    }
  }).then((keys: any) => keys.json());
  /**
   * Parse the content to retrieve the appropriate key
   */
  const { keys } = await res;
  const jwk = keys.find((key: any) => key.kid === kid);
  const publicKey = crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
    'verify'
  ]);
  return publicKey;
};
/**
 * Verify the JWT against the public key
 * issued by Auth0
 * @param jwtBase64
 * @returns Boolean
 */
const verifyAuth = async (jwtBase64: string) => {
  // isolate parts of the token
  const [rawHeader, rawPayload, rawSignature] = jwtBase64.trim().split('.');

  // get key that was used to sign the JWT
  const key = await getPublicSigningKey(jwtBase64);

  // get signature in Base64Url
  let signature: any = atob(rawSignature.replace(/_/g, '/').replace(/-/g, '+'));
  signature = new Uint8Array(Array.from(signature).map((c: any) => c.charCodeAt(0)));

  const content = new TextEncoder().encode([rawHeader, rawPayload].join('.'));

  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, content);
};
/**
 * For testing purposes
 * Sends a success response after valid authMiddleware pass
 */
const onValidAuthResponse = (request: IRequest, env: Env) => {
  const isValid = verifyAuthorizationClaims(request, env, ['email', 'profile']);
  let auth0Jwt = request.headers.get('authorization')?.substring(7) || request.query.access_token?.toString();
  if (!auth0Jwt || !isValid) {
    let troubleshoot = new SupportResource(request, 'JWTBearerNotFound', 401, {
      isAuth0Backend: true
    });
    return troubleshoot.throwError(env);
  }
  return handler.createResponse(request, {
    success: true,
    auth: jwt.decode(auth0Jwt),
    access: []
  });
};

const parseJwtClaims = (request: IRequest): jwt.JwtData => {
  let auth0Jwt =
    (request.headers.get('authorization')?.substring(7) as string) ||
    (request.query.access_token?.toString() as string);
  let parse = jwt.decode(auth0Jwt);
  return parse;
};

/**
 * Returns `false` if the requested scope
 * isn't fully granted by the token in use
 * true if the token allows app use
 * @param request
 * @param scope
 * @returns Boolean
 */
const verifyAuthorizationClaims = (request: IRequest, env: Env, scope: ApiScope[]) => {
  let auth0Jwt = request.headers.get('authorization')?.substring(7) || request.query.access_token?.toString();
  if (!auth0Jwt) {
    let troubleshoot = new SupportResource(request, 'JWTBearerNotFound', 401, {
      isAuth0Backend: true
    });
    return troubleshoot.throwError(env);
  }
  let jwtProvidedScope = jwt.decode(auth0Jwt).payload.scope;
  // turn into array
  const jwtScope: ApiScope[] = jwtProvidedScope.split(' ');
  // iterate through the api-provided array to find non matching values
  scope.map((requiredScope: ApiScope) => {
    // throw error on false
    if (!jwtScope.includes(requiredScope)) {
      return handler.throwError(
        request,
        [
          'Unauthorized',
          `This endpoint requires a scope that is not granted by your access token.`,
          {
            scope: {
              required: scope,
              provided: jwtScope
            }
          }
        ],
        403,
        {
          headers: {
            'x-home-idp': 'Auth0'
          }
        }
      );
    }
    return;
  });
  // if all the permissions are granted
  return true;
};

const auth0 = {
  middleware,
  getPublicSigningKey,
  verifyAuth,
  onValidAuthResponse,
  parseJwtClaims,
  verifyAuthorizationClaims
};

export { auth0 };
export type { ApiScope };
