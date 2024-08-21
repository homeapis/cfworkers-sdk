import { platform } from '..';
import { edge } from '..';
import { ApiScope } from './scope';

const middleware = async (request: IRequest) => {
  /**
   * Check wether the request includes a proper JWT
   * Allows passing token in URL for dev purpose
   * via the access_token parameter
   */
  let jwt = request.headers.get('authorization')?.substring(7) || request.query.access_token?.toString();
  if (!jwt) {
    let troubleshoot = new platform.SupportResource(request, 'JWTBearerNotFound', 401, {
      isAuth0Backend: true
    });
    return troubleshoot.throwError();
  }

  /**
   * Perform authorization
   * Please note some security features are to be implemented
   * such as access based on audience claims
   */
  const isValid = await verifyAuth(jwt);
  if (!isValid) {
    let troubleshoot = new platform.SupportResource(request, 'JWTBearerInvalid', 401, {
      isAuth0: true
    });
    return troubleshoot.throwError();
  }

  /**
   * Check the exp time to see if it has already expired
   */
  const isLive = Math.floor(Date.now() / 1e3) <= (edge.jwt.decode(jwt).payload.exp as number);
  if (!isLive) {
    let troubleshoot = new platform.SupportResource(request, 'JWTBearerExpired', 403, {
      isAuth0: true
    });
    return troubleshoot.throwError();
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

const getPublicSigningKey = async (authorizationBearer: string) => {
  /**
   * get the Key Id (kid) from the JWT header
   */
  const kid = edge.jwt.decode(authorizationBearer).header.kid;

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
 * Verifies the JWT against the public key
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
const onValidAuthResponse = (request: IRequest) => {
  const isValid = verifyAuthorizationClaims(request, ['email', 'profile']);
  let jwt = request.headers.get('authorization')?.substring(7) || request.query.access_token?.toString();
  if (!jwt || !isValid) {
    let troubleshoot = new platform.SupportResource(request, 'JWTBearerNotFound', 401, {
      isAuth0Backend: true
    });
    return troubleshoot.throwError();
  }

  return edge.handler.createResponse(request, {
    success: true,
    auth: edge.jwt.decode(jwt),
    access: []
  });
};

const parseJwtClaims = (request: IRequest): edge.jwt.JwtData => {
  let jwt =
    (request.headers.get('authorization')?.substring(7) as string) ||
    (request.query.access_token?.toString() as string);
  let parse = edge.jwt.decode(jwt);

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
const verifyAuthorizationClaims = (request: IRequest, scope: ApiScope[]) => {
  let jwt = request.headers.get('authorization')?.substring(7) || request.query.access_token?.toString();
  if (!jwt) {
    let troubleshoot = new platform.SupportResource(request, 'JWTBearerNotFound', 401, {
      isAuth0Backend: true
    });
    return troubleshoot.throwError();
  }

  let jwtProvidedScope = edge.jwt.decode(jwt).payload.scope;

  // turn into array
  const jwtScope: ApiScope[] = jwtProvidedScope.split(' ');

  // iterate through the api-provided array to find non matching values
  scope.map((requiredScope: ApiScope) => {
    // throw error on false
    if (!jwtScope.includes(requiredScope)) {
      return edge.handler.throwError(
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

export {
  middleware, 
  getPublicSigningKey, 
  verifyAuth, 
  onValidAuthResponse,
  parseJwtClaims, 
  verifyAuthorizationClaims
};

export type { ApiScope };