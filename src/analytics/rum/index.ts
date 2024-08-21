import { IRequest } from "itty-router"
import { homeapis } from "../../../sdk";

export const getPropertyRUMScript = async (request: IRequest) => {
    const props = {
        property_id: request.params.property_id
    }

    let seed = new Int8Array().fill(0);

    return homeapis.edge.handler.createResponse(request, {
        report_url: `https://universal-activity-service.bssott.homeapis.com/play`,
        report: {
            headers: {
                "X-HomeAPIs-Playback-ID": crypto.getRandomValues(seed).toString()
            },
            body: `**
            * IMPORTANT NOTE:
            *
            * This file is licensed only for the use of Apple developers in providing MusicKit Web Services,
            * and is subject to the Apple Media Services Terms and Conditions and the Apple Developer Program
            * License Agreement. You may not copy, modify, re-host, or create derivative works of this file or the
            * accompanying Documentation, or any part thereof, including any updates, without Apple's written consent.
            *
            * ACKNOWLEDGEMENTS:
            * https://js-cdn.music.apple.com/musickit/v1/acknowledgements.txt
            */
           `
        },
    })
}