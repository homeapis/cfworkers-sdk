interface ImageBody {
  image: {
    url: string;
  };
}

interface DBImage {
  id: string;
  created_at: number;
  updated_at: number | null;
  original_image_url: string;
  original_image_hash: string;
  original_size: number;
  account_uid: string;
  account_uid_sha256: string;
  is_moderated: number;
  is_deleted: number;
  moderation_challenge_score: number | null;
}
