import { homeapis } from "../../../sdk";
import { IRequest } from "itty-router";
import edge_locations from "./colocations.json"
import Env from "../env";

function getEdgeLocation(code: any) {
  const colocation = edge_locations.find(colo => colo.colo_code === code);
  return colocation;
}

interface TraceClientRequestParams {
  city?: string;
  colo?: string;
  continent?: string;
  asn?: string;
  asOrganization?: string;
} 

const traceClientRequest = async (request: IRequest, env: Env, ctx: ExecutionContext) => {
  // let newReq = new Response(request.body)
  // let query = await newReq.json();

  return homeapis.edge.handler.createResponse(request,  {
    data: {
      cf: request.cf,
    }
  })
}

export {
    getEdgeLocation,
    traceClientRequest
}