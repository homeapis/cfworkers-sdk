interface MarketingEmailD1 {
  /**
   * The utm_campaign parameter
   */
  mkt_campaign: string;
  /**
   * The mkt UUID associated with the email
   */
  email_uuid: string;
  /**
   * The plaintext email address
   */
  email: string;
  /**
   * The time the email was first registered to this UUID
   */
  created_at: Number;
  /**
   * Whether the user has subscribed to emails
   */
  allows_email: Number;
  /**
   * Whether the email has been disabled
   * but deletion has not been requested
   */
  is_disabled: Number;
  /**
   * Whether the user has requested to have
   * their marketing data deleted
   */
  has_requested_deletion: Number;
  /**
   * When the user data will be deleted
   * if applicable
   */
  deletion_requested_date: Number | null;
  /**
   * Whether the user subscriber linked
   * their personal account to the marketing email
   */
  is_account_linked: Number;
  /**
   * The utm_source paramater
   */
  mkt_channel: string;
  /**
   * The last time we reached out to this email
   */
  mkt_last_intouch: Number;
  /**
   * The equivalent of the utm_medium parameter
   */
  mkt_medium: string;
  /**
   * A secure SHA-256 representation of the collected email
   */
  email_hash_sha256: string;
  /**
   * Region where the email is collected
   */
  mkt_region: string | null;
  /**
   * When applicable, the user_id
   */
  mkt_linked_account_id: string | null;
}

interface MarketingEmailQuery {
  email: string;
  mkt_campaign: string;
  mkt_medium: string;
  mkt_channel: string;
}

export type { MarketingEmailD1, MarketingEmailQuery };
