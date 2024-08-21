import { IRequest } from "itty-router";
import { edge } from "..";

/**
 * Returns the JSON property of the available RUM (Real User Metrics) scripts for the web property.
 * @param request 
 * @returns 
 */
export const generateWebPropertyRumScript = async (request: IRequest) => {
    const { property_id } = request.params;

    let seed = new Int8Array().fill(0);

    return edge.handler.createResponse(request, {
        report_url: `https://universal-activity-service.bssott.homeapis.com/play`,
        report: {
            headers: {
                'X-HomeAPIs-Playback-ID': crypto.getRandomValues(seed).toString(),
                'X-HomeAPIs-Web-ID': property_id,
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
    });
};