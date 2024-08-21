export interface D1OrkaCloudVideo {
  id: string;
  title: string;
  short_id: string;
  master_playlist_type: string;
  channel_id: string;
  video_length: BigInt | null;
  created_at: string;
  updated_at: string | null;
  owner: string;
  storyboard_image_count: number;
  storyboard_feature: number;
  adaptive: number;
  description: string;
  enable_downloads: number;
}

interface CloudflareAccessJwtPayload {
  aud: string | string[];
  email: string;
  exp: number;
  iat: number;
  nbf: number;
  iss: string;
  type: string;
  identity_nonce: string;
  sub: string;
  country: string;
}

export type { CloudflareAccessJwtPayload };
