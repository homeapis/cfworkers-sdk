import { handler } from '..';
import { Errors, ServiceError } from './errorKit';

/**
 * Pull known Cloudflare colocation centers in JSON
 * through fetch to save on your worker's size
 */
async function pullCloudflareColocationData(): Promise<DataColocation[]> {
  let dataUrl =
    'https://gist.githubusercontent.com/gorgeousawakening/48920cd5a6c27994a103ecc67e1f1268/raw/10730dd43b15e6e120d3ea37052d642247c1d098/cf_colocations.json';
  const colocations: DataColocation[] = await fetch(dataUrl).then((data) => data.json());
  return colocations;
}
/**
 * Pulls metadata about the current Cloudflare data center (e.g., Country's full name, ISO, as well as additional data).
 * @param code colocation code returned
 * by [`request.cf.colo`](https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties) on `IncomingRequestCfProperties`.
 */
async function getEdgeLocation(code: string): Promise<DataColocation | null> {
  const edgeLocations = await pullCloudflareColocationData();
  const colocation = edgeLocations.find((colo) => colo.colo_code === code);
  if (!colocation?.colo_id) return null;
  return colocation;
}
/**
 * Subset of `IncomingRequestCfProperties` properties.
 */
interface TraceClientRequestParams {
  city?: string;
  colo?: string;
  continent?: string;
  asn?: string;
  asOrganization?: string;
}
const traceClientRequest = async (request: IRequest) => {
  // let newReq = new Response(request.body)
  // let query = await newReq.json();

  return handler.createResponse(request, {
    data: {
      cf: request.cf
    }
  });
};
/**
 * Constructor to throw errors
 */
class SupportResource {
  code: number | string;
  request: IRequest;
  serviceError: ServiceError;
  additional?: Record<string, any>;
  httpStatus: number;

  constructor(request: IRequest, code: number | string, httpStatus: number = 200, additional?: Record<string, any>) {
    this.code = code;
    this.httpStatus = httpStatus;
    this.request = request;
    this.serviceError = Errors.find((err) => this.code == err.code) || Errors[0];
    this.additional = additional;
  }

  throwError = (env: Env) => {
    return handler.throwError(
      this.request,
      [
        {
          code: this.serviceError.code,
          type: this.serviceError.type,
          message: this.serviceError.message,
          url: new URL(this.serviceError.url, env.SUPPORT_WEBSITE_BASE_URL).toString(),
          debug: this.additional
        }
      ],
      this.httpStatus
    );
  };
}
export { getEdgeLocation, pullCloudflareColocationData, traceClientRequest, SupportResource };
export type { TraceClientRequestParams };
