import { IRequest } from 'itty-router';
import { handler } from '../d';
import edgeLocations from '../../colocations.json';

function getEdgeLocation(code: any) {
  const colocation = edgeLocations.find((colo) => colo.colo_code === code);
  return colocation;
}

export interface TraceClientRequestParams {
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

export { getEdgeLocation, traceClientRequest };
