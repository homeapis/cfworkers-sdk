import { IRequest } from 'itty-router';
import { edge, platform } from '../..';
import Env from '../env';

/**
 * Generate application-specific tokens
 * method: GET
 * @param request
 * @param env
 * @returns
 */
const generateApplicationToken = async (request: IRequest, env: Env) => {
  const service_id = request.params.service_id;

  // uses the new SupportResource class to handle errors
  const authError = new platform.SupportResource(request, 1337);

  // retrieve access identity
  const authuser: any = await edge.video.readOrkaJwtPayload(request, env);
  if (!authuser) return authError.throwError();

  // Get permissions
  const authuser_jwt_payload = {
    email: authuser.payload.email,
    iss: 'gateway.homeapis.com',
    aud: [`${service_id}.iam.homeapis.com`].concat(authuser.payload.aud).toString(),
    sub: authuser.payload.sub,
    nbf: Math.floor(Date.now() / 10 ** 3),
    iat: Math.floor(Date.now() / 10 ** 3),
    exp: Math.floor(Date.now() / 10 ** 3) + 60 * 60,
    name: `${service_id}-medium`,
    props: {
      is_premium: true,
      subscribption: {
        is_active: true,
        renewal: Math.floor(Date.now() / 10 ** 3) + 60 * 60 * 24 * 31
      }
    }
  };

  // sign platform token
  const token = await edge.jwt.sign(authuser_jwt_payload, env.ORKA_DEMO_SIGNING_KEY);

  return edge.handler.createResponse(request, {
    jwt: token,
    payload: authuser_jwt_payload
  });
};

export { generateApplicationToken };
