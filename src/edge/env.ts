export default interface Env {
  HOME_PHOTOS_SECRET: string;
  /**
   * D1 Database for Project Stellaris
   */
  STELLARIS: D1Database;
  campaignsDB: D1Database;
  ORKA_DEMO_SIGNING_KEY: string;
  HOMEAPIS_USERS_DB: D1Database;
  MARKETING_DB: D1Database;
  SUPPORT_DB: D1Database;
  HOMEAPIS_MEDIA_DB: D1Database;
  HOMEAPIS_MEDIA_R2_BUCKET: R2Bucket;
  R2_EXTERNAL: R2Bucket;
  ORKA_VIDEO_R2: R2Bucket;
  imagesBucket: R2Bucket;
  imagesDB: D1Database;
  HOMEAPIS_OPENSSL_JWT_SECRET: string;
  HOMEAPIS_OPENSSL_JWT_SECRET_PHOTOS: string;
  // Feel free to customize the below list
  IOTGTW_DRIVES: D1Database;
  SHORTCUT_ENGINE: D1Database;
  ORKA_VIDEO_DB: D1Database;
  CF_ACCESS_PUBLIC_KEYS_URL: string;
  CF_ACCESS_AUD: string;
  CF_ACCESS_CLIENT_ID: string;
  CF_ACCESS_CLIENT_SECRET: string;
  HELP_CENTER_BASE_URL: string;
}
