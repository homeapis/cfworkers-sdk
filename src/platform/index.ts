import { IRequest } from "itty-router";
import { Errors as ErrorList, ServiceError } from "./errorKit";
import { edge } from "../d";

/**
 * ServiceResource
 */
class SupportResource {
    code: number | string;
    request: IRequest;
    serviceError: ServiceError;
    additional?: Record<string,any>;
    httpStatus: number;

    constructor(request: IRequest, code: number | string, httpStatus: number = 200,  additional?: Record<string,any>) {
        this.code = code;
        this.httpStatus = httpStatus;
        this.request = request;
        this.serviceError = ErrorList.find(err => this.code == err.code) || ErrorList[0];
        this.additional = additional
    }

    throwError = () => {
        return edge.handler.throwError(this.request, [
            {
                code: this.serviceError.code,
                type: this.serviceError.type,
                message: this.serviceError.message,
                url: new URL(this.serviceError.url, "https://developers.homeapis.com").toString(),
                debug: this.additional
            }], this.httpStatus)
    }
};

export { SupportResource };