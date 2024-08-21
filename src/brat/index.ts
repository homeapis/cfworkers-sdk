import { IRequest } from "itty-router"
import { edge } from "../d"

interface Track {
    trackName: string;
    trackId: string;
    trackLength: number;
    isExplicit: Boolean;
    streamingServices: StreamingService[]
};
interface StreamingService {
    platform: "spotify" | "apple_music" | "deezer";
    url: string;
};

const tracks: Track[] = [
    {
        trackName: "360",
        trackId: "360",
        trackLength: 134,
        isExplicit: true,
        streamingServices: [
            {
                platform: "spotify",
                url: "https://open.spotify.com/track/4w2GLmK2wnioVnb5CPQeex?si=6455ef865dc24b54",
            },
            {
                platform: "apple_music",
                url: "https://geo.music.apple.com/us/album/360/1739079974?i=1739079976&itsct=music_box_link&itscg=30200&ls=1&app=music",
            },
        ],
    },
    {
        trackName: "Club classics",
        trackId: "club_classics",
        trackLength: 154,
        isExplicit: false,
        streamingServices: [
            {
                platform: "spotify",
                url: "https://open.spotify.com/track/0CySZwyRJ0vyUqtSjM9i2k?si=c5b0967532454d81",
            },
            {
                platform: "apple_music",
                url: "https://geo.music.apple.com/us/album/club-classics/1739079974?i=1739080339&itsct=music_box_link&itscg=30200&ls=1&app=music",
            },
        ],
    },
    {
        trackName: "Sympathy is a knife",
        trackId: "sympathy_is_a_knife",
        trackLength: 151,
        isExplicit: true,
        streamingServices: [
            {
                platform: "spotify",
                url: "https://open.spotify.com/track/5c9tBmJKbTdn1vhzXHeAwW?si=832fb1821bf84f65",
            },
            {
                platform: "apple_music",
                url: "https://geo.music.apple.com/us/album/sympathy-is-a-knife/1739079974?i=1739080343&itsct=music_box_link&itscg=30200&ls=1&app=music",
            },
        ],
    },
    {
        trackName: "I might say something stupid",
        trackId: "i_might_say_something_stupid",
        trackLength: 109,
        isExplicit: false,
        streamingServices: [
            {
                platform: "spotify",
                url: "https://open.spotify.com/track/0PFZCt7UNmpas24HejQGu8?si=c79bbe724d6c4485",
            },
            {
                platform: "apple_music",
                url: "https://geo.music.apple.com/us/album/i-might-say-something-stupid/1739079974?i=1739080345&itsct=music_box_link&itscg=30200&ls=1&app=music",
            },
        ],
    },
    {
        trackName: "Talk talk",
        trackId: "talk_talk",
        trackLength: 162,
        isExplicit: false,
        streamingServices: [
            {
                platform: "spotify",
                url: "https://open.spotify.com/track/62fqMvguJbsSs9HKhhRfuS?si=e2f7c737497b4092",
            },
            {
                platform: "apple_music",
                url: "https://geo.music.apple.com/us/album/talk-talk/1739079974?i=1739080348&itsct=music_box_link&itscg=30200&ls=1&app=music",
            },
        ],
    },
    {
        trackName: "Von dutch",
        trackId: "von_dutch",
        trackLength: 164,
        isExplicit: true,
        streamingServices: [
            {
                platform: "spotify",
                url: "https://open.spotify.com/track/3Y1EvIgEVw51XtgNEgpz5c?si=8d8cce9ed26547e5",
            },
            {
                platform: "apple_music",
                url: "https://geo.music.apple.com/us/album/von-dutch/1739079974?i=1739080354&itsct=music_box_link&itscg=30200&ls=1&app=music",
            },
        ],
    },
    {
        trackName: "Everything is romantic",
        trackId: "everything_is_romantic",
        trackLength: 203,
        isExplicit: false,
        streamingServices: [
            {
                platform: "spotify",
                url: "https://open.spotify.com/track/5sMEEjviCkH6Rp5X2ZvIIc?si=b4f7ad8515a240b7",
            },
            {
                platform: "apple_music",
                url: "https://geo.music.apple.com/us/album/everything-is-romantic/1739079974?i=1739080358&itsct=music_box_link&itscg=30200&ls=1&app=music",
            },
        ],
    },
    {
        trackName: "Rewind",
        trackId: "rewind",
        trackLength: 168,
        isExplicit: false,
        streamingServices: [
            {
                platform: "spotify",
                url: "https://open.spotify.com/track/50GxvQA2KEWNt31EdwIlzY?si=5c3fc290739d4d4e",
            },
            {
                platform: "apple_music",
                url: "https://geo.music.apple.com/us/album/rewind/1739079974?i=1739080366&itsct=music_box_link&itscg=30200&ls=1&app=music",
            },
        ],
    },
    {
        trackName: "So I",
        trackId: "so_i",
        trackLength: 211,
        isExplicit: false,
        streamingServices: [
            {
                platform: "spotify",
                url: "https://open.spotify.com/track/0AkiAfilrTUXV49dleC5SB?si=aca0af7099f64f0c",
            },
            {
                platform: "apple_music",
                url: "https://geo.music.apple.com/us/album/so-i/1739079974?i=1739080637&itsct=music_box_link&itscg=30200&ls=1&app=music",
            },
        ],
    },
    {
        trackName: "Girl, so confusing",
        trackId: "girl_so_confusing",
        trackLength: 175,
        isExplicit: false,
        streamingServices: [
            {
                platform: "spotify",
                url: "https://open.spotify.com/track/41krZZovstMJKeJZJtbL78?si=2e5f5144e23f46ff",
            },
            {
                platform: "apple_music",
                url: "https://geo.music.apple.com/us/album/girl-so-confusing/1739079974?i=1739080642&itsct=music_box_link&itscg=30200&ls=1&app=music",
            },
        ],
    },
    {
        trackName: "Apple",
        trackId: "apple",
        trackLength: 152,
        isExplicit: false,
        streamingServices: [
            {
                platform: "spotify",
                url: "https://open.spotify.com/track/19RybK6XDbAVpcdxSbZL1o?si=8bd11497f0f74f7e",
            },
            {
                platform: "apple_music",
                url: "https://geo.music.apple.com/us/album/apple/1739079974?i=1739080645&itsct=music_box_link&itscg=30200&ls=1&app=music",
            },
        ],
    },
    {
        trackName: "B2b",
        trackId: "b2b",
        trackLength: 179,
        isExplicit: false,
        streamingServices: [
            {
                platform: "spotify",
                url: "https://open.spotify.com/track/4wTvw1dBiPXNiHTh0zzpcI?si=d0f675328bd945de",
            },
            {
                platform: "apple_music",
                url: "https://geo.music.apple.com/us/album/b2b/1739079974?i=1739080650&itsct=music_box_link&itscg=30200&ls=1&app=music",
            },
        ],
    },
    {
        trackName: "Mean girls",
        trackId: "mean_girls",
        trackLength: 189,
        isExplicit: true,
        streamingServices: [
            {
                platform: "spotify",
                url: "https://open.spotify.com/track/1qKCO2Tocwg8CbepJ9uDtd?si=da345b8668a14d12",
            },
            {
                platform: "apple_music",
                url: "https://geo.music.apple.com/us/album/mean-girls/1739079974?i=1739080652&itsct=music_box_link&itscg=30200&ls=1&app=music",
            },
        ],
    },
    {
        trackName: "I think about it all the time",
        trackId: "i_think_about_it_all_the_time",
        trackLength: 136,
        isExplicit: false,
        streamingServices: [
            {
                platform: "spotify",
                url: "https://open.spotify.com/track/3OaFGqHUyxGVkOcSILw8Kx?si=9e8b82835c824748",
            },
            {
                platform: "apple_music",
                url: "https://geo.music.apple.com/us/album/i-think-about-it-all-the-time/1739079974?i=1739080653&itsct=music_box_link&itscg=30200&ls=1&app=music",
            },
        ],
    },
    {
        trackName: "365",
        trackId: "365",
        trackLength: 204,
        isExplicit: true,
        streamingServices: [
            {
                platform: "spotify",
                url: "https://open.spotify.com/track/5h68SoVFGleijCtjEja3xG?si=6a303fa4c4ca4eaa",
            },
            {
                platform: "apple_music",
                url: "https://geo.music.apple.com/us/album/365/1739079974?i=1739080656&itsct=music_box_link&itscg=30200&ls=1&app=music",
            },
        ],
    },
];
const listBratStreamingServices = (request: IRequest) => {
    const albumStreamingServices: StreamingService[] = [
        {
            platform: "spotify",
            url: "https://open.spotify.com/album/2lIZef4lzdvZkiiCzvPKj7?autoplay=true",
        },
        {
            platform: "apple_music",
            url: "https://geo.music.apple.com/us/album/brat/1739079974?itsct=music_box_link&itscg=30200&ls=1&app=music",
        },
    ];
    return edge.handler.createResponse(request, {
        album: {
            title: "brat",
            artist: "Charli xcx",
            cover: "https://scontent.homeapis.com/v1/images/aab3c84b914894bf94903ae89ac5b6a887403ef4d3b145c052c776612b3f8dde/d0bc0818-9896-408e-91c4-e3b4e09bc4eb",
            tracks: tracks.map((track, index: number) => {
                return {
                    ...track,
                    trackNumber: index+1
                }
            }),
            albumStreamingServices
        }
    })
};
const getBratTrackDetails = (request: IRequest) => {
    const { track_id } = request.params;
    return edge.handler.createResponse(request, {
        track: {
            ...tracks.find(tc => tc.trackId === track_id),
            cover: "https://scontent.homeapis.com/v1/images/aab3c84b914894bf94903ae89ac5b6a887403ef4d3b145c052c776612b3f8dde/d0bc0818-9896-408e-91c4-e3b4e09bc4eb",
        }
    })
}

export { listBratStreamingServices, getBratTrackDetails }