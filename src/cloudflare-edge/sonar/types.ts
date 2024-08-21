import { UserProfile } from "../auth/types";

export interface D1UploadMetadata {
    id: string,
    user_id: string,
    title: string,
    created_at: number,
    updated_at: number | null,
    alt?: string | null,
    visibility: string,
    region: string,
    ip: string;
    ai_generated_metadata: boolean;
}

export interface PhotosJWTPayload {
    user_metadata?: UserProfile,
    refresh?: boolean,
    exp?: number,
    aud?: string,
}