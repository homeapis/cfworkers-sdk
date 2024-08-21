import { CloudflareAccessJwtPayload } from '../orka/types';

export interface OneApplicationJwtPayload {
  aud: string;
  email: string;
  name: string;
  exp: number;
  iat: number;
  nbf: number;
  iss: string;
  type: string;
  identity_nonce: string;
  sub: string;
  country: string;
  /**
   * Application-specific properties
   * short-lived.
   * Never use for authorization purposes
   */
  props: Record<string, any>;
}

export interface CFAccessAuthProps {
  header: {
    alg: string;
    kid: string;
  };
  payload: CloudflareAccessJwtPayload;
}

export interface UserProfile {
  _id: string;
  username: string;
  email: string;
  created_at: number;
  password: string;
  avatar: string | null;
  name: string;
  groups: Array<Object> | any;
  preferences: string;
  two_factor_auth?: string;
}

export interface RequestCredentials {
  email: string;
  password: string;
}

export interface AccountRegistrationBody {
  email: string;
  password: string;
  username: string;
  name: string;
}

interface UserGroup {
  id: string; // The Group's ID
  title: string; // The group's title
}

interface UserProfileType {
  _id: string;
  username: string;
  email: string;
  password: null;
  created_at: number; // UNIX timestamp
  avatar: string;
  name: string;
  groups: UserGroup[];
  preferences: any;
  two_factor_auth: boolean;
}

export type { UserProfileType };
